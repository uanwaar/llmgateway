/**
 * Rate limiting middleware
 * 
 * Implements token bucket rate limiting
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');
const { RateLimitError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Create rate limiter based on configuration
 */
function createRateLimiter(options = {}) {
  const rateLimitConfig = {
    windowMs: options.windowMs || config.server.rateLimit?.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || config.server.rateLimit?.max || 100, 
    // limit each IP to 100 requests per windowMs
    message: options.message || 'Too many requests, please try again later',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    
    // Custom key generator (can use API key instead of IP)
    keyGenerator: (req) => {
      // Use API key if available for per-key limiting
      if (req.auth?.apiKey) {
        return req.auth.apiKey;
      }
      // Fall back to IP-based limiting
      return req.ip;
    },
    
    // Custom handler for rate limit exceeded
    handler: (req, res, next) => {
      const rateLimitInfo = {
        limit: req.rateLimit.limit,
        remaining: req.rateLimit.remaining,
        resetTime: new Date(req.rateLimit.resetTime).toISOString(),
        windowMs: req.rateLimit.windowMs,
      };
      
      logger.warn('Rate limit exceeded', {
        requestId: req.id,
        ip: req.ip,
        keyPrefix: req.auth?.keyPrefix,
        ...rateLimitInfo,
      });
      
      const error = new RateLimitError(
        req.rateLimit.limit,
        req.rateLimit.windowMs,
        Math.round(req.rateLimit.resetTime / 1000),
        {
          ip: req.ip,
          keyPrefix: req.auth?.keyPrefix,
          totalHits: req.rateLimit.totalHits,
        },
      );
      
      next(error);
    },
    
    // Skip rate limiting for certain conditions
    skip: (req) => {
      // Skip for health checks
      if (req.path.startsWith('/health')) {
        return true;
      }
      
      // Skip for internal requests (if configured)
      if (config.server.rateLimit?.skipInternal && req.ip === '127.0.0.1') {
        return true;
      }
      
      return false;
    },
  };
  
  return rateLimit(rateLimitConfig);
}

/**
 * Different rate limiters for different endpoints
 */
const chatRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.server.rateLimit?.chat || 60, // 60 requests per minute
  message: 'Too many chat requests, please slow down',
});

const embeddingsRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.server.rateLimit?.embeddings || 30, // 30 requests per minute
  message: 'Too many embedding requests, please slow down',
});

const audioRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.server.rateLimit?.audio || 10, // 10 requests per minute (audio is heavy)
  message: 'Too many audio requests, please slow down',
});

// Default rate limiter
const defaultRateLimit = createRateLimiter();

module.exports = defaultRateLimit;
module.exports.chat = chatRateLimit;
module.exports.embeddings = embeddingsRateLimit;
module.exports.audio = audioRateLimit;
module.exports.createCustom = createRateLimiter;