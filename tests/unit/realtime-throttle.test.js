// Load service module
require('../../src/services/realtime.service');

// Minimal mock WebSocket
class MockWS {
  constructor() {
    this.sent = [];
    this.closed = false;
  }
  send(msg) {
    this.sent.push(JSON.parse(msg));
  }
  close() {
    this.closed = true;
  }
}

// Mock adapter that always accepts appends
class AcceptingAdapter {
  constructor() { this._onMessage = null; }
  connect() { return Promise.resolve(); }
  onMessage(cb) { this._onMessage = cb; }
  appendAudioBase64() { return true; }
  commitAudio() { /* noop */ }
  clearAudio() { /* noop */ }
  close() { /* noop */ }
}

// Inject adapters by monkey patching ensureUpstream to avoid real network
function installAdapterShim(service, adapter) {
  service.ensureUpstream = async (session) => {
    if (session.upstream.connected && session.upstream.adapter) return;
    session.upstream.adapter = adapter;
    session.upstream.connected = true;
    // No upstream messages in this unit test
  };
}

function b64SilencePcm16Ms(ms, sampleRate = 16000) {
  const samples = Math.floor((sampleRate * ms) / 1000);
  const buf = Buffer.alloc(samples * 2, 0);
  return buf.toString('base64');
}

describe('RealtimeService T11 rate limits/backpressure', () => {
  test('enforces APM minute limit and emits error + rate_limits.updated', async () => {
    const svc = require('../../src/services/realtime.service');
    const ws = new MockWS();
    const session = await svc.createSession(ws, {}, { model: 'gemini-live-2.5-flash-preview', provider: 'gemini' });

    // Replace upstream with accepting adapter
    installAdapterShim(svc, new AcceptingAdapter());

    // Configure minute limit very small by mutating config at runtime
    const config = require('../../src/config');
    const original = config.realtime.limits.apm_audio_seconds_per_min;
    config.realtime.limits.apm_audio_seconds_per_min = 1; // 1s per minute

    try {
      // Append 900ms then 200ms (should exceed and error on second)
      const m1 = { type: 'input_audio.append', audio: b64SilencePcm16Ms(900) };
      const m2 = { type: 'input_audio.append', audio: b64SilencePcm16Ms(200) };

  svc.handleClientMessage(session.id, JSON.stringify(m1));
  svc.handleClientMessage(session.id, JSON.stringify(m2));
  // Wait a tick for async ensureUpstream.then() to run handlers
  await new Promise(r => setTimeout(r, 5));

  // Inspect ws.sent for an error with code 'apm_exceeded'
  // Debug output (optional)
  // eslint-disable-next-line no-console
  // console.log(ws.sent);
      const hasApmError = ws.sent.some(e => e.type === 'error' && e.code === 'apm_exceeded');
      expect(hasApmError).toBe(true);
      const hasRateUpdate = ws.sent.some(e => e.type === 'rate_limits.updated');
      expect(hasRateUpdate).toBe(true);
    } finally {
      // restore
      config.realtime.limits.apm_audio_seconds_per_min = original;
      svc.closeSession(session.id);
    }
  });
});
