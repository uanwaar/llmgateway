/**
 * Logging middleware
 * 
 * Enhanced request/response logging
 */

const logger = require('../utils/logger');

/**
 * Request logging middleware
 */
function loggingMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  logger.info('Request started', {
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
      timestamp: new Date().toISOString(),
    });
  });
  
  next();
}

module.exports = loggingMiddleware;