const WebSocket = require('ws');

function startGeminiMockServer(port = 0) {
  return new Promise((resolve) => {
    const server = new WebSocket.Server({ port });
    server.on('connection', (ws) => {
      // Respond to setup by sending serverContent with text parts
      ws.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(data.toString()); } catch { return; }
        if (msg.setup) {
          setTimeout(() => {
            ws.send(JSON.stringify({
              serverContent: {
                modelTurn: { role: 'model', parts: [{ text: 'Hello ' }] },
                turnComplete: false,
              },
            }));
            ws.send(JSON.stringify({
              serverContent: {
                modelTurn: { role: 'model', parts: [{ text: 'world' }] },
                turnComplete: true,
              },
            }));
          }, 50);
        }
      });
    });
    server.on('listening', () => {
      const address = server.address();
      resolve({ server, port: address.port, url: `ws://127.0.0.1:${address.port}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` });
    });
  });
}

module.exports = { startGeminiMockServer };
