/**
 * OpenAI Realtime Adapter (Transcription intent)
 * - Connects to OpenAI Realtime WS with intent=transcription
 * - Sends transcription_session.update and audio buffer operations
 * - Emits upstream provider events to the service for normalization
 */

const WebSocket = require('ws');
const logger = require('../../utils/logger');
const { mapOpenAITurnDetection } = require('../../utils/vad');

class OpenAIRealtimeAdapter {
  constructor({ apiKey, model, url, maxQueue } = {}) {
    this.apiKey = apiKey;
    this.model = model; // transcription model: gpt-4o-transcribe | gpt-4o-mini-transcribe | whisper-1
    this.url = url || 'wss://api.openai.com/v1/realtime?intent=transcription';
    this.ws = null;
    this._queue = [];
    this._maxQueue = typeof maxQueue === 'number' && maxQueue > 0 ? maxQueue : 1000;
    this._onMessage = null;
    this._onError = null;
    this._onClose = null;
    this._heartbeat = null;
  }

  connect({ timeoutMs = 15000 } = {}) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        });

        let settled = false;
        const safeResolve = (val) => { if (!settled) { settled = true; resolve(val); } };
        const safeReject = (err) => { if (!settled) { settled = true; reject(err); } };

        const onOpen = () => {
          logger.info('OpenAI realtime connected');
          // Flush any queued messages
          if (this._queue.length) {
            for (const msg of this._queue) {
              this._rawSend(msg);
            }
            this._queue = [];
          }
          // Start heartbeat ping to keep connection alive
          this._startHeartbeat();
          safeResolve();
        };
        this.ws.on('open', onOpen);

        this.ws.on('message', (data) => {
          try {
            const evt = JSON.parse(data.toString());
            this._onMessage && this._onMessage(evt);
          } catch (e) {
            logger.warn('OpenAI realtime parse error');
          }
        });

        this.ws.on('error', (err) => {
          logger.error('OpenAI realtime error', { error: err?.message });
          if (this._onError) {
            try { this._onError(err); } catch (_) {}
          }
          try { clearTimeout(timer); } catch (_) {}
          safeReject(err);
        });

        this.ws.on('close', (code, reason) => {
          logger.info('OpenAI realtime closed', { code, reason: reason?.toString() });
          this._stopHeartbeat();
          if (this._onClose) {
            try { this._onClose(code, reason); } catch (_) {}
          }
          try { clearTimeout(timer); } catch (_) {}
          if (!settled) safeReject(new Error(`OpenAI realtime closed before ready: ${code}`));
        });

        // Safety timeout
        const timer = setTimeout(() => {
          try { this.ws?.removeListener('open', onOpen); } catch (_) {}
          // kill the socket to avoid stray connection attempt
          try { if (this.ws && typeof this.ws.terminate === 'function') this.ws.terminate(); else this.ws?.close(); } catch (_) {}
          safeReject(new Error('OpenAI realtime connect timeout'));
        }, timeoutMs);
        this.ws.once('open', () => clearTimeout(timer));
      } catch (e) {
        reject(e);
      }
    });
  }

  // Send transcription session config
  sendSessionUpdate({ language, vad, include, prompt } = {}) {
    const msg = {
      type: 'transcription_session.update',
      session: {
        input_audio_format: 'pcm16',
        input_audio_transcription: {
          model: this.model,
          language,
          prompt,
        },
        turn_detection: mapOpenAITurnDetection(vad),
        include,
      },
    };
  return this._send(msg);
  }

  appendAudioBase64(base64) {
  if (!base64) return false;
  return this._send({ type: 'input_audio_buffer.append', audio: base64 });
  }

  commitAudio() {
  return this._send({ type: 'input_audio_buffer.commit' });
  }

  clearAudio() {
  return this._send({ type: 'input_audio_buffer.clear' });
  }

  onMessage(cb) {
    this._onMessage = cb;
    // If socket is already set up, we already attached a message listener in connect
  }

  onError(cb) { this._onError = cb; }
  onClose(cb) { this._onClose = cb; }

  isConnected() {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  close() {
    try {
      this._stopHeartbeat();
      this.ws?.close();
    } catch (_) {}
  }

  _send(obj) {
    try {
      const payload = JSON.stringify(obj);
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(payload);
        return true;
      }
      // Not open: queue with cap
      if (this._queue.length >= this._maxQueue) {
        this._queue.shift();
        logger.warn('OpenAI realtime send queue capped; dropped oldest', { maxQueue: this._maxQueue });
      }
      this._queue.push(payload);
      return false;
    } catch (e) {
      logger.warn('OpenAI send failed');
      return false;
    }
  }

  _rawSend(payload) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
      } else {
        this._queue.push(payload);
      }
    } catch (_) {
      // swallow
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    // Send ping every 20s; if fails, let ws close naturally
    this._heartbeat = setInterval(() => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          if (typeof this.ws.ping === 'function') {
            this.ws.ping();
          }
        }
      } catch (_) { /* ignore */ }
    }, 20000);
  }

  _stopHeartbeat() {
    if (this._heartbeat) {
      clearInterval(this._heartbeat);
      this._heartbeat = null;
    }
  }
}

module.exports = OpenAIRealtimeAdapter;
