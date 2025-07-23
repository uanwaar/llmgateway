/**
 * Centralized logging utility
 * 
 * Features:
 * - Structured JSON logging
 * - Multiple log levels and formats
 * - Request correlation IDs
 * - Performance metrics logging
 */

const winston = require('winston');
const config = require('../config');

/**
 * Create and configure Winston logger
 */
function createLogger() {
  const logLevel = config.logging?.level || 'info';
  const logFormat = config.logging?.format || 'json';

  // Define log formats
  const formats = {
    json: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    text: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      }),
    ),
  };

  // Create transports
  const transports = [
    new winston.transports.Console({
      level: logLevel,
      format: formats[logFormat] || formats.json,
    }),
  ];

  // Add file transports in production
  if (process.env.NODE_ENV === 'production') {
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: formats.json,
      }),
      new winston.transports.File({
        filename: 'logs/app.log',
        format: formats.json,
      }),
    );
  }

  return winston.createLogger({
    level: logLevel,
    format: formats[logFormat] || formats.json,
    transports,
    exitOnError: false,
  });
}

// Create logger instance
const logger = createLogger();

/**
 * Enhanced logger with additional methods
 */
class EnhancedLogger {
  constructor(winstonLogger) {
    this.logger = winstonLogger;
  }

  /**
   * Log with request context
   */
  withContext(context) {
    return {
      error: (message, meta = {}) => this.logger.error(message, { ...context, ...meta }),
      warn: (message, meta = {}) => this.logger.warn(message, { ...context, ...meta }),
      info: (message, meta = {}) => this.logger.info(message, { ...context, ...meta }),
      debug: (message, meta = {}) => this.logger.debug(message, { ...context, ...meta }),
    };
  }

  /**
   * Log request start
   */
  logRequest(req) {
    const context = {
      requestId: req.id,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    };

    this.logger.info('Request started', context);
    return context;
  }

  /**
   * Log request completion
   */
  logResponse(req, res, startTime) {
    const duration = Date.now() - startTime;
    const context = {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length') || 0,
    };

    const level = res.statusCode >= 400 ? 'warn' : 'info';
    this.logger[level]('Request completed', context);
  }

  /**
   * Log provider interaction
   */
  logProvider(action, provider, data = {}) {
    this.logger.info(`Provider ${action}`, {
      provider,
      action,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation, duration, metadata = {}) {
    this.logger.info('Performance metric', {
      operation,
      duration,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log cache operations
   */
  logCache(operation, key, hit = null, ttl = null) {
    this.logger.debug('Cache operation', {
      operation,
      key,
      hit,
      ttl,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log authentication events
   */
  logAuth(event, details = {}) {
    this.logger.info('Authentication event', {
      event,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log rate limiting events
   */
  logRateLimit(ip, remaining, total) {
    this.logger.warn('Rate limit approached', {
      ip,
      remaining,
      total,
      timestamp: new Date().toISOString(),
    });
  }

  // Delegate to winston logger
  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }
}

module.exports = new EnhancedLogger(logger);