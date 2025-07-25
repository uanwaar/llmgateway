/**
 * Rate limiting middleware
 * 
 * Implements multiple rate limiting strategies
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');
const { RateLimitError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Rate limiting strategies
 */
const STRATEGIES = {
  FIXED_WINDOW: 'fixed-window',
  SLIDING_WINDOW: 'sliding-window',
  TOKEN_BUCKET: 'token-bucket',
  LEAKY_BUCKET: 'leaky-bucket',
};

/**
 * In-memory token bucket implementation
 */
class TokenBucket {
  constructor(capacity, refillRate, refillPeriod = 1000) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.refillPeriod = refillPeriod;
    this.lastRefill = Date.now();
  }
  
  consume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }
  
  refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor((timePassed / this.refillPeriod) * this.refillRate);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}

/**
 * Sliding window rate limiter
 */
class SlidingWindowLimiter {
  constructor(windowSize, maxRequests) {
    this.windowSize = windowSize;
    this.maxRequests = maxRequests;
    this.requests = new Map(); // key -> timestamps array
  }
  
  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const keyRequests = this.requests.get(key);
    
    // Remove old requests outside the window
    while (keyRequests.length > 0 && keyRequests[0] <= windowStart) {
      keyRequests.shift();
    }
    
    // Check if within limit
    if (keyRequests.length < this.maxRequests) {
      keyRequests.push(now);
      return true;
    }
    
    return false;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const windowStart = now - this.windowSize;
      const validTimestamps = timestamps.filter(ts => ts > windowStart);
      
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }
}

// Storage for different limiters
const tokenBuckets = new Map();
const slidingWindowLimiters = new Map();

/**
 * Create rate limiter based on strategy and configuration
 */
function createRateLimiter(options = {}) {
  const strategy = options.strategy || config.server.rateLimit?.strategy || STRATEGIES.FIXED_WINDOW;
  
  // Common key generator
  const keyGenerator = (req) => {
    // Use API key if available for per-key limiting
    if (req.auth?.apiKey) {
      return `api:${req.auth.apiKey}`;
    }
    // Use user identifier if available
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // Fall back to IP-based limiting
    return `ip:${req.ip}`;
  };
  
  switch (strategy) {
  case STRATEGIES.TOKEN_BUCKET:
    return createTokenBucketLimiter(options, keyGenerator);
    
  case STRATEGIES.SLIDING_WINDOW:
    return createSlidingWindowLimiter(options, keyGenerator);
    
  case STRATEGIES.FIXED_WINDOW:
  default:
    return createFixedWindowLimiter(options, keyGenerator);
  }
}

/**
 * Create fixed window rate limiter (express-rate-limit)
 */
function createFixedWindowLimiter(options = {}, keyGenerator) {
  const rateLimitConfig = {
    windowMs: options.windowMs || config.server.rateLimit?.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || config.server.rateLimit?.max || 100,
    message: options.message || 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    
    // Custom handler for rate limit exceeded
    handler: (req, res, next) => {
      const rateLimitInfo = {
        limit: req.rateLimit.limit,
        remaining: req.rateLimit.remaining,
        resetTime: new Date(req.rateLimit.resetTime).toISOString(),
        windowMs: req.rateLimit.windowMs,
        strategy: STRATEGIES.FIXED_WINDOW,
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
          strategy: STRATEGIES.FIXED_WINDOW,
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
 * Create token bucket rate limiter
 */
function createTokenBucketLimiter(options = {}, keyGenerator) {
  const capacity = options.capacity || options.max || 100;
  const refillRate = options.refillRate || options.max || 100;
  const refillPeriod = options.refillPeriod || options.windowMs || 60000;
  
  return (req, res, next) => {
    const key = keyGenerator(req);
    
    if (!tokenBuckets.has(key)) {
      tokenBuckets.set(key, new TokenBucket(capacity, refillRate, refillPeriod));
    }
    
    const bucket = tokenBuckets.get(key);
    const tokensRequested = options.tokensPerRequest || 1;
    
    if (bucket.consume(tokensRequested)) {
      // Request allowed
      res.set({
        'X-RateLimit-Limit': capacity,
        'X-RateLimit-Remaining': Math.floor(bucket.tokens),
        'X-RateLimit-Strategy': STRATEGIES.TOKEN_BUCKET,
      });
      
      next();
    } else {
      // Rate limit exceeded
      logger.warn('Token bucket rate limit exceeded', {
        requestId: req.id,
        key,
        tokensRequested,
        tokensAvailable: bucket.tokens,
        strategy: STRATEGIES.TOKEN_BUCKET,
      });
      
      const error = new RateLimitError(
        capacity,
        refillPeriod,
        Math.round((Date.now() + refillPeriod) / 1000),
        {
          key,
          tokensRequested,
          tokensAvailable: bucket.tokens,
          strategy: STRATEGIES.TOKEN_BUCKET,
        },
      );
      
      next(error);
    }
  };
}

/**
 * Create sliding window rate limiter
 */
function createSlidingWindowLimiter(options = {}, keyGenerator) {
  const windowSize = options.windowMs || 60000; // 1 minute
  const maxRequests = options.max || 100;
  
  const limiterId = `${windowSize}_${maxRequests}`;
  if (!slidingWindowLimiters.has(limiterId)) {
    const limiter = new SlidingWindowLimiter(windowSize, maxRequests);
    slidingWindowLimiters.set(limiterId, limiter);
    
    // Periodic cleanup
    setInterval(() => limiter.cleanup(), windowSize);
  }
  
  const limiter = slidingWindowLimiters.get(limiterId);
  
  return (req, res, next) => {
    const key = keyGenerator(req);
    
    if (limiter.isAllowed(key)) {
      // Request allowed
      const keyRequests = limiter.requests.get(key) || [];
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': maxRequests - keyRequests.length,
        'X-RateLimit-Window': windowSize,
        'X-RateLimit-Strategy': STRATEGIES.SLIDING_WINDOW,
      });
      
      next();
    } else {
      // Rate limit exceeded
      const keyRequests = limiter.requests.get(key) || [];
      const resetTime = Math.round((keyRequests[0] + windowSize) / 1000);
      
      logger.warn('Sliding window rate limit exceeded', {
        requestId: req.id,
        key,
        currentRequests: keyRequests.length,
        maxRequests,
        strategy: STRATEGIES.SLIDING_WINDOW,
      });
      
      const error = new RateLimitError(
        maxRequests,
        windowSize,
        resetTime,
        {
          key,
          currentRequests: keyRequests.length,
          strategy: STRATEGIES.SLIDING_WINDOW,
        },
      );
      
      next(error);
    }
  };
}

/**
 * Different rate limiters for different endpoints
 */

// Chat completion rate limiting (higher limits, token bucket for bursts)
const chatRateLimit = createRateLimiter({
  strategy: STRATEGIES.TOKEN_BUCKET,
  capacity: config.server.rateLimit?.chat?.capacity || 120,
  refillRate: config.server.rateLimit?.chat?.refillRate || 60,
  refillPeriod: 60000, // 1 minute
  tokensPerRequest: 1,
  message: 'Too many chat requests, please slow down',
});

// Embeddings rate limiting (moderate limits, fixed window)
const embeddingsRateLimit = createRateLimiter({
  strategy: STRATEGIES.FIXED_WINDOW,
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.server.rateLimit?.embeddings || 30,
  message: 'Too many embedding requests, please slow down',
});

// Audio processing rate limiting (strict limits, sliding window)
const audioRateLimit = createRateLimiter({
  strategy: STRATEGIES.SLIDING_WINDOW,
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: config.server.rateLimit?.audio || 20,
  message: 'Too many audio requests, please slow down',
});

// Models listing rate limiting (relaxed)
const modelsRateLimit = createRateLimiter({
  strategy: STRATEGIES.FIXED_WINDOW,
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.server.rateLimit?.models || 200,
  message: 'Too many model listing requests',
});

// Health check rate limiting (very relaxed)
const healthRateLimit = createRateLimiter({
  strategy: STRATEGIES.FIXED_WINDOW,
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.server.rateLimit?.health || 300,
  message: 'Too many health check requests',
});

// Default rate limiter (general API)
const defaultRateLimit = createRateLimiter({
  strategy: config.server.rateLimit?.defaultStrategy || STRATEGIES.FIXED_WINDOW,
  windowMs: config.server.rateLimit?.windowMs || 15 * 60 * 1000,
  max: config.server.rateLimit?.max || 100,
});

/**
 * Adaptive rate limiter based on endpoint patterns
 */
function createAdaptiveRateLimiter(req, res, next) {
  const path = req.path.toLowerCase();
  
  // Choose appropriate rate limiter based on endpoint
  if (path.includes('/chat/completions')) {
    return chatRateLimit(req, res, next);
  } else if (path.includes('/embeddings')) {
    return embeddingsRateLimit(req, res, next);
  } else if (path.includes('/audio/')) {
    return audioRateLimit(req, res, next);
  } else if (path.includes('/models')) {
    return modelsRateLimit(req, res, next);
  } else if (path.includes('/health')) {
    return healthRateLimit(req, res, next);
  } else {
    return defaultRateLimit(req, res, next);
  }
}

/**
 * Cleanup function for memory management
 */
function cleanup() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  // Cleanup token buckets
  for (const [key, bucket] of tokenBuckets.entries()) {
    if (now - bucket.lastRefill > maxAge) {
      tokenBuckets.delete(key);
    }
  }
  
  // Cleanup sliding window limiters
  slidingWindowLimiters.forEach(limiter => limiter.cleanup());
  
  logger.debug('Rate limiter cleanup completed', {
    tokenBuckets: tokenBuckets.size,
    slidingWindowLimiters: slidingWindowLimiters.size,
  });
}

// Periodic cleanup every hour
setInterval(cleanup, 60 * 60 * 1000);

module.exports = defaultRateLimit;
module.exports.chat = chatRateLimit;
module.exports.embeddings = embeddingsRateLimit;
module.exports.audio = audioRateLimit;
module.exports.models = modelsRateLimit;
module.exports.health = healthRateLimit;
module.exports.adaptive = createAdaptiveRateLimiter;
module.exports.createCustom = createRateLimiter;
module.exports.STRATEGIES = STRATEGIES;
module.exports.cleanup = cleanup;