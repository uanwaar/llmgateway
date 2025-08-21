const WebSocket = require('ws');

function startOpenAIMockServer(port = 0) {
  return new Promise((resolve) => {
    const server = new WebSocket.Server({ port });
    server.on('connection', (ws) => {
      // Emit a transcript delta then done and a rate_limits.updated
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'rate_limits.updated', rate_limits: [{ name: 'requests', limit: 1000, remaining: 999, reset_seconds: 60 }] }));
        ws.send(JSON.stringify({ type: 'response.audio_transcript.delta', delta: 'Hello ' }));
        ws.send(JSON.stringify({ type: 'response.audio_transcript.delta', delta: 'world' }));
        ws.send(JSON.stringify({ type: 'response.audio_transcript.done', transcript: 'Hello world' }));
      }, 50);

  ws.on('message', (_data) => {
        // Accept incoming events; do nothing
      });
    });
    server.on('listening', () => {
      const address = server.address();
      resolve({ server, port: address.port, url: `ws://127.0.0.1:${address.port}/v1/realtime` });
    });
  });
}

module.exports = { startOpenAIMockServer };
