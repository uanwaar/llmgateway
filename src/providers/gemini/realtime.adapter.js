/**
 * Gemini Live Adapter (SDK-backed)
 * - Uses @google/genai SDK for Live transcription
 * - Maps gateway events to SDK calls
 * - Emits upstream provider events; service normalizes to unified schema
 */

let GoogleGenAI;
try {
  ({ GoogleGenAI } = require('@google/genai'));
} catch (_) {
  // Dependency may not be installed yet; adapter will throw on use
}

const logger = require('../../utils/logger');
const { mapGeminiRealtimeInputConfig } = require('../../utils/vad');

class GeminiRealtimeAdapter {
  constructor({ apiKey, model, maxQueue } = {}) {
    this.apiKey = apiKey;
    this.model = model || 'gemini-2.0-flash-live-001';
    this.ai = GoogleGenAI ? new GoogleGenAI({ apiKey: this.apiKey }) : null;
    this.session = null;
    this._inboundQueue = [];
    this._outboundQueue = [];
    this._maxQueue = typeof maxQueue === 'number' && maxQueue > 0 ? maxQueue : 1000;
    this._onMessage = null;
    this._onError = null;
    this._onClose = null;
  }

  async connect({ systemInstruction, vad } = {}) {
    if (!this.ai) throw new Error('Missing @google/genai dependency');
    this.session = await this.ai.live.connect({
      model: this.model,
      config: {
        responseModalities: ['TEXT'],
        systemInstruction,
        inputAudioTranscription: {},
        realtimeInputConfig: mapGeminiRealtimeInputConfig(vad),
      },
      callbacks: {
        onopen: () => {
          logger.info('Gemini live connected');
          // Flush any outbound messages queued before open
          if (this._outboundQueue.length) {
            for (const fn of this._outboundQueue) {
              try { fn(); } catch (_) {}
            }
            this._outboundQueue = [];
          }
          // Flush any inbound events queued before onMessage set
          this._flushInbound();
        },
        onmessage: (msg) => this._pushInbound(msg),
        onerror: (e) => {
          logger.error('Gemini live error', { error: e?.message });
          if (this._onError) try { this._onError(e); } catch (_) {}
        },
        onclose: (e) => {
          logger.info('Gemini live closed', { reason: e?.reason });
          if (this._onClose) try { this._onClose(e); } catch (_) {}
        },
      },
    });
  }

  // Send base64 PCM16 16kHz mono audio
  appendAudioBase64(base64) {
    if (!base64) return false;
    const sendFn = () => {
      try {
        this.session?.sendRealtimeInput({
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
        });
      } catch (_) { /* ignore */ }
    };
    if (this.isConnected()) {
      sendFn();
      return true;
    }
    this._enqueueOutbound(sendFn);
    return false;
  }

  // For manual VAD, represent commit as turnComplete using client content with empty turns
  commitAudio() {
    const sendFn = () => {
      try {
        if (this.session && typeof this.session.sendClientContent === 'function') {
          this.session.sendClientContent({ turns: [], turnComplete: true });
        } else if (this.session && typeof this.session.sendRealtimeInput === 'function') {
          // Some SDK versions accept an activity marker; if not supported, this is a no-op
          this.session.sendRealtimeInput({});
        }
      } catch (_) { /* ignore */ }
    };
    if (this.isConnected()) { sendFn(); return true; }
    this._enqueueOutbound(sendFn);
    return false;
  }

  onMessage(cb) {
    this._onMessage = cb;
    this._flushInbound();
  }

  onError(cb) { this._onError = cb; }
  onClose(cb) { this._onClose = cb; }

  isConnected() { return !!this.session; }

  close() {
    try { this.session?.close(); } catch (_) {}
  }

  _pushInbound(msg) {
    if (this._onMessage) this._onMessage(msg);
    else this._inboundQueue.push(msg);
  }

  _flushInbound() {
    if (this._onMessage && this._inboundQueue.length) {
      for (const msg of this._inboundQueue) {
        try { this._onMessage(msg); } catch (_) {}
      }
      this._inboundQueue = [];
    }
  }

  _enqueueOutbound(fn) {
    if (this._outboundQueue.length >= this._maxQueue) {
      this._outboundQueue.shift();
      logger.warn('Gemini realtime send queue capped; dropped oldest', { maxQueue: this._maxQueue });
    }
    this._outboundQueue.push(fn);
  }
}

module.exports = GeminiRealtimeAdapter;
