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

// Lazily required to avoid circular deps if any
let realtimeController;

let server = null;

/**
 * Start the HTTP/HTTPS server
 * @param {Express} app - Express application instance
 */
async function start(app) {
  return new Promise((resolve, reject) => {
    const port = config.server.port || 8080;
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
        // New path (preferred)
        if (pathname === '/v1/realtime/transcription') {
          if (!config.realtime?.enabled) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            return socket.destroy();
          }
          if (!realtimeController) {
            realtimeController = require('./controllers/realtime.controller');
          }
          return realtimeController.handleUpgrade(req, socket, head);
        }
        // Deprecated old path: respond 410 Gone
        if (pathname === '/v1/realtime/transcribe') {
          const body = 'Deprecated endpoint. Use /v1/realtime/transcription';
          socket.write(
            'HTTP/1.1 410 Gone\r\n' +
            'Content-Type: text/plain; charset=utf-8\r\n' +
            `Content-Length: ${Buffer.byteLength(body)}\r\n` +
            'Connection: close\r\n' +
            '\r\n' +
            body
          );
          return socket.destroy();
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

    // Stop accepting new connections
    server.close((error) => {
      if (error) {
        logger.error('Error during server shutdown', { error: error.message });
        return reject(error);
      }

      logger.info('Server stopped successfully');
      server = null;
      resolve();
    });

    // Force close after timeout
    setTimeout(() => {
      logger.warn('Force closing server after timeout');
      try {
        if (typeof server.closeAllConnections === 'function') {
          server.closeAllConnections();
        }
        if (typeof server.closeIdleConnections === 'function') {
          server.closeIdleConnections();
        }
      } catch (e) {
        logger.warn('Error while force closing connections', { error: e.message });
      }
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