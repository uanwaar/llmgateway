const WebSocket = require('ws');
const { startGeminiMockServer } = require('../integration/realtime/gemini.mock-server');

function connectToGateway({ host = 'localhost', port, model, provider }) {
  return new Promise((resolve, reject) => {
    const url = `ws://${host}:${port}/v1/realtime/transcribe?model=${encodeURIComponent(model)}&provider=${encodeURIComponent(provider)}`;
    const ws = new WebSocket(url);
    const events = [];
    ws.on('open', () => resolve({ ws, events }));
    ws.on('message', (data) => { try { events.push(JSON.parse(data.toString())); } catch {} });
    ws.on('error', reject);
  });
}

describe('Realtime E2E smoke (Gemini)', () => {
  let serverMod;
  let gatewayPort;
  let mock;

  beforeAll(async () => {
    jest.setTimeout(45000);
    process.env.NODE_ENV = 'test';
    // Start mock Gemini Live server and point gateway to it
    mock = await startGeminiMockServer(0);
    process.env.GEMINI_LIVE_WS_URL = `ws://127.0.0.1:${mock.port}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`;

    const app = require('../../src/app');
    serverMod = require('../../src/server');
    await serverMod.start(app);
    gatewayPort = serverMod.getStatus().address.port;
  });

  afterAll(async () => {
    try { await serverMod?.stop(); } catch {}
    try { await new Promise(r => mock?.server?.close(r)); } catch {}
  });

  test('Gemini realtime basic yields transcript events', async () => {
    const { ws, events } = await connectToGateway({ port: gatewayPort, model: 'gemini-live-2.5-flash-preview', provider: 'gemini' });
    // Trigger adapter binding and provider setup
    ws.send(JSON.stringify({ type: 'session.update', session: { modalities: ['text'] } }));
    ws.send(JSON.stringify({ type: 'response.create', response: {} }));

    // wait for transcript.done or timeout
    for (let i = 0; i < 20; i++) { // 2s
      await new Promise(r => setTimeout(r, 100));
      const types = events.map(e => e.type);
      if (types.includes('transcript.done')) break;
    }

    const types = events.map(e => e.type);
    expect(types).toContain('session.created');
    expect(types).toContain('transcript.delta');
    expect(types).toContain('transcript.done');
    ws.close();
  });
});
