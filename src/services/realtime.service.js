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
  providerToken: request.headers['x-provider-token'] || request.headers['x-openai-ephemeral-key'] || null,
  adapter: null,
  bufferedAudioMs: 0,
      createdAt,
      lastActivity: createdAt,
    };

    this.sessions.set(id, session);
    logger.info('Realtime session created', {
      id,
      model: session.model,
      provider: session.provider,
    });

  // Idle timeout enforcement
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
    // Handle session.update locally; do not require upstream connectivity yet
    if (msg && msg.type === 'session.update') {
      session.sessionConfig = msg.session || {};
      session.vadMode = session.sessionConfig.vad || session.vadMode;
      try {
        session.ws.send(JSON.stringify({ type: 'session.updated' }));
      } catch (e) {
        logger.warn('Failed to send session.updated');
      }
      return;
    }

    // Basic guardrails for audio appends
    if (msg && msg.type === 'input_audio.append') {
      const { decodeBase64ToBuffer, validatePcm16Chunk } = require('../utils/audio');
      try {
        const buf = decodeBase64ToBuffer(msg.audio || '');
        const maxBytes = config.realtime?.audio?.max_chunk_bytes || 32768;
        const valid = validatePcm16Chunk(buf, { maxChunkBytes: maxBytes });
        if (!valid.ok) {
          try { session.ws.send(JSON.stringify({ type: 'error', code: 'invalid_audio_chunk', message: valid.reason })); } catch {}
          return;
        }
      } catch (e) {
        try { session.ws.send(JSON.stringify({ type: 'error', code: 'invalid_audio_base64', message: e.message })); } catch {}
        return;
      }
    }

    // Initialize adapter lazily on first audio or response event
    if (!session.adapter && (msg.type?.startsWith('input_audio') || msg.type === 'response.create')) {
      this.bindProviderAdapter(session);
    }

    // Relay client events to provider adapter if present
    if (session.adapter) {
      try {
        session.adapter.sendGatewayEvent(msg);
      } catch (e) {
        logger.warn('Adapter send failed', { error: e.message });
      }
    }
  }

  /**
   * Close and cleanup a session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearInterval(session.idleTimer);
    try { session.adapter?.close(); } catch (e) { /* ignore */ }
    this.sessions.delete(sessionId);
    logger.info('Realtime session closed', { id: sessionId });
  }

  /**
   * Determine provider by model or explicit provider flag, then connect adapter
   */
  async bindProviderAdapter(session) {
    const provider = (session.provider || this.resolveProviderByModel(session.model) || '').toLowerCase();
    if (!provider) {
      try { session.ws.send(JSON.stringify({ type: 'error', code: 'bad_request', message: 'Unknown provider for model' })); } catch {}
      return;
    }

    const sendToClient = (normalized/*, raw */) => {
      if (!normalized) return;
      try { session.ws.send(JSON.stringify(normalized)); } catch (e) { logger.warn('Failed to send to client', { error: e.message }); }
    };

    const onError = (err) => {
      try { session.ws.send(JSON.stringify({ type: 'error', code: 'upstream_error', message: err.message })); } catch {}
    };

    const onClose = () => { /* upstream closed; keep client alive until idle or client close */ };

  if (provider === 'openai') {
      session.adapter = new OpenAIRealtimeAdapter({
        model: session.model,
        token: session.providerToken || config.providers.openai.apiKey,
    initialConfig: session.sessionConfig,
        onEvent: (n, raw) => sendToClient(n || normalize('openai', raw)),
        onError, onClose,
      });
    } else if (provider === 'gemini') {
      // Determine VAD mode from session update if provided
      const vadMode = session.vadMode || config.realtime.models?.find(m => m.id === session.model)?.vad_default || 'server_vad';
      session.adapter = new GeminiRealtimeAdapter({
        model: session.model,
        token: session.providerToken || config.providers.gemini.apiKey,
        vadMode,
  initialConfig: session.sessionConfig,
        onEvent: (n, raw) => sendToClient(n || normalize('gemini', raw)),
        onError, onClose,
      });
    } else {
      try { session.ws.send(JSON.stringify({ type: 'error', code: 'bad_request', message: 'Unsupported provider' })); } catch {}
      return;
    }

    try {
      await session.adapter.connect();
    } catch (err) {
      logger.error('Failed to connect upstream realtime', { provider, error: err.message });
      try { session.ws.send(JSON.stringify({ type: 'error', code: 'upstream_connect_failed', message: err.message })); } catch {}
    }
  }

  resolveProviderByModel(model) {
    if (!model || !Array.isArray(config.realtime?.models)) return null;
    const entry = config.realtime.models.find(m => m.id === model);
    return entry?.provider || null;
  }
}

module.exports = new RealtimeService();
