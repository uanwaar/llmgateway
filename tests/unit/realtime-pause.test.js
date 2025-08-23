const svc = require('../../src/services/realtime.service');

class MockWS {
  constructor() {
    this.sent = [];
    this.closed = false;
    // minimal _socket shim
    this._socket = {
      paused: false,
      pause: () => { this._socket.paused = true; },
      resume: () => { this._socket.paused = false; },
    };
  }
  send(msg) { this.sent.push(JSON.parse(msg)); }
  close() { this.closed = true; }
}

class BackpressureAdapter {
  connect() { return Promise.resolve(); }
  onMessage() {}
  appendAudioBase64() { return false; }
  commitAudio() {}
  clearAudio() {}
  close() {}
}

function installAdapterShim(service, adapter) {
  service.ensureUpstream = async (session) => {
    if (session.upstream.connected && session.upstream.adapter) return;
    session.upstream.adapter = adapter;
    session.upstream.connected = true;
  };
}

function b64Silence(ms, sr = 16000) {
  const samples = Math.floor((sr * ms) / 1000);
  return Buffer.alloc(samples * 2, 0).toString('base64');
}

describe('Pause/Resume on backpressure', () => {
  test('pauses when adapter returns false and resumes after drain threshold', async () => {
    const ws = new MockWS();
    const session = await svc.createSession(ws, {}, { model: 'gemini-live-2.5-flash-preview', provider: 'gemini' });
    installAdapterShim(svc, new BackpressureAdapter());

    const config = require('../../src/config');
    const original = config.realtime.audio.max_buffer_ms;
    config.realtime.audio.max_buffer_ms = 200; // small buffer for quick test

    try {
      // send enough to trigger pause (adapter returns false, will enqueue immediately)
      const msg = { type: 'input_audio.append', audio: b64Silence(120) };
      svc.handleClientMessage(session.id, JSON.stringify(msg));
      await new Promise(r => setTimeout(r, 5));

      // Should have warning for paused and socket paused
      const pausedWarn = ws.sent.find(e => e.type === 'warning' && e.code === 'backpressure_paused');
      expect(pausedWarn).toBeTruthy();
      expect(ws._socket.paused).toBe(true);

  // Now swap adapter on the active session to accepting to allow drain
  session.upstream.adapter = { appendAudioBase64: () => true, onMessage() {}, connect: async()=>{}, close(){}, commitAudio(){}, clearAudio(){} };

      // Kick drain loop sooner
      await new Promise(r => setTimeout(r, 60));

      const resumedWarn = ws.sent.find(e => e.type === 'warning' && e.code === 'backpressure_resumed');
      expect(resumedWarn).toBeTruthy();
      expect(ws._socket.paused).toBe(false);
    } finally {
      config.realtime.audio.max_buffer_ms = original;
      svc.closeSession(session.id);
    }
  });
});
