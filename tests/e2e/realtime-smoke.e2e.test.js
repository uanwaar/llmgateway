const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { startOpenAIMockServer } = require('../integration/realtime/openai.mock-server');

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

function pcm16Chunks(filePath, chunkMs = 50, sampleRate = 24000) {
  const buf = fs.readFileSync(filePath);
  const bytesPerSample = 2; // PCM16
  const bytesPerMs = (sampleRate * bytesPerSample) / 1000;
  const chunkBytes = Math.max(bytesPerMs * chunkMs, 2);
  const chunks = [];
  for (let i = 0; i < buf.length; i += chunkBytes) {
    chunks.push(buf.slice(i, Math.min(i + chunkBytes, buf.length)));
  }
  return chunks;
}

function b64(b) { return Buffer.from(b).toString('base64'); }

describe('Realtime E2E smoke', () => {
  let serverMod;
  let gatewayPort;
  let mock;
  beforeAll(async () => {
    jest.setTimeout(45000);
    process.env.NODE_ENV = 'test';
    // Start mock OpenAI realtime server and point gateway to it
    mock = await startOpenAIMockServer(0);
    process.env.OPENAI_REALTIME_WS_URL = `ws://127.0.0.1:${mock.port}/v1/realtime`;

    const app = require('../../src/app');
    serverMod = require('../../src/server');
    await serverMod.start(app);
    gatewayPort = serverMod.getStatus().address.port;
  });
  afterAll(async () => {
    try { await serverMod?.stop(); } catch {}
    try { await new Promise(r => mock?.server?.close(r)); } catch {}
  });

  test('OpenAI realtime basic streaming yields transcript events', async () => {
    const audioPath = path.join(__dirname, '..', 'audio-files', '3s.wav');
    const { ws, events } = await connectToGateway({ port: gatewayPort, model: 'gpt-4o-realtime-preview-2025-06-03', provider: 'openai' });
    // send session.update
    ws.send(JSON.stringify({ type: 'session.update', session: { modalities: ['text'] } }));
    // stream a few chunks then commit and create response
    const chunks = pcm16Chunks(audioPath, 50, 24000);
    for (let i = 0; i < Math.min(6, chunks.length); i++) {
      ws.send(JSON.stringify({ type: 'input_audio.append', audio: b64(chunks[i]) }));
      await new Promise(r => setTimeout(r, 20));
    }
    ws.send(JSON.stringify({ type: 'input_audio.commit' }));
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
  await closeAndWait(ws);
  });
});
