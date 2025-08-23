// Minimal WS smoke test against /v1/realtime/transcription
// Usage: node examples/javascript/realtime-smoke.js

const WebSocket = require('ws');

const HOST = process.env.GATEWAY_HOST || 'localhost';
const PORT = process.env.GATEWAY_PORT || 8080;
const MODEL = process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2025-06-03';

const url = `ws://${HOST}:${PORT}/v1/realtime/transcription?model=${encodeURIComponent(MODEL)}`;

/* eslint-disable no-console */
const ws = new WebSocket(url);

function done(exitCode = 0) {
  try { ws.close(); } catch (e) { /* ignore */ }
  setTimeout(() => process.exit(exitCode), 200);
}

ws.on('open', () => {
  console.log('Connected to gateway WS:', url);
});

let gotCreated = false;
let gotUpdated = false;

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('Event:', msg);
    if (msg.type === 'session.created') {
      gotCreated = true;
      // Send a simple session.update to get an ack
      ws.send(JSON.stringify({ type: 'session.update', modalities: ['text'] }));
    } else if (msg.type === 'session.updated') {
      gotUpdated = true;
      console.log('Smoke test success: session.created + session.updated');
      done(0);
    } else if (msg.type === 'error') {
      console.error('Error from server:', msg);
      done(1);
    }
  } catch (err) {
    console.error('Bad JSON from server:', err.message);
    done(1);
  }
});

ws.on('error', (err) => {
  console.error('WS error:', err.message);
  done(1);
});

setTimeout(() => {
  if (!gotCreated || !gotUpdated) {
    console.error('Timeout waiting for expected events');
    done(1);
  }
}, 8000);
