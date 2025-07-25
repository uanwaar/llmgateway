const config = require('./index');
const logger = require('../utils/logger');

/**
 * Cache Configuration Module
 * Provides cache settings and validation for the LLM Gateway
 */
class CacheConfig {
  constructor() {
    this.config = config.cache;
    this.validate();
  }

  /**
   * Validate cache configuration
   */
  validate() {
    const { enabled, backend, ttl, maxSize, redis } = this.config;

    if (typeof enabled !== 'boolean') {
      throw new Error('Cache enabled must be a boolean');
    }

    if (!['memory', 'redis'].includes(backend)) {
      throw new Error('Cache backend must be either "memory" or "redis"');
    }

    if (typeof ttl !== 'number' || ttl <= 0) {
      throw new Error('Cache TTL must be a positive number');
    }

    if (backend === 'memory') {
      if (typeof maxSize !== 'number' || maxSize <= 0) {
        throw new Error('Memory cache maxSize must be a positive number');
      }
    }

    if (backend === 'redis') {
      if (!redis || !redis.url) {
        throw new Error('Redis URL is required when using Redis backend');
      }
      if (typeof redis.keyPrefix !== 'string') {
        throw new Error('Redis keyPrefix must be a string');
      }
      if (typeof redis.db !== 'number' || redis.db < 0) {
        throw new Error('Redis db must be a non-negative number');
      }
    }

    logger.info('Cache configuration validated successfully', {
      backend,
      ttl,
      enabled,
    });
  }

  /**
   * Get cache configuration
   */
  get() {
    return this.config;
  }

  /**
   * Check if cache is enabled
   */
  isEnabled() {
    return this.config.enabled;
  }

  /**
   * Get cache backend type
   */
  getBackend() {
    return this.config.backend;
  }

  /**
   * Get cache TTL in seconds
   */
  getTTL() {
    return this.config.ttl;
  }

  /**
   * Get memory cache max size
   */
  getMaxSize() {
    return this.config.maxSize;
  }

  /**
   * Get Redis configuration
   */
  getRedisConfig() {
    return this.config.redis;
  }

  /**
   * Get cache key generation settings
   */
  getKeyGeneration() {
    return {
      includeModel: true,
      includeProvider: true,
      includeParameters: true,
      excludeTimestamp: true,
      hashLength: 8,
    };
  }

  /**
   * Get cache invalidation policies
   */
  getInvalidationPolicies() {
    return {
      maxAge: this.config.ttl,
      onProviderError: true,
      onModelChange: true,
      onConfigChange: false,
    };
  }
}

module.exports = new CacheConfig();