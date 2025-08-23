/*
 E2E test: OpenAI Realtime transcription via actual provider
 Requires: process.env.OPENAI_API_KEY
*/

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// We'll require the server inside beforeAll after setting env so it picks up the test port.
let initialize;
let shutdown;

const TEST_PORT = 8086;
const WS_PATH = '/v1/realtime/transcription';

function readWavBase64(p) {
  const buf = fs.readFileSync(p);
  return buf.toString('base64');
}

function waitForEvent(ws, predicate, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
    if (typeof ws.off === 'function') ws.off('message', onMessage);
    else if (typeof ws.removeListener === 'function') ws.removeListener('message', onMessage);
      reject(new Error('timeout waiting for event'));
    }, timeoutMs);

  function onMessage(data) {
      try {
    const text = typeof data === 'string' ? data : data.toString();
    const msg = JSON.parse(text);
        if (predicate(msg)) {
          clearTimeout(timer);
      if (typeof ws.off === 'function') ws.off('message', onMessage);
      else if (typeof ws.removeListener === 'function') ws.removeListener('message', onMessage);
          resolve(msg);
        }
      } catch (_) {}
    }
    ws.on('message', onMessage);
  });
}

const maybeDescribe = (process.env.RUN_E2E_REALTIME === '1' && process.env.OPENAI_API_KEY)
  ? describe
  : describe.skip;

maybeDescribe('E2E OpenAI Realtime', () => {
  beforeAll(async () => {
    process.env.GATEWAY_PORT = String(TEST_PORT);
    process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  ({ initialize, shutdown } = require('../../src/index'));
  await initialize();
  }, 30000);

  afterAll(async () => {
    await shutdown('JEST');
  }, 30000);

  test('streams audio and receives transcript events (OpenAI)', async () => {
    const url = `ws://localhost:${TEST_PORT}${WS_PATH}`;
    const ws = new WebSocket(url);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    // Expect session.created
    await waitForEvent(ws, (m) => m && m.type === 'session.created', 10000);

    // session.update for OpenAI model and manual VAD
    ws.send(JSON.stringify({
      type: 'session.update',
      model: 'gpt-4o-realtime-preview-2025-06-03',
      vad: { type: 'manual' },
    }));
    await waitForEvent(ws, (m) => m && m.type === 'session.updated', 10000);

    // Append 24KHz audio chunk then commit
    const audioPath = path.join(__dirname, '..', 'audio-files', '24KHz', '3s.wav');
    const b64 = readWavBase64(audioPath);

    ws.send(JSON.stringify({ type: 'input_audio.append', audio: b64 }));
    ws.send(JSON.stringify({ type: 'input_audio.commit' }));

    // Wait for either transcript.delta or transcript.done
    const first = await waitForEvent(
      ws,
      (m) => m && (m.type === 'transcript.delta' || m.type === 'transcript.done' || m.type === 'error'),
      60000
    );

    if (first && first.type === 'error') {
      throw new Error(`Gateway error: ${first.code || ''} ${first.message || ''}`);
    }

    // Close and wait for socket to end to avoid handle leaks
    await new Promise((resolve) => {
      ws.once('close', resolve);
      ws.close();
    });
  }, 120000);
});
