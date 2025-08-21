const WebSocket = require('ws');
const { startOpenAIMockServer } = require('./openai.mock-server');
const { startGeminiMockServer } = require('./gemini.mock-server');

// Helper to open a WS to the gateway and collect events
function connectToGateway({ host = 'localhost', port, model, provider }) {
  return new Promise((resolve, reject) => {
    const url = `ws://${host}:${port}/v1/realtime/transcribe?model=${encodeURIComponent(model)}&provider=${encodeURIComponent(provider)}`;
    const ws = new WebSocket(url);
    const events = [];
    ws.on('open', () => resolve({ ws, events }));
    ws.on('message', (data) => {
      try { events.push(JSON.parse(data.toString())); } catch {}
    });
    ws.on('error', (e) => reject(e));
  });
}

// Helper to close a WebSocket and wait for the close event to ensure no lingering handles
function closeAndWait(ws) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState === ws.CLOSED) return resolve();
    try {
      ws.once('close', () => resolve());
      ws.close();
    } catch (e) {
      return resolve();
    }
  });
}

describe('Gateway Realtime Integration (with mock providers)', () => {
  let originalEnv;
  let gatewayPort = 8081;
  let serverMod;

  beforeAll(async () => {
    jest.setTimeout(30000);
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';

    // Start gateway once for all tests
    const app = require('../../../src/app');
    serverMod = require('../../../src/server');
    await serverMod.start(app);
    const status = serverMod.getStatus();
    gatewayPort = status.address.port || gatewayPort;
  });

  afterAll(async () => {
    try { await serverMod?.stop(); } catch {}
    process.env = originalEnv;
  });

  test('OpenAI path: transcript normalization', async () => {
    const { server, port: mockPort } = await startOpenAIMockServer(0);
    process.env.OPENAI_REALTIME_WS_URL = `ws://127.0.0.1:${mockPort}/v1/realtime`;
    try {
      const { ws, events } = await connectToGateway({ port: gatewayPort, model: 'gpt-4o-realtime-preview-2025-06-03', provider: 'openai' });
      // Wait for initial session.created then send minimal messages
      await new Promise(r => setTimeout(r, 50));
      ws.send(JSON.stringify({ type: 'session.update', session: { modalities: ['text'] } }));
      ws.send(JSON.stringify({ type: 'response.create', response: {} }));
      await new Promise(r => setTimeout(r, 200));

      // Expect normalized transcript events
      const types = events.map(e => e.type);
      expect(types).toContain('session.created');
      expect(types).toContain('transcript.delta');
      expect(types).toContain('transcript.done');
      expect(types).toContain('rate_limits.updated');
  await closeAndWait(ws);
    } finally {
      await new Promise(r => server.close(r));
    }
  });

  test('Gemini path: transcript normalization', async () => {
    const { server, port: mockPort } = await startGeminiMockServer(0);
    process.env.GEMINI_LIVE_WS_URL = `ws://127.0.0.1:${mockPort}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`;
    try {
      const { ws, events } = await connectToGateway({ port: gatewayPort, model: 'gemini-live-2.5-flash-preview', provider: 'gemini' });
      // Trigger minimal setup and bind adapter
      ws.send(JSON.stringify({ type: 'session.update', session: { modalities: ['text'] } }));
      ws.send(JSON.stringify({ type: 'response.create', response: {} }));
      // Wait up to 1s for events
      for (let i = 0; i < 10; i++) { // 10 * 100ms = 1s
        await new Promise(r => setTimeout(r, 100));
        const types = events.map(e => e.type);
        if (types.includes('transcript.done')) break;
      }
      const types = events.map(e => e.type);
      expect(types).toContain('session.created');
      expect(types).toContain('transcript.delta');
      expect(types).toContain('transcript.done');
  await closeAndWait(ws);
    } finally {
      await new Promise(r => server.close(r));
    }
  });
});
