/**
 * Express application configuration
 * 
 * Responsibilities:
 * - Middleware registration
 * - Route mounting
 * - Error handling setup
 * - Security headers configuration
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./routes');
const middleware = require('./middleware');

/**
 * Create and configure Express application
 */
function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  if (config.server.corsEnabled) {
    app.use(cors({
      origin: config.server.corsOrigins || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      credentials: true
    }));
  }

  // Request logging
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Custom middleware
  app.use(middleware.requestId);
  app.use(middleware.logging);
  app.use(middleware.metrics);

  // Authentication middleware (applied selectively)
  if (config.auth.requireAuthHeader) {
    app.use('/v1', middleware.auth);
  }

  // Rate limiting
  if (config.server.rateLimitingEnabled) {
    app.use(middleware.rateLimit);
  }

  // API routes
  app.use('/', routes);

  // Health check endpoint (no auth required)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      path: req.path
    });
  });

  // Global error handler
  app.use(middleware.error);

  return app;
}

module.exports = createApp();