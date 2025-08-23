/**
 * Realtime session service (MVP for Phase 1)
 * - Tracks sessions
 * - Emits session.created
 * - Stubs message handling for future phases
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');
const OpenAIRealtimeAdapter = require('../providers/openai/realtime.adapter');
const GeminiRealtimeAdapter = require('../providers/gemini/realtime.adapter');
const { normalize } = require('../utils/realtime-normalizer');

class RealtimeService {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Create a new realtime session
   * @param {WebSocket} ws
   * @param {IncomingMessage} request
   * @param {{model?: string, provider?: 'openai'|'gemini'}} opts
   */
  async createSession(ws, request, opts = {}) {
    if (!config.realtime?.enabled) {
      throw new Error('Realtime feature disabled');
    }

    const id = uuidv4();
    const createdAt = Date.now();

    const session = {
      id,
      ws,
      request,
      model: opts.model,
      provider: opts.provider,
      createdAt,
      lastActivity: createdAt,
      upstream: {
        adapter: null,
        connected: false,
        buffer: [],
        config: {},
      },
    };

    this.sessions.set(id, session);
    logger.info('Realtime session created', {
      id,
      model: session.model,
      provider: session.provider,
    });

    // Idle timeout enforcement (Phase 1: log only)
    const idleSeconds = config.realtime.security?.max_idle_seconds || 60;
    session.idleTimer = setInterval(() => {
      const age = Date.now() - session.lastActivity;
      if (age > idleSeconds * 1000) {
        try {
          ws.send(JSON.stringify({ type: 'error', code: 'idle_timeout' }));
        } catch (e) {
          logger.warn('Failed to send idle_timeout');
        }
        try {
          ws.close();
        } catch (e) {
          logger.warn('Failed to close WS on idle');
        }
        this.closeSession(id);
      }
    }, 15000);

  return session;
  }

  /**
   * Handle messages from client (Phase 1: acknowledge and noop)
   */
  handleClientMessage(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.lastActivity = Date.now();

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      try {
        session.ws.send(JSON.stringify({ type: 'error', code: 'bad_json' }));
      } catch (e) {
        logger.warn('Failed to send bad_json');
      }
      return;
    }

    // Phase 2: Thin integration layer to upstream adapters
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'session.update': {
        // Store desired config; defer upstream connection until audio arrives
        session.upstream.config = {
          language: msg.language,
          vad: msg.vad,
          include: msg.include,
          prompt: msg.prompt,
        };
        // If already connected upstream, send update now
        if (session.upstream.connected && session.upstream.adapter) {
          try { this.sendUpstreamSessionUpdate(session); } catch (e) {
            this._sendError(session.ws, 'upstream_update_failed', e?.message);
          }
        }
        this._safeSend(session.ws, { type: 'session.updated' });
        return;
      }
      case 'input_audio.append': {
        this.ensureUpstream(session)
          .then(() => {
            session.upstream.adapter.appendAudioBase64?.(msg.audio);
          })
          .catch((err) => this._sendError(session.ws, 'upstream_init_failed', err?.message));
        return;
      }
      case 'input_audio.commit': {
        this.ensureUpstream(session)
          .then(() => {
            session.upstream.adapter.commitAudio?.();
          })
          .catch((err) => this._sendError(session.ws, 'upstream_init_failed', err?.message));
        return;
      }
      case 'input_audio.clear': {
        this.ensureUpstream(session)
          .then(() => {
            session.upstream.adapter.clearAudio?.();
          })
          .catch((err) => this._sendError(session.ws, 'upstream_init_failed', err?.message));
        return;
      }
      default:
        // Unknown message types can be ignored or warned
        logger.debug?.('Unknown realtime message type', { type: msg.type });
        return;
    }
  }

  /**
   * Close and cleanup a session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearInterval(session.idleTimer);
    try { session.upstream?.adapter?.close?.(); } catch (e) { /* ignore */ }
    this.sessions.delete(sessionId);
    logger.info('Realtime session closed', { id: sessionId });
  }

  /**
   * Ensure upstream adapter is connected for this session
   */
  async ensureUpstream(session) {
    if (session.upstream.connected && session.upstream.adapter) return;

    // Resolve provider if not provided explicitly
    if (!session.provider) {
      session.provider = this.resolveProviderByModel(session.model);
    }

    // Create adapter
    const provider = session.provider;
    if (provider === 'openai') {
      const apiKey = config.providers?.openai?.apiKey;
      if (!apiKey) throw new Error('OpenAI API key missing');
      session.upstream.adapter = new OpenAIRealtimeAdapter({ apiKey, model: session.model });
      await session.upstream.adapter.connect();
      session.upstream.connected = true;
      this._hookUpstreamMessages(session, provider);
      // Send initial session update on first connect
      this.sendUpstreamSessionUpdate(session);
      return;
    }

    if (provider === 'gemini') {
      const apiKey = config.providers?.gemini?.apiKey;
      if (!apiKey) throw new Error('Gemini API key missing');
  session.upstream.adapter = new GeminiRealtimeAdapter({ apiKey, model: session.model });
  await session.upstream.adapter.connect({ systemInstruction: session.upstream.config?.prompt, vad: session.upstream.config?.vad });
      session.upstream.connected = true;
      this._hookUpstreamMessages(session, provider);
      // Gemini config largely applied at connect; nothing additional needed here
      return;
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * Send provider-specific session update
   */
  sendUpstreamSessionUpdate(session) {
    if (!session.upstream?.adapter) return;
    const { language, vad, include, prompt } = session.upstream.config || {};
    if (session.provider === 'openai') {
      session.upstream.adapter.sendSessionUpdate({ language, vad, include, prompt });
    } else if (session.provider === 'gemini') {
      // Gemini SDK config is set on connect; future dynamic updates can be handled here
    }
  }

  /**
   * Attach upstream message listener and normalize
   */
  _hookUpstreamMessages(session, provider) {
    const ws = session.ws;
    const adapter = session.upstream.adapter;
    adapter.onMessage((evt) => {
      // Normalize to unified transcript events
  const unified = normalize(provider, evt);
      if (!unified || unified.length === 0) return;
      for (const u of unified) {
        this._safeSend(ws, u);
      }
    });
  }


  _safeSend(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { logger.warn('WS send failed'); }
  }

  _sendError(ws, code, message) {
    this._safeSend(ws, { type: 'error', code, message });
  }

  /**
   * Resolve provider by model using realtime model map in config, fallback by prefix
   */
  resolveProviderByModel(modelId) {
    if (!modelId) return undefined;
    const list = Array.isArray(config.realtime?.models) ? config.realtime.models : [];
    const hit = list.find(m => m.id === modelId);
    if (hit) return hit.provider;
    if (/^gemini/i.test(modelId)) return 'gemini';
    if (/^(gpt|whisper|o\d)/i.test(modelId)) return 'openai';
    return undefined;
  }
}

module.exports = new RealtimeService();
