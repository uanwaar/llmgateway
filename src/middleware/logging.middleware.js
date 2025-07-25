/**
 * Logging middleware
 * 
 * Enhanced request/response logging with correlation IDs
 */

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

/**
 * Request logging middleware with correlation tracking
 */
function loggingMiddleware(options = {}) {
  const enableRequestBody = options.logRequestBody || 
    config.server?.logging?.requestBody || false;
  const enableResponseBody = options.logResponseBody || 
    config.server?.logging?.responseBody || false;
  const sensitiveHeaders = options.sensitiveHeaders || ['authorization', 'x-api-key', 'cookie'];
  const maxBodySize = options.maxBodySize || 1024; // 1KB max for logging
  
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Ensure request has correlation ID
    if (!req.correlationId) {
      req.correlationId = req.get('X-Correlation-ID') || uuidv4();
    }
    
    // Set correlation ID in response headers
    res.set('X-Correlation-ID', req.correlationId);
    
    // Sanitize headers for logging
    const sanitizedHeaders = {};
    Object.keys(req.headers).forEach(key => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitizedHeaders[key] = '[REDACTED]';
      } else {
        sanitizedHeaders[key] = req.headers[key];
      }
    });
    
    // Prepare request log data
    const requestLogData = {
      requestId: req.id,
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      headers: sanitizedHeaders,
      protocol: req.protocol,
      secure: req.secure,
      timestamp: new Date().toISOString(),
    };
    
    // Add request body if enabled and safe
    if (enableRequestBody && req.body && typeof req.body === 'object') {
      const bodyString = JSON.stringify(req.body);
      if (bodyString.length <= maxBodySize) {
        requestLogData.body = req.body;
      } else {
        requestLogData.bodySize = bodyString.length;
        requestLogData.bodyTruncated = true;
      }
    }
    
    // Log request
    logger.info('Request started', requestLogData);
    
    // Capture response body if enabled
    let responseBody = '';
    const originalSend = res.send;
    const originalJson = res.json;
    
    if (enableResponseBody) {
      res.send = function(body) {
        if (typeof body === 'string' && body.length <= maxBodySize) {
          responseBody = body;
        } else if (typeof body === 'object') {
          const bodyString = JSON.stringify(body);
          if (bodyString.length <= maxBodySize) {
            responseBody = bodyString;
          }
        }
        return originalSend.call(this, body);
      };
      
      res.json = function(obj) {
        const bodyString = JSON.stringify(obj);
        if (bodyString.length <= maxBodySize) {
          responseBody = bodyString;
        }
        return originalJson.call(this, obj);
      };
    }
    
    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
      
      const responseLogData = {
        requestId: req.id,
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        path: req.path,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        duration: `${duration}ms`,
        durationMs: duration,
        contentLength: res.get('content-length'),
        contentType: res.get('content-type'),
        cacheHit: res.get('X-Cache') === 'HIT',
        rateLimit: {
          limit: res.get('X-RateLimit-Limit'),
          remaining: res.get('X-RateLimit-Remaining'),
        },
        timestamp: new Date().toISOString(),
      };
      
      // Add response body if captured
      if (responseBody) {
        try {
          responseLogData.responseBody = JSON.parse(responseBody);
        } catch {
          responseLogData.responseBody = responseBody;
        }
      }
      
      // Add error details for failed requests
      if (res.statusCode >= 400 && req.error) {
        responseLogData.error = {
          message: req.error.message,
          type: req.error.constructor.name,
          code: req.error.code,
        };
      }
      
      logger[logLevel]('Request completed', responseLogData);
    });
    
    // Log response errors
    res.on('error', (error) => {
      logger.error('Response error', {
        requestId: req.id,
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        error: {
          message: error.message,
          stack: error.stack,
          type: error.constructor.name,
        },
        timestamp: new Date().toISOString(),
      });
    });
    
    next();
  };
}

/**
 * Error logging middleware
 */
function errorLoggingMiddleware(error, req, res, next) {
  // Attach error to request for main logging middleware
  req.error = error;
  
  logger.error('Request error', {
    requestId: req.id,
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    error: {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      code: error.code,
    },
    timestamp: new Date().toISOString(),
  });
  
  next(error);
}

/**
 * Performance logging middleware
 */
function performanceLoggingMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log slow requests
    const slowThreshold = config.server?.logging?.slowRequestThreshold || 1000; // 1 second
    if (duration > slowThreshold) {
      logger.warn('Slow request detected', {
        requestId: req.id,
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${slowThreshold}ms`,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Log performance metrics
    if (config.server?.logging?.performanceMetrics) {
      logger.debug('Request performance', {
        requestId: req.id,
        correlationId: req.correlationId,
        duration: `${duration.toFixed(2)}ms`,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  next();
}

/**
 * Audit logging middleware for sensitive operations
 */
function auditLoggingMiddleware(req, res, next) {
  const sensitiveOperations = [
    '/auth',
    '/admin',
    '/config',
    '/metrics',
  ];
  
  const isSensitive = sensitiveOperations.some(op => req.path.includes(op));
  
  if (isSensitive) {
    logger.audit('Sensitive operation access', {
      requestId: req.id,
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      auth: req.auth ? {
        keyPrefix: req.auth.keyPrefix,
        type: req.auth.type,
      } : null,
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
}

// Default logging middleware
const defaultLoggingMiddleware = loggingMiddleware();

module.exports = defaultLoggingMiddleware;
module.exports.create = loggingMiddleware;
module.exports.error = errorLoggingMiddleware;
module.exports.performance = performanceLoggingMiddleware;
module.exports.audit = auditLoggingMiddleware;