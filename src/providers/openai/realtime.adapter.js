const WebSocket = require('ws');
const logger = require('../../utils/logger');
const config = require('../../config');
const { normalizeOpenAI } = require('../../utils/realtime-normalizer');

/**
 * OpenAI Realtime Adapter (WebSocket)
 * - Connects to wss://api.openai.com/v1/realtime?model=<model>
 * - Headers: Authorization: Bearer <token>, OpenAI-Beta: realtime=v1
 * - Maps gateway input events to OpenAI events
 */
class OpenAIRealtimeAdapter {
  constructor({ model, token, initialConfig, onEvent, onError, onClose }) {
    this.model = model;
    this.token = token || config.providers.openai.apiKey;
    this.initialConfig = initialConfig || null;
    this.onEvent = onEvent;
    this.onError = onError;
    this.onClose = onClose;
    this.ws = null;
    this.ready = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
  const base = process.env.OPENAI_REALTIME_WS_URL || 'wss://api.openai.com/v1/realtime';
        const url = `${base}?model=${encodeURIComponent(this.model)}`;
        const headers = {
          Authorization: `Bearer ${this.token}`,
          'OpenAI-Beta': 'realtime=v1',
        };

        this.ws = new WebSocket(url, { headers });

        this.ws.on('open', () => {
          this.ready = true;
          logger.info('OpenAI Realtime connected', { model: this.model });
          // Apply initial session config if provided
          if (this.initialConfig) {
            try { this.ws.send(JSON.stringify({ type: 'session.update', session: this.initialConfig })); } catch (e) {}
          }
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const evt = JSON.parse(data.toString());
            const normalized = normalizeOpenAI(evt);
            if (normalized && this.onEvent) this.onEvent(normalized, evt);
          } catch (err) {
            logger.warn('OpenAI WS message parse error', { error: err.message });
          }
        });

        this.ws.on('error', (err) => {
          logger.error('OpenAI WS error', { error: err.message });
          if (this.onError) this.onError(err);
        });

        this.ws.on('close', (code, reason) => {
          logger.info('OpenAI WS closed', { code, reason: reason?.toString() });
          if (this.onClose) this.onClose(code, reason);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send a provider-specific event to OpenAI.
   * The gateway will call this with normalized client events:
   * - input_audio.append => input_audio_buffer.append
   * - input_audio.commit => input_audio_buffer.commit
   * - input_audio.clear => input_audio_buffer.clear
   * - session.update => session.update
   * - response.create => response.create
   */
  sendGatewayEvent(evt) {
    if (!this.ready || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const { type } = evt || {};
    let out = null;

    switch (type) {
    case 'session.update':
      out = { type: 'session.update', session: evt.session || {} };
      break;
    case 'input_audio.append':
      out = { type: 'input_audio_buffer.append', audio: evt.audio };
      break;
    case 'input_audio.commit':
      out = { type: 'input_audio_buffer.commit' };
      break;
    case 'input_audio.clear':
      out = { type: 'input_audio_buffer.clear' };
      break;
    case 'response.create':
      out = { type: 'response.create', response: evt.response || {} };
      break;
    default:
      return; // ignore unknown types
    }

    try {
      this.ws.send(JSON.stringify(out));
    } catch (err) {
      logger.warn('OpenAI WS send failed', { error: err.message });
    }
  }

  close() {
    try { this.ws?.close(); } catch (e) { /* ignore */ }
  }
}

module.exports = OpenAIRealtimeAdapter;
