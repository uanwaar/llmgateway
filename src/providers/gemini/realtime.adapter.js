const WebSocket = require('ws');
const logger = require('../../utils/logger');
const config = require('../../config');
const { normalizeGemini } = require('../../utils/realtime-normalizer');

/**
 * Gemini Live Realtime Adapter (WebSocket)
 * - Endpoint: wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
 * - Auth: Authorization: Bearer <token> (v1), or Token <ephemeral> (v1alpha) depending on token supplied
 * - Initial setup message configures response modalities and VAD.
 */
class GeminiRealtimeAdapter {
  constructor({ model, token, vadMode = 'server_vad', language, initialConfig, onEvent, onError, onClose }) {
    this.model = model;
    this.token = token || config.providers.gemini.apiKey;
    this.vadMode = vadMode;
    this.language = language;
    this.initialConfig = initialConfig || null;
    this.onEvent = onEvent;
    this.onError = onError;
    this.onClose = onClose;
    this.ws = null;
    this.ready = false;
    this.aadEnabled = vadMode !== 'manual';
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
  const url = process.env.GEMINI_LIVE_WS_URL || 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
        // Gemini supports Bearer tokens; ephemeral tokens may require different prefix "Token"
        const isEphemeral = this.token?.startsWith('gl-') || this.token?.startsWith('ep_');
        const headers = {
          Authorization: `${isEphemeral ? 'Token' : 'Bearer'} ${this.token}`,
        };

        this.ws = new WebSocket(url, { headers });

        this.ws.on('open', () => {
          this.ready = true;
          logger.info('Gemini Live connected', { model: this.model });
          // Send setup message
          const setup = {
            setup: {
              model: this.model,
              generationConfig: { responseModalities: ['TEXT'] },
            },
          };
          if (this.initialConfig?.instructions) {
            setup.setup.systemInstruction = this.initialConfig.instructions;
          }
          if (this.aadEnabled) {
            setup.realtimeInputConfig = {
              automaticActivityDetection: {
                disabled: false,
              },
            };
          } else {
            setup.realtimeInputConfig = { automaticActivityDetection: { disabled: true } };
          }
          try { this.ws.send(JSON.stringify(setup)); } catch (e) {}
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const evt = JSON.parse(data.toString());
            const normalized = normalizeGemini(evt);
            if (normalized && this.onEvent) this.onEvent(normalized, evt);
          } catch (err) {
            logger.warn('Gemini WS message parse error', { error: err.message });
          }
        });

        this.ws.on('error', (err) => {
          logger.error('Gemini WS error', { error: err.message });
          if (this.onError) this.onError(err);
        });

        this.ws.on('close', (code, reason) => {
          logger.info('Gemini WS closed', { code, reason: reason?.toString() });
          if (this.onClose) this.onClose(code, reason);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Map gateway events to Gemini Live messages
   */
  sendGatewayEvent(evt) {
    if (!this.ready || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const { type } = evt || {};
    let out = null;
    switch (type) {
    case 'session.update': {
      // Gemini primarily uses initial setup; we can send clientContent to alter context
      // Keep minimal support
      if (evt.session?.instructions) {
        out = {
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: evt.session.instructions }] }],
            turnComplete: false,
          },
        };
      }
      break;
    }
    case 'input_audio.append':
      out = {
        realtimeInput: {
          audio: {
            data: evt.audio, // base64
            mimeType: 'audio/pcm;rate=16000',
          },
        },
      };
      break;
    case 'input_audio.commit':
      if (this.aadEnabled) {
        // With AAD, commits are automatic; may be a no-op
        out = null;
      } else {
        // Manual VAD: mark turn complete to trigger processing
        out = { clientContent: { turns: [], turnComplete: true } };
      }
      break;
    case 'input_audio.clear':
      out = null; // no direct equivalent; ignore
      break;
    case 'response.create':
      // Manual VAD path: ensure turnComplete to trigger
      out = { clientContent: { turns: [], turnComplete: true } };
      break;
    default:
      out = null;
    }

    if (!out) return;
    try { this.ws.send(JSON.stringify(out)); } catch (err) {
      logger.warn('Gemini WS send failed', { error: err.message });
    }
  }

  close() {
    try { this.ws?.close(); } catch (e) { /* ignore */ }
  }
}

module.exports = GeminiRealtimeAdapter;
