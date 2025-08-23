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
  bytesPerSecond,
} = require('../utils/audio');
const metrics = require('../services/metrics.service');

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
      // T11: Rate/Backpressure state
      rate: {
        sampleRate: this._resolveSampleRate(opts.model) || 16000,
        // per-second window
        secWindowStart: createdAt,
        bytesInSecond: 0,
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
            try {
              this._handleAudioAppend(session, msg);
            } catch (e) {
              this._sendError(session.ws, 'audio_append_failed', e?.message);
            }
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
    // Track latency from input commit to first transcript delta
    let commitAt = 0;
    const markCommit = () => { commitAt = Date.now(); };
    // Monkey-patch commit to also mark time
    const origCommit = adapter.commitAudio?.bind(adapter);
    if (origCommit) {
      adapter.commitAudio = () => { try { markCommit(); } catch(_){} return origCommit(); };
    }
    adapter.onMessage((evt) => {
      // Normalize to unified transcript events
  const unified = normalize(provider, evt);
      if (!unified || unified.length === 0) return;
      for (const u of unified) {
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

  _resetSecondWindowIfNeeded(session, now) {
    const secWindowMs = 1000;
    if (now - session.rate.secWindowStart >= secWindowMs) {
      session.rate.secWindowStart = now;
      session.rate.bytesInSecond = 0;
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
    const sr = session.rate.sampleRate || 16000;
    const bpsLimit = bytesPerSecond(sr, 1);
    const now = Date.now();
    const secResetMs = Math.max(0, 1000 - (now - session.rate.secWindowStart));
    const minResetMs = Math.max(0, 60000 - (now - session.rate.minWindowStart));
    this._safeSend(session.ws, {
      type: 'rate_limits.updated',
      second: {
        remaining_bytes: Math.max(0, bpsLimit - session.rate.bytesInSecond),
        limit_bytes: bpsLimit,
        reset_ms: secResetMs,
      },
      minute: {
        used_ms: session.rate.audioMsInMinute,
        limit_ms: (config.realtime?.limits?.apm_audio_seconds_per_min || 180) * 1000,
        reset_ms: minResetMs,
      },
    });
  }

  _handleAudioAppend(session, msg) {
    const audioB64 = msg?.audio;
    if (typeof audioB64 !== 'string' || audioB64.length === 0) {
      throw new Error('audio field (base64) required');
    }

    const sr = session.rate.sampleRate || 16000;
    const now = Date.now();
    this._resetSecondWindowIfNeeded(session, now);
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

    // Per-second throughput limit (raw PCM bps)
    const bpsLimit = bytesPerSecond(sr, 1);
    const canSendInSecond = (session.rate.bytesInSecond + estBytes) <= bpsLimit;

    // Backpressure from adapter or per-second limit => enqueue
    let sent = false;
    if (canSendInSecond && session.upstream?.adapter?.appendAudioBase64) {
      try {
        const ok = session.upstream.adapter.appendAudioBase64(audioB64);
        if (ok !== false) {
          // Success; account usage
          session.rate.bytesInSecond += estBytes;
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
      // Heuristic: if we attempted to send and failed (sent=false) while seconds window allowed, treat as backpressure
      if (canSendInSecond) {
        this._pauseClientRead(session, 'upstream_backpressure');
      }

      if (!session.rate.draining) {
        this._scheduleDrain(session, targetChunkMs);
      }
    }
  }

  _scheduleDrain(session, delayMs) {
    if (session.rate.draining) return;
    session.rate.draining = true;
    const run = () => {
      try {
        const sr = session.rate.sampleRate || 16000;
        const now = Date.now();
        this._resetSecondWindowIfNeeded(session, now);
        this._resetMinuteWindowIfNeeded(session, now);
        const bpsLimit = bytesPerSecond(sr, 1);
        const apmLimitMs = (config.realtime?.limits?.apm_audio_seconds_per_min || 180) * 1000;

        while (session.rate.queue.length > 0) {
          const next = session.rate.queue[0];
          // Check limits
          if (session.rate.audioMsInMinute + next.durationMs > apmLimitMs) {
            // Can't send now; wait for minute window reset
            break;
          }
          if (session.rate.bytesInSecond + next.estBytes > bpsLimit) {
            // Wait for second window reset
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
          session.rate.bytesInSecond += next.estBytes;
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
