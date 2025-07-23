/**
 * Global error handling middleware
 * 
 * This middleware handles all errors in the application and ensures
 * consistent error responses with proper logging and status codes.
 */

const logger = require('../utils/logger');
const { isGatewayError, toGatewayError, GatewayError } = require('../utils/errors');
const { HTTP_STATUS } = require('../utils/constants');

/**
 * Global error handler middleware
 * Must be the last middleware in the chain
 */
function errorHandler(error, req, res, _next) {
  // Convert to GatewayError if needed
  const gatewayError = isGatewayError(error) ? error : toGatewayError(error);
  
  // Extract request context for logging
  const requestContext = {
    requestId: req.id || req.headers['x-correlation-id'],
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  };

  // Log the error with context
  const logLevel = gatewayError.statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]('Request error', {
    ...requestContext,
    error: {
      name: gatewayError.name,
      message: gatewayError.message,
      code: gatewayError.errorCode,
      statusCode: gatewayError.statusCode,
      details: gatewayError.details,
      stack: process.env.NODE_ENV === 'development' ? gatewayError.stack : undefined,
    },
  });

  // Set CORS headers if needed
  if (req.headers.origin) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  // Set retry-after header for rate limit and service unavailable errors
  if (gatewayError.retryAfter) {
    res.header('Retry-After', gatewayError.retryAfter);
  }

  // Set correlation ID header
  if (requestContext.requestId) {
    res.header('X-Correlation-ID', requestContext.requestId);
  }

  // Send error response
  res.status(gatewayError.statusCode).json(gatewayError.toJSON());
}

/**
 * 404 Not Found handler
 * Should be placed before the error handler
 */
function notFoundHandler(req, res, next) {
  const error = new GatewayError(
    `Route ${req.method} ${req.path} not found`,
    HTTP_STATUS.NOT_FOUND,
    'ROUTE_NOT_FOUND',
    {
      method: req.method,
      path: req.path,
      availableRoutes: req.app._router ? getAvailableRoutes(req.app._router) : [],
    },
  );

  next(error);
}

/**
 * Async error catcher wrapper
 * Wraps async route handlers to catch promise rejections
 */
function asyncCatch(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error handler
 * Handles Joi validation errors and converts them to ValidationError
 */
function validationErrorHandler(error, req, res, next) {
  if (error.name === 'ValidationError' && error.isJoi) {
    const validationError = new (require('../utils/errors').ValidationError)(
      'Request validation failed',
      error.details[0]?.path?.join('.'),
      error.details[0]?.context?.value,
      {
        validationErrors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        })),
      },
    );
    
    return next(validationError);
  }
  
  next(error);
}

/**
 * Rate limit error handler
 * Handles express-rate-limit errors
 */
function rateLimitErrorHandler(req, res, next) {
  if (req.rateLimit && req.rateLimit.remaining === 0) {
    const { RateLimitError } = require('../utils/errors');
    const error = new RateLimitError(
      req.rateLimit.limit,
      req.rateLimit.windowMs,
      Math.round(req.rateLimit.resetTime / 1000),
      {
        ip: req.ip,
        totalHits: req.rateLimit.totalHits,
      },
    );
    
    return next(error);
  }
  
  next();
}

/**
 * Request timeout handler
 * Handles request timeout errors
 */
function timeoutHandler(timeout = 30000) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const { RequestTimeoutError } = require('../utils/errors');
        const error = new RequestTimeoutError(timeout, {
          method: req.method,
          url: req.url,
          requestId: req.id,
        });
        next(error);
      }
    }, timeout);

    // Clear timeout when response is finished
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

/**
 * Payload size error handler
 * Handles payload too large errors from body-parser
 */
function payloadErrorHandler(error, req, res, next) {
  if (error.type === 'entity.too.large') {
    const { PayloadTooLargeError } = require('../utils/errors');
    const payloadError = new PayloadTooLargeError(
      error.limit || '10mb',
      error.length,
      {
        type: error.type,
        message: error.message,
      },
    );
    
    return next(payloadError);
  }
  
  if (error.type === 'entity.parse.failed') {
    const { ValidationError } = require('../utils/errors');
    const validationError = new ValidationError(
      'Invalid JSON in request body',
      'body',
      null,
      {
        type: error.type,
        message: error.message,
      },
    );
    
    return next(validationError);
  }
  
  next(error);
}

/**
 * Security headers middleware
 * Adds security headers to error responses
 */
function securityHeaders(req, res, next) {
  // Add security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'no-referrer',
  });
  
  next();
}

/**
 * Health check bypass
 * Skip error handling for health check endpoints
 */
function healthCheckBypass(req, res, next) {
  if (req.path === '/health' || req.path === '/health/ready' || req.path === '/health/live') {
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
    });
  }
  
  next();
}

/**
 * Get available routes for 404 error context
 */
function getAvailableRoutes(router) {
  const routes = [];
  
  if (!router || !router.stack) {
    return routes;
  }
  
  router.stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods);
      routes.push({
        path: layer.route.path,
        methods: methods.map(m => m.toUpperCase()),
      });
    }
  });
  
  return routes.slice(0, 10); // Limit to first 10 routes
}

/**
 * Development error handler with full stack traces
 */
function developmentErrorHandler(error, req, res, next) {
  if (process.env.NODE_ENV !== 'development') {
    return next(error);
  }
  
  const gatewayError = isGatewayError(error) ? error : toGatewayError(error);
  
  // Enhanced error response for development
  const errorResponse = {
    ...gatewayError.toJSON(),
    development: {
      stack: gatewayError.stack,
      request: {
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query,
        method: req.method,
        url: req.url,
      },
      environment: process.env,
    },
  };
  
  res.status(gatewayError.statusCode).json(errorResponse);
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncCatch,
  validationErrorHandler,
  rateLimitErrorHandler,
  timeoutHandler,
  payloadErrorHandler,
  securityHeaders,
  healthCheckBypass,
  developmentErrorHandler,
};