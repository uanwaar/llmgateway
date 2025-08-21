/**
 * HTTP server setup and management
 * 
 * Responsibilities:
 * - Server startup and shutdown
 * - Port binding and listening
 * - SSL/TLS configuration
 * - Health check endpoints
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const config = require('./config');
const logger = require('./utils/logger');
const url = require('url');
const rateLimit = require('./middleware/rateLimit.middleware');

// Lazily required to avoid circular deps if any
let realtimeController;

let server = null;
let forceCloseTimer = null;

/**
 * Start the HTTP/HTTPS server
 * @param {Express} app - Express application instance
 */
async function start(app) {
  return new Promise((resolve, reject) => {
  const port = (config.server && typeof config.server.port !== 'undefined') ? config.server.port : 8080;
    const host = config.server.host || '0.0.0.0';

    // Create server (HTTP or HTTPS based on config)
    if (config.server.ssl && config.server.ssl.enabled) {
      const sslOptions = {
        key: fs.readFileSync(config.server.ssl.keyPath),
        cert: fs.readFileSync(config.server.ssl.certPath),
      };
      server = https.createServer(sslOptions, app);
      logger.info('Created HTTPS server');
    } else {
      server = http.createServer(app);
      logger.info('Created HTTP server');
    }

    // Configure server timeouts
    server.timeout = config.server.timeout || 30000;
    server.keepAliveTimeout = config.server.keepAliveTimeout || 5000;
    server.headersTimeout = config.server.headersTimeout || 6000;

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use`);
      } else {
        logger.error('Server error', { error: error.message });
      }
      reject(error);
    });

    // Start listening
    server.listen(port, host, () => {
      logger.info(`Server listening on ${host}:${port}`, {
        port,
        host,
        ssl: config.server.ssl?.enabled || false,
      });
      resolve();
    });

    // WebSocket upgrade for realtime transcription
    server.on('upgrade', (req, socket, head) => {
      try {
        const pathname = url.parse(req.url).pathname;
        if (logger && typeof logger.debug === 'function') {
          logger.debug('WS upgrade request', { pathname });
        }
        if (pathname === '/v1/realtime/transcribe') {
          if (!config.realtime?.enabled) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            return socket.destroy();
          }
          if (!realtimeController) {
            realtimeController = require('./controllers/realtime.controller');
          }
          return realtimeController.handleUpgrade(req, socket, head);
        }
      } catch (err) {
        logger.error('WS upgrade error', { error: err.message });
        try { socket.destroy(); } catch (e) { logger.warn('WS upgrade socket destroy failed'); }
      }
    });

    // Handle server shutdown gracefully
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  });
}

/**
 * Stop the server gracefully
 */
async function stop() {
  return new Promise((resolve, reject) => {
    if (!server) {
      return resolve();
    }

    logger.info('Starting server shutdown');

    // Attempt to close realtime WS controller if loaded
    try {
      if (realtimeController && typeof realtimeController.close === 'function') {
        realtimeController.close();
      }
      // Reset controller so a fresh instance is created on next start
      try {
        const path = require.resolve('./controllers/realtime.controller');
        if (require.cache[path]) delete require.cache[path];
      } catch (e) { /* ignore */ }
      realtimeController = null;
    } catch (e) { /* ignore */ }

    // Stop accepting new connections
    server.close((error) => {
      if (error) {
        logger.error('Error during server shutdown', { error: error.message });
        return reject(error);
      }

      logger.info('Server stopped successfully');
  try { if (rateLimit && typeof rateLimit.stop === 'function') rateLimit.stop(); } catch (e) { /* ignore */ }
      if (forceCloseTimer) {
        try { clearTimeout(forceCloseTimer); } catch { /* ignore */ }
        forceCloseTimer = null;
      }
      server = null;
      resolve();
    });

    // Force close after timeout (best-effort)
    forceCloseTimer = setTimeout(() => {
      logger.warn('Force closing server after timeout');
      try { server.close(); } catch (e) { /* ignore */ }
      server = null;
      resolve();
    }, 10000);
  });
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown() {
  logger.info('Initiating graceful shutdown');
  
  try {
    await stop();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
}

/**
 * Get server status
 */
function getStatus() {
  return {
    running: server !== null,
    listening: server?.listening || false,
    address: server?.address() || null,
  };
}

module.exports = {
  start,
  stop,
  getStatus,
};