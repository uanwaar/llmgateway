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
        cert: fs.readFileSync(config.server.ssl.certPath)
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
        ssl: config.server.ssl?.enabled || false
      });
      resolve();
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
      server.destroy();
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
    address: server?.address() || null
  };
}

module.exports = {
  start,
  stop,
  getStatus
};