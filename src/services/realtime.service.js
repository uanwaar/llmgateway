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
const {
  estimateBase64DecodedBytes,
  pcm16DurationMsForBytes,
} = require('../utils/audio');
const metrics = require('../services/metrics.service');

class RealtimeService {
  constructor() {
    this.sessions = new Map();
    this.modelToProvider = new Map(); // Model to provider mapping
    this.initialized = false;
  }

  /**
   * Initialize the realtime service - build model-to-provider mapping from config
   */
  initialize() {
    if (this.initialized) return;
    
    try {
      logger.info('Initializing Realtime Service');
      
      // Build model-to-provider mapping from config.realtime.models
      const realtimeModels = Array.isArray(config.realtime?.models) ? config.realtime.models : [];
      
      for (const model of realtimeModels) {
        if (model.id && model.provider) {
          this.modelToProvider.set(model.id, model.provider);
        }
      }
      
      this.initialized = true;
      logger.info('Realtime Service initialized successfully', {
        modelsConfigured: this.modelToProvider.size
      });
    } catch (error) {
      logger.error('Failed to initialize Realtime Service', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Ensure realtime service is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      this.initialize();
    }
  }

  /**
   * Create a new realtime session
   * @param {WebSocket} ws
   * @param {IncomingMessage} request
   * @param {{model?: string, provider?: 'openai'|'gemini'}} opts
   */
  async createSession(ws, request, opts = {}) {
    this.ensureInitialized();
    
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
      mode: opts.mode || 'default',
      createdAt,
      lastActivity: createdAt,
      upstream: {
        adapter: null,
        connected: false,
  connecting: false,
  connectPromise: null,
        buffer: [],
        config: {},
      },
      // T11: Rate/Backpressure state
      rate: {
        sampleRate: this._resolveSampleRate(opts.model) || 16000,
        // per-minute APM window (audio ms per minute)
        minWindowStart: createdAt,
        audioMsInMinute: 0,
        // queued audio for throttling/backpressure
        queue: [], // items: { audio, estBytes, durationMs }
        draining: false,
        drainTimer: null,
        paused: false,
      },
    };

  this.sessions.set(id, session);
  metrics.incSessions(1);
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

    // Normalize alternate payload shapes (e.g., Gemini Live protocol) into our event schema
    try {
      const normalized = this._normalizeClientMessage(msg);
      if (normalized) msg = normalized;
    } catch (_) { /* ignore */ }

    // Phase 2: Thin integration layer to upstream adapters
    if (!msg || !msg.type) return;

    switch (msg.type) {
  case 'session.update': {
        // Support both flat payload and { data: { ... } } form
        const payload = (msg && typeof msg.data === 'object') ? msg.data : msg;

        // Capture model if provided
        if (payload && typeof payload.model === 'string' && payload.model.trim()) {
          const newModel = payload.model.trim();
          if (!session.upstream.connected) {
            session.model = newModel;
          } else if (session.model && session.model !== newModel) {
            // Changing model mid-session not supported (requires reconnect)
            this._safeSend(session.ws, { type: 'warning', code: 'model_change_not_supported', from: session.model, to: newModel });
          }
        }

        // Store desired config; defer upstream connection until audio arrives
        session.upstream.config = {
          language: payload.language,
          vad: payload.vad,
          include: payload.include,
          // Accept either prompt or systemInstruction naming
          prompt: payload.prompt || payload.systemInstruction,
          // In transcription mode, ensure guidance suppresses commentary
          transcription_only: session.mode === 'transcription',
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
            try {
              this._handleAudioAppend(session, msg);
            } catch (e) {
              this._sendError(session.ws, 'audio_append_failed', e?.message);
            }
          })
          .catch((err) => this._sendError(session.ws, 'upstream_init_failed', err?.message));
        return;
      }
      case 'input_audio.activity_start': {
        this.ensureUpstream(session)
          .then(() => { try { session.upstream.adapter.activityStart?.(); } catch (e) { this._sendError(session.ws, 'activity_start_failed', e?.message); } })
          .catch((err) => this._sendError(session.ws, 'upstream_init_failed', err?.message));
        return;
      }
      case 'input_audio.activity_end': {
        this.ensureUpstream(session)
          .then(() => { try { session.upstream.adapter.activityEnd?.(); } catch (e) { this._sendError(session.ws, 'activity_end_failed', e?.message); } })
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
  try { if (session.rate?.drainTimer) { clearTimeout(session.rate.drainTimer); } } catch (e) { /* ignore */ }
  if (session.rate) { session.rate.draining = false; session.rate.drainTimer = null; }
    try { session.upstream?.adapter?.close?.(); } catch (e) { /* ignore */ }
  this.sessions.delete(sessionId);
  metrics.incSessions(-1);
    logger.info('Realtime session closed', { id: sessionId });
  }

  /**
   * Ensure upstream adapter is connected for this session
   */
  async ensureUpstream(session) {
    if (session.upstream.connected && session.upstream.adapter) return;
    if (session.upstream.connecting && session.upstream.connectPromise) {
      return session.upstream.connectPromise;
    }

    // Resolve provider if not provided explicitly
    if (!session.provider) {
      session.provider = this.resolveProviderByModel(session.model);
    }

    // Create adapter
    const provider = session.provider;
    if (provider === 'openai') {
      session.upstream.connecting = true;
      session.upstream.connectPromise = (async () => {
      const apiKey = config.providers?.openai?.apiKey;
      if (!apiKey) throw new Error('OpenAI API key missing');
      session.upstream.adapter = new OpenAIRealtimeAdapter({ apiKey, model: session.model });
      await session.upstream.adapter.connect();
      session.upstream.connected = true;
      this._hookUpstreamMessages(session, provider);
      // Send initial session update on first connect
      this.sendUpstreamSessionUpdate(session);
      })().finally(() => { session.upstream.connecting = false; session.upstream.connectPromise = null; });
      return session.upstream.connectPromise;
    }

    if (provider === 'gemini') {
      session.upstream.connecting = true;
      session.upstream.connectPromise = (async () => {
      const apiKey = config.providers?.gemini?.apiKey;
      if (!apiKey) throw new Error('Gemini API key missing');
  session.upstream.adapter = new GeminiRealtimeAdapter({ apiKey, model: session.model });
  await session.upstream.adapter.connect({ systemInstruction: session.upstream.config?.prompt, vad: session.upstream.config?.vad });
      session.upstream.connected = true;
      this._hookUpstreamMessages(session, provider);
      // Gemini config largely applied at connect; nothing additional needed here
      })().finally(() => { session.upstream.connecting = false; session.upstream.connectPromise = null; });
      return session.upstream.connectPromise;
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
    // Track latency from input commit to first transcript delta
    let commitAt = 0;
    const markCommit = () => { commitAt = Date.now(); };
    // Monkey-patch commit to also mark time
    const origCommit = adapter.commitAudio?.bind(adapter);
    if (origCommit) {
      adapter.commitAudio = () => { try { markCommit(); } catch(_){} return origCommit(); };
    }
  adapter.onMessage((evt) => {
      // Optional debug: mirror raw upstream events to client and log
      try {
        const debugEnabled = (session.upstream?.config?.include && session.upstream.config.include.raw_upstream === true)
          || String(process.env.REALTIME_DEBUG_UPSTREAM || '').toLowerCase() === '1';
        if (debugEnabled) {
          // Mirror to client as debug event (best-effort)
          this._safeSend(ws, { type: 'debug.upstream', provider, raw: evt });
          // Truncate log payload to avoid huge lines
          const rawStr = (() => { try { return JSON.stringify(evt); } catch { return '[unserializable]'; } })();
          const snippet = rawStr && rawStr.length > 2000 ? rawStr.slice(0, 2000) + '…' : rawStr;
          logger.debug?.('Upstream message (raw)', { provider, length: rawStr?.length, snippet });
        }
      } catch (_) { /* ignore debug errors */ }

      // Normalize to unified transcript events
  const unified = normalize(provider, evt);
      if (!unified || unified.length === 0) return;
      for (const u of unified) {
        // In transcription mode, suppress any model output commentary events
        if (session.mode === 'transcription' && u.meta && u.meta.source === 'model') {
          continue;
        }
        // Latency: first transcript.delta after commit
        if (commitAt && u.type === 'transcript.delta') {
          metrics.observeLatencyMs(Date.now() - commitAt);
          commitAt = 0;
        }
        // Approximate tokens on transcript.done (simple whitespace-based count)
        if (u.type === 'transcript.done' && typeof u.text === 'string') {
          const tokens = u.text.trim().length ? u.text.trim().split(/\s+/).length : 0;
          metrics.incTranscriptTokens(tokens);
        }
        this._safeSend(ws, u);

        // Auto-close quickly after transcript is done in transcription mode
        if (session.mode === 'transcription' && u.type === 'transcript.done') {
          try { setTimeout(() => { try { ws.close(); } catch (_) {} this.closeSession(session.id); }, 150); } catch (_) {}
        }
      }
    });
  }


  _safeSend(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { logger.warn('WS send failed'); }
  }

  _sendError(ws, code, message) {
    this._safeSend(ws, { type: 'error', code, message });
  metrics.incErrors(1);
  }

  /**
   * Resolve provider by model using strict validation against configured models
   */
  resolveProviderByModel(modelId) {
    this.ensureInitialized();
    
    if (!modelId) {
      logger.warn('No model ID provided for provider resolution');
      return undefined;
    }
    
    // Use strict model-to-provider mapping (no regex fallbacks)
    const provider = this.modelToProvider.get(modelId);
    
    if (!provider) {
      logger.warn('No provider found for model', { 
        model: modelId,
        availableModels: Array.from(this.modelToProvider.keys())
      });
      return undefined;
    }
    
    return provider;
  }

  /**
   * Get available realtime models
   */
  getAvailableModels() {
    this.ensureInitialized();
    
    const models = [];
    const realtimeModels = Array.isArray(config.realtime?.models) ? config.realtime.models : [];
    
    for (const model of realtimeModels) {
      if (model.id && model.provider) {
        models.push({
          id: model.id,
          provider: model.provider,
          input: model.input,
          vad_default: model.vad_default,
        });
      }
    }
    
    return models;
  }

  // === T11: Rate limits and backpressure ===
  _resolveSampleRate(modelId) {
    try {
      if (!modelId) return 16000;
      const models = Array.isArray(config.realtime?.models) ? config.realtime.models : [];
      const found = models.find(m => m.id === modelId);
      return found?.input?.sample_rate_hz || 16000;
    } catch {
      return 16000;
    }
  }


  _resetMinuteWindowIfNeeded(session, now) {
    const minWindowMs = 60000;
    if (now - session.rate.minWindowStart >= minWindowMs) {
      session.rate.minWindowStart = now;
      session.rate.audioMsInMinute = 0;
    }
  }

  _emitRateLimitsUpdated(session) {
    const now = Date.now();
    const minResetMs = Math.max(0, 60000 - (now - session.rate.minWindowStart));
    this._safeSend(session.ws, {
      type: 'rate_limits.updated',
      minute: {
        used_ms: session.rate.audioMsInMinute,
        limit_ms: (config.realtime?.limits?.apm_audio_seconds_per_min || 180) * 1000,
        reset_ms: minResetMs,
      },
    });
  }

  _handleAudioAppend(session, msg) {
    // Accept either a base64 string or an object { data, mime_type|mimeType }
    let audioB64 = null;
    if (typeof msg?.audio === 'string') {
      audioB64 = msg.audio;
    } else if (msg?.audio && typeof msg.audio === 'object') {
      if (typeof msg.audio.data === 'string') {
        audioB64 = msg.audio.data;
      }
    }
    if (typeof audioB64 !== 'string' || audioB64.length === 0) {
      throw new Error('audio field (base64) required');
    }

    const sr = session.rate.sampleRate || 16000;
    const now = Date.now();
    this._resetMinuteWindowIfNeeded(session, now);

    // Limits
    const audioCfg = config.realtime?.audio || {};
    const maxChunkBytesCfg = audioCfg.max_chunk_bytes || 32768;
    const targetChunkMs = audioCfg.chunk_target_ms || 50;
    const maxBufferedMs = audioCfg.max_buffer_ms || 5000;

    // Estimate decoded PCM bytes and ms
    const estBytes = estimateBase64DecodedBytes(audioB64);
    const estMs = pcm16DurationMsForBytes(estBytes, sr, 1);

    // Hard limit: chunk too large
    if (estBytes > maxChunkBytesCfg) {
      this._sendError(session.ws, 'audio_chunk_exceeds_limit', `max_chunk_bytes=${maxChunkBytesCfg}`);
      return;
    }

    // APM minute limit (audio seconds per minute)
    const apmLimitSec = config.realtime?.limits?.apm_audio_seconds_per_min || 180;
    const apmLimitMs = apmLimitSec * 1000;
    if (session.rate.audioMsInMinute + estMs > apmLimitMs) {
      this._sendError(session.ws, 'apm_exceeded', `limit_ms=${apmLimitMs}`);
      this._emitRateLimitsUpdated(session);
      return; // drop this chunk
    }

    // Try to send directly to upstream
    let sent = false;
    if (session.upstream?.adapter?.appendAudioBase64) {
      try {
        const ok = session.upstream.adapter.appendAudioBase64(audioB64);
        if (ok !== false) {
          // Success; account usage
          session.rate.audioMsInMinute += estMs;
          metrics.incAudioSeconds(estMs / 1000);
          sent = true;
          this._emitRateLimitsUpdated(session);
        } else {
          // Upstream signaled backpressure
          // We'll enqueue and pause client reads immediately
        }
      } catch (e) {
        // If send fails, fall back to queue
      }
    }

    if (!sent) {
      // Buffer overflow check by total queued ms
      const queuedMs = session.rate.queue.reduce((acc, it) => acc + (it.durationMs || 0), 0);
      if (queuedMs + estMs > maxBufferedMs) {
        this._sendError(session.ws, 'backpressure_buffer_overflow', `max_buffer_ms=${maxBufferedMs}`);
        return;
      }
      session.rate.queue.push({ audio: audioB64, estBytes, durationMs: estMs });

      // Pause if backlog beyond threshold or adapter signaled backpressure
      const pauseThresholdMs = Math.floor(maxBufferedMs * 0.8);
      if (queuedMs + estMs >= pauseThresholdMs) {
        this._pauseClientRead(session, 'backlog');
      }
      // Also pause immediately when adapter returned false (backpressure case)
      if (session.upstream?.adapter?.appendAudioBase64) {
        this._pauseClientRead(session, 'upstream_backpressure');
      }

      if (!session.rate.draining) {
        this._scheduleDrain(session, targetChunkMs);
      }
    }
  }

  /**
   * Normalize alternate client message formats (e.g., Gemini Live) into gateway schema.
   * - setup => session.update
   * - realtimeInput.audio => input_audio.append
   * - clientContent.turnComplete => input_audio.commit
   */
  _normalizeClientMessage(msg) {
    if (!msg || typeof msg !== 'object') return null;

    // Gemini: Setup payload
    if (msg.setup && typeof msg.setup === 'object') {
      const s = msg.setup;
      return {
        type: 'session.update',
        data: {
          model: s.model,
          // generationConfig.responseModalities can be mapped if needed later
          systemInstruction: s.systemInstruction,
          // Future: map tools
        },
      };
    }

    // Gemini: Realtime input with audio
    if (msg.realtimeInput && typeof msg.realtimeInput === 'object') {
      if (msg.realtimeInput.audio && typeof msg.realtimeInput.audio === 'object') {
        return {
          type: 'input_audio.append',
          audio: {
            data: msg.realtimeInput.audio.data,
            mime_type: msg.realtimeInput.audio.mimeType || msg.realtimeInput.audio.mime_type,
          },
        };
      }
      if (msg.realtimeInput.activityStart) {
        return { type: 'input_audio.activity_start' };
      }
      if (msg.realtimeInput.activityEnd) {
        return { type: 'input_audio.activity_end' };
      }
    }

    // Gemini: Client content signaling turn completion
    if (msg.clientContent && typeof msg.clientContent === 'object') {
      if (msg.clientContent.turnComplete === true) {
        return { type: 'input_audio.commit' };
      }
    }

    return null;
  }

  _scheduleDrain(session, delayMs) {
    if (session.rate.draining) return;
    session.rate.draining = true;
    const run = () => {
      try {
        const now = Date.now();
        this._resetMinuteWindowIfNeeded(session, now);
        const apmLimitMs = (config.realtime?.limits?.apm_audio_seconds_per_min || 180) * 1000;

        while (session.rate.queue.length > 0) {
          const next = session.rate.queue[0];
          // Check APM limit
          if (session.rate.audioMsInMinute + next.durationMs > apmLimitMs) {
            // Can't send now; wait for minute window reset
            break;
          }
          // Try to send
          const ok = session.upstream?.adapter?.appendAudioBase64?.(next.audio);
          if (ok === false) {
            // Upstream backpressure persists; try later
            this._pauseClientRead(session, 'upstream_backpressure');
            break;
          }
          // Sent successfully
          session.rate.audioMsInMinute += next.durationMs;
          metrics.incAudioSeconds(next.durationMs / 1000);
          session.rate.queue.shift();
          this._emitRateLimitsUpdated(session);
        }
      } finally {
        // Re-schedule if there is still work or limits block us
        const maxBufferedMs = config.realtime?.audio?.max_buffer_ms || 5000;
        const resumeThresholdMs = Math.floor(maxBufferedMs * 0.5);
        const queuedMsNow = session.rate.queue.reduce((acc, it) => acc + (it.durationMs || 0), 0);

        // If backlog has drained sufficiently, resume client reads
        if (session.rate.paused && queuedMsNow <= resumeThresholdMs) {
          this._resumeClientRead(session);
        }

        if (session.rate.queue.length > 0) {
          const targetChunkMs = config.realtime?.audio?.chunk_target_ms || 50;
          session.rate.drainTimer = setTimeout(run, targetChunkMs);
        } else {
          session.rate.draining = false;
          session.rate.drainTimer = null;
        }
      }
    };
    session.rate.drainTimer = setTimeout(run, delayMs);
  }

  _pauseClientRead(session, reason = 'backpressure') {
    if (session.rate.paused) return;
    const ws = session.ws;
    try {
      if (ws && ws._socket && typeof ws._socket.pause === 'function') {
        ws._socket.pause();
        session.rate.paused = true;
        this._safeSend(ws, { type: 'warning', code: 'backpressure_paused', reason });
        this._emitRateLimitsUpdated(session);
      }
    } catch (e) {
      // ignore
    }
  }

  _resumeClientRead(session) {
    if (!session.rate.paused) return;
    const ws = session.ws;
    try {
      if (ws && ws._socket && typeof ws._socket.resume === 'function') {
        ws._socket.resume();
        session.rate.paused = false;
        this._safeSend(ws, { type: 'warning', code: 'backpressure_resumed' });
        this._emitRateLimitsUpdated(session);
      }
    } catch (e) {
      // ignore
    }
  }
}

module.exports = new RealtimeService();
