/**
 * Realtime WebSocket controller
 * - Handles WS handshake using ws.Server
 * - Authenticates requests (basic placeholder; integrate middleware later)
 * - Creates session via service and emits session.created
 */

const { WebSocketServer } = require('ws');
const url = require('url');
const logger = require('../utils/logger');
const config = require('../config');
const realtimeService = require('../services/realtime.service');

// Create a shared WebSocketServer in noServer mode
const wss = new WebSocketServer({ noServer: true });

// Handle WS connection after upgrade
wss.on('connection', async (ws, request) => {
  try {
    const { query } = url.parse(request.url, true);

    // Basic auth gate: require Authorization header if configured
    if (config.auth?.requireAuthHeader) {
      const authHeader = request.headers['authorization']
        || request.headers['x-api-key'];
      if (!authHeader) {
        ws.send(JSON.stringify({
          type: 'error',
          code: 'unauthorized',
          message: 'Missing Authorization',
        }));
        return ws.close();
      }
    }

    const session = await realtimeService.createSession(ws, request, {
      model: query.model,
      provider: query.provider,
    });

    // Initial event to client
    ws.send(JSON.stringify({ type: 'session.created', sessionId: session.id }));

    ws.on('message', (data) => {
      realtimeService.handleClientMessage(session.id, data);
    });

    ws.on('close', () => {
      realtimeService.closeSession(session.id);
    });
  } catch (err) {
    logger.error('Realtime WS connection error', { error: err.message });
    try { ws.close(); } catch (e) { /* ignore */ }
  }
});

function handleUpgrade(req, socket, head) {
  wss.handleUpgrade(req, socket, head, (ws, request) => {
    wss.emit('connection', ws, request);
  });
}

module.exports = { handleUpgrade };
