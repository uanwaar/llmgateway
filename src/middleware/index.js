/**
 * Middleware exports
 * 
 * Centralized middleware management
 */

const errorMiddleware = require('./error.middleware');
const authMiddleware = require('./auth.middleware');
const rateLimitMiddleware = require('./rateLimit.middleware');
const validationMiddleware = require('./validation.middleware');
const metricsMiddleware = require('./metrics.middleware');
const loggingMiddleware = require('./logging.middleware');
const requestIdMiddleware = require('./requestId.middleware');
const cacheMiddleware = require('./cache.middleware');
const corsMiddleware = require('./cors.middleware');

module.exports = {
  // Error handling
  error: errorMiddleware.errorHandler,
  notFound: errorMiddleware.notFoundHandler,
  asyncCatch: errorMiddleware.asyncCatch,
  validationError: errorMiddleware.validationErrorHandler,
  rateLimitError: errorMiddleware.rateLimitErrorHandler,
  timeout: errorMiddleware.timeoutHandler,
  payloadError: errorMiddleware.payloadErrorHandler,
  securityHeaders: errorMiddleware.securityHeaders,
  healthCheckBypass: errorMiddleware.healthCheckBypass,
  
  // Authentication & Authorization
  auth: authMiddleware,
  
  // Rate limiting
  rateLimit: rateLimitMiddleware,
  
  // Request validation
  validation: validationMiddleware,
  
  // Metrics and monitoring
  metrics: metricsMiddleware,
  
  // Logging
  logging: loggingMiddleware,
  errorLogging: loggingMiddleware.error,
  performanceLogging: loggingMiddleware.performance,
  auditLogging: loggingMiddleware.audit,
  
  // Request ID
  requestId: requestIdMiddleware,
  
  // Response caching
  cache: cacheMiddleware,
  
  // CORS handling
  cors: corsMiddleware,
  
  // Enhanced validation with security and sanitization
  securityValidation: validationMiddleware.security,
  sanitization: validationMiddleware.sanitization,
  
  // Rate limiting strategies
  rateLimitStrategies: rateLimitMiddleware.STRATEGIES,
  adaptiveRateLimit: rateLimitMiddleware.adaptive,
  customRateLimit: rateLimitMiddleware.createCustom,
};