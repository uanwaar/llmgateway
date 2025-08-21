/**
 * Realtime session service (MVP for Phase 1)
 * - Tracks sessions
 * - Emits session.created
 * - Stubs message handling for future phases
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');

class RealtimeService {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Create a new realtime session
   * @param {WebSocket} ws
   * @param {IncomingMessage} request
   * @param {{model?: string, provider?: 'openai'|'gemini'}} opts
   */
  async createSession(ws, request, opts = {}) {
    if (!config.realtime?.enabled) {
      throw new Error('Realtime feature disabled');
    }

    const id = uuidv4();
    const createdAt = Date.now();

    const session = {
      id,
      ws,
      request,
      model: opts.model,
      provider: opts.provider,
      createdAt,
      lastActivity: createdAt,
    };

    this.sessions.set(id, session);
    logger.info('Realtime session created', {
      id,
      model: session.model,
      provider: session.provider,
    });

    // Idle timeout enforcement (Phase 1: log only)
    const idleSeconds = config.realtime.security?.max_idle_seconds || 60;
    session.idleTimer = setInterval(() => {
      const age = Date.now() - session.lastActivity;
      if (age > idleSeconds * 1000) {
        try {
          ws.send(JSON.stringify({ type: 'error', code: 'idle_timeout' }));
        } catch (e) {
          logger.warn('Failed to send idle_timeout');
        }
        try {
          ws.close();
        } catch (e) {
          logger.warn('Failed to close WS on idle');
        }
        this.closeSession(id);
      }
    }, 15000);

    return session;
  }

  /**
   * Handle messages from client (Phase 1: acknowledge and noop)
   */
  handleClientMessage(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.lastActivity = Date.now();

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      try {
        session.ws.send(JSON.stringify({ type: 'error', code: 'bad_json' }));
      } catch (e) {
        logger.warn('Failed to send bad_json');
      }
      return;
    }

    // Phase 1: Just echo minimal ack for session.update
    if (msg && msg.type === 'session.update') {
      try {
        session.ws.send(JSON.stringify({ type: 'session.updated' }));
      } catch (e) {
        logger.warn('Failed to send session.updated');
      }
      return;
    }
  }

  /**
   * Close and cleanup a session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearInterval(session.idleTimer);
    this.sessions.delete(sessionId);
    logger.info('Realtime session closed', { id: sessionId });
  }
}

module.exports = new RealtimeService();
