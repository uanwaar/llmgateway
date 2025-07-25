const CacheService = require('../services/cache.service');
const cacheConfig = require('../config/cache');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Cache Middleware for Request/Response Interception
 * Handles caching of API responses with intelligent key generation
 */
class CacheMiddleware {
  constructor() {
    this.cacheService = new CacheService();
    this.keyGenConfig = cacheConfig.getKeyGeneration();
    this.invalidationPolicies = cacheConfig.getInvalidationPolicies();
  }

  /**
   * Initialize cache middleware
   */
  async initialize() {
    await this.cacheService.initialize();
    logger.info('Cache middleware initialized');
  }

  /**
   * Express middleware for response caching
   */
  middleware() {
    return async (req, res, next) => {
      // Skip caching if disabled
      if (!cacheConfig.isEnabled()) {
        return next();
      }

      // Skip caching for non-cacheable requests
      if (!this._isCacheable(req)) {
        return next();
      }

      const correlationId = req.correlationId || uuidv4();
      const cacheKey = this._generateCacheKey(req);

      try {
        // Try to get cached response with metadata
        const metadata = {
          endpoint: req.path,
          model: req.body?.model,
          provider: req.body?.provider,
        };
        
        const cachedResponse = await this.cacheService.get(cacheKey, metadata);
        
        if (cachedResponse) {
          logger.info('Cache hit - returning cached response', {
            correlationId,
            cacheKey,
            endpoint: req.path,
            model: req.body?.model,
          });

          // Set cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'X-Cache-TTL': cacheConfig.getTTL(),
          });

          return res.status(cachedResponse.status || 200)
            .json(cachedResponse.data);
        }

        // Cache miss - intercept response
        logger.debug('Cache miss - processing request', {
          correlationId,
          cacheKey,
          endpoint: req.path,
        });

        // Store original response methods
        const originalJson = res.json;
        const originalSend = res.send;
        const originalStatus = res.status;
        let responseStatus = 200;
        let responseData = null;

        // Override status method to capture status code
        res.status = function(code) {
          responseStatus = code;
          return originalStatus.call(this, code);
        };

        // Store cache service reference for use in function scopes
        const cacheServiceRef = this.cacheService;

        // Override json method to capture response data
        res.json = function(data) {
          responseData = data;
          
          // Cache successful responses
          if (responseStatus >= 200 && responseStatus < 300) {
            setImmediate(async () => {
              try {
                await cacheServiceRef.set(cacheKey, {
                  status: responseStatus,
                  data: responseData,
                  timestamp: Date.now(),
                  model: req.body?.model,
                  provider: req.body?.provider,
                });

                logger.debug('Response cached successfully', {
                  correlationId,
                  cacheKey,
                  status: responseStatus,
                });
              } catch (error) {
                logger.error('Failed to cache response', {
                  correlationId,
                  cacheKey,
                  error: error.message,
                });
              }
            });
          }

          // Set cache headers for miss
          this.set({
            'X-Cache': 'MISS',
            'X-Cache-Key': cacheKey,
            'X-Cache-TTL': cacheConfig.getTTL(),
          });

          return originalJson.call(this, data);
        };

        // Override send method for non-JSON responses
        res.send = function(data) {
          if (!responseData && responseStatus >= 200 && responseStatus < 300) {
            responseData = data;
            
            setImmediate(async () => {
              try {
                await cacheServiceRef.set(cacheKey, {
                  status: responseStatus,
                  data: responseData,
                  timestamp: Date.now(),
                });
              } catch (error) {
                logger.error('Failed to cache response', {
                  correlationId,
                  cacheKey,
                  error: error.message,
                });
              }
            });
          }

          this.set({
            'X-Cache': 'MISS',
            'X-Cache-Key': cacheKey,
          });

          return originalSend.call(this, data);
        };

        next();

      } catch (error) {
        logger.error('Cache middleware error', {
          correlationId,
          cacheKey,
          error: error.message,
        });
        
        // Continue without caching on error
        next();
      }
    };
  }

  /**
   * Check if request is cacheable
   */
  _isCacheable(req) {
    // Only cache GET requests and specific POST endpoints
    if (req.method === 'GET') {
      return true;
    }

    if (req.method === 'POST') {
      const cacheablePaths = [
        '/v1/chat/completions',
        '/v1/embeddings',
        '/v1/models',
      ];

      const isCacheablePath = cacheablePaths.some(path => 
        req.path.includes(path),
      );

      if (!isCacheablePath) {
        return false;
      }

      // Don't cache streaming requests
      if (req.body?.stream === true) {
        return false;
      }

      // Don't cache requests with user-specific data
      if (req.body?.user) {
        return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Generate cache key from request
   */
  _generateCacheKey(req) {
    const keyComponents = [];

    // Add endpoint path
    keyComponents.push(req.path);

    // Add HTTP method
    keyComponents.push(req.method);

    if (req.body) {
      // Add model if present
      if (this.keyGenConfig.includeModel && req.body.model) {
        keyComponents.push(`model:${req.body.model}`);
      }

      // Add provider if present
      if (this.keyGenConfig.includeProvider && req.body.provider) {
        keyComponents.push(`provider:${req.body.provider}`);
      }

      // Add relevant parameters
      if (this.keyGenConfig.includeParameters) {
        const relevantParams = this._extractRelevantParams(req.body);
        if (Object.keys(relevantParams).length > 0) {
          const paramString = JSON.stringify(relevantParams);
          keyComponents.push(`params:${paramString}`);
        }
      }
    }

    // Add query parameters for GET requests
    if (req.method === 'GET' && Object.keys(req.query).length > 0) {
      const queryString = JSON.stringify(req.query);
      keyComponents.push(`query:${queryString}`);
    }

    return this.cacheService.generateKey(
      req.body?.model || 'default',
      req.body?.provider || 'default',
      { components: keyComponents },
    );
  }

  /**
   * Extract relevant parameters for cache key generation
   */
  _extractRelevantParams(body) {
    const relevantParams = {};
    
    // Parameters that affect response content
    const importantParams = [
      'messages',
      'temperature',
      'max_tokens',
      'top_p',
      'frequency_penalty',
      'presence_penalty',
      'stop',
      'n',
      'logit_bias',
      'input',
      'encoding_format',
      'dimensions',
    ];

    importantParams.forEach(param => {
      if (body[param] !== undefined) {
        relevantParams[param] = body[param];
      }
    });

    return relevantParams;
  }

  /**
   * Invalidate cache entries based on policies
   */
  async invalidateCache(criteria = {}) {
    try {
      if (criteria.model) {
        // Invalidate all entries for a specific model
        logger.info('Invalidating cache for model', { model: criteria.model });
        // Implementation would depend on cache backend capabilities
      }

      if (criteria.provider) {
        // Invalidate all entries for a specific provider
        logger.info('Invalidating cache for provider', { provider: criteria.provider });
      }

      if (criteria.pattern) {
        // Invalidate entries matching a pattern
        logger.info('Invalidating cache by pattern', { pattern: criteria.pattern });
      }

      if (criteria.clearAll) {
        // Clear entire cache
        await this.cacheService.clear();
        logger.info('Entire cache cleared');
      }

    } catch (error) {
      logger.error('Cache invalidation error', {
        criteria,
        error: error.message,
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cacheService.getStats();
  }

  /**
   * Health check for cache middleware
   */
  async healthCheck() {
    return await this.cacheService.healthCheck();
  }

  /**
   * Shutdown cache middleware
   */
  async shutdown() {
    await this.cacheService.shutdown();
  }
}

// Create singleton instance
const cacheMiddleware = new CacheMiddleware();

module.exports = {
  CacheMiddleware,
  middleware: () => cacheMiddleware.middleware(),
  initialize: () => cacheMiddleware.initialize(),
  invalidateCache: (criteria) => cacheMiddleware.invalidateCache(criteria),
  getStats: () => cacheMiddleware.getStats(),
  healthCheck: () => cacheMiddleware.healthCheck(),
  shutdown: () => cacheMiddleware.shutdown(),
};