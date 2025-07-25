const crypto = require('crypto');
const redis = require('redis');
const cacheConfig = require('../config/cache');
const logger = require('../utils/logger');
const { CacheError } = require('../utils/errors');

/**
 * Cache Service Implementation
 * Provides TTL-based caching with memory and Redis backends
 */
class CacheService {
  constructor() {
    this.config = cacheConfig.get();
    this.backend = null;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      invalidations: 0,
      totalRequests: 0,
      avgResponseTime: 0,
      responseTimes: [],
      hitsByEndpoint: {},
      missesByEndpoint: {},
      hitsByModel: {},
      missesByModel: {},
      errorsByType: {},
      startTime: Date.now(),
    };
    this.initialize();
  }

  /**
   * Initialize cache backend
   */
  async initialize() {
    if (!cacheConfig.isEnabled()) {
      logger.info('Cache is disabled');
      return;
    }

    try {
      const backendType = cacheConfig.getBackend();
      
      if (backendType === 'memory') {
        this.backend = new MemoryBackend(cacheConfig.getMaxSize());
        logger.info('Memory cache backend initialized', {
          maxSize: cacheConfig.getMaxSize(),
          ttl: cacheConfig.getTTL(),
        });
      } else if (backendType === 'redis') {
        this.backend = new RedisBackend(cacheConfig.getRedisConfig());
        await this.backend.connect();
        logger.info('Redis cache backend initialized', {
          url: cacheConfig.getRedisConfig().url,
          keyPrefix: cacheConfig.getRedisConfig().keyPrefix,
        });
      }
    } catch (error) {
      logger.error('Failed to initialize cache backend', { error: error.message });
      throw new CacheError('Cache initialization failed', error);
    }
  }

  /**
   * Generate cache key from request parameters
   */
  generateKey(model, provider, parameters = {}, strategy = 'default') {
    switch (strategy) {
    case 'semantic':
      return this._generateSemanticKey(model, provider, parameters);
    case 'hierarchical':
      return this._generateHierarchicalKey(model, provider, parameters);
    case 'content_based':
      return this._generateContentBasedKey(model, provider, parameters);
    default:
      return this._generateDefaultKey(model, provider, parameters);
    }
  }

  /**
   * Default key generation strategy
   */
  _generateDefaultKey(model, provider, parameters) {
    const keyData = {
      model,
      provider,
      parameters: this._normalizeParameters(parameters),
    };
    
    const keyString = JSON.stringify(keyData);
    const hash = crypto.createHash('sha256').update(keyString).digest('hex');
    const keyGenConfig = cacheConfig.getKeyGeneration();
    return `llm_gateway:${hash.substring(0, keyGenConfig.hashLength || 16)}`;
  }

  /**
   * Semantic key generation - focuses on message content similarity
   */
  _generateSemanticKey(model, provider, parameters) {
    const normalized = this._normalizeParameters(parameters);
    
    // Extract semantic content
    let semanticContent = '';
    if (normalized.messages && Array.isArray(normalized.messages)) {
      semanticContent = normalized.messages
        .map(msg => msg.content)
        .join('|')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    } else if (normalized.input) {
      semanticContent = normalized.input.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    const keyData = {
      model,
      provider,
      semantic: crypto.createHash('md5').update(semanticContent).digest('hex'),
      params: this._extractCoreParams(normalized),
    };

    const keyString = JSON.stringify(keyData);
    const hash = crypto.createHash('sha256').update(keyString).digest('hex');
    return `llm_gateway:semantic:${hash.substring(0, 16)}`;
  }

  /**
   * Hierarchical key generation - creates nested cache structure
   */
  _generateHierarchicalKey(model, provider, parameters) {
    const normalized = this._normalizeParameters(parameters);
    const levels = [
      'llm_gateway',
      provider,
      model,
      this._getRequestType(normalized),
      this._getContentHash(normalized),
    ];

    return levels.join(':');
  }

  /**
   * Content-based key generation - focuses on actual content
   */
  _generateContentBasedKey(model, provider, parameters) {
    const normalized = this._normalizeParameters(parameters);
    
    // Create content fingerprint
    let contentFingerprint = '';
    if (normalized.messages) {
      contentFingerprint = this._createContentFingerprint(normalized.messages);
    } else if (normalized.input) {
      contentFingerprint = crypto.createHash('md5')
        .update(normalized.input)
        .digest('hex')
        .substring(0, 8);
    }

    const keyData = {
      model,
      provider,
      content: contentFingerprint,
      settings: this._extractCoreParams(normalized),
    };

    const keyString = JSON.stringify(keyData);
    const hash = crypto.createHash('sha256').update(keyString).digest('hex');
    return `llm_gateway:content:${hash.substring(0, 16)}`;
  }

  /**
   * Create content fingerprint for messages
   */
  _createContentFingerprint(messages) {
    const fingerprint = messages.map(msg => {
      const role = msg.role || 'unknown';
      const content = (msg.content || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const contentHash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
      return `${role}:${contentHash}`;
    }).join('|');

    return crypto.createHash('md5').update(fingerprint).digest('hex').substring(0, 12);
  }

  /**
   * Get request type for hierarchical keys
   */
  _getRequestType(parameters) {
    if (parameters.messages) return 'chat';
    if (parameters.input && !parameters.model?.includes('tts')) return 'embedding';
    if (parameters.model?.includes('tts')) return 'tts';
    if (parameters.model?.includes('whisper')) return 'transcription';
    return 'completion';
  }

  /**
   * Get content hash for hierarchical keys
   */
  _getContentHash(parameters) {
    let content = '';
    if (parameters.messages) {
      content = JSON.stringify(parameters.messages);
    } else if (parameters.input) {
      content = parameters.input;
    }
    
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 12);
  }

  /**
   * Extract core parameters that affect caching
   */
  _extractCoreParams(parameters) {
    const coreParams = {};
    const importantFields = [
      'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
      'presence_penalty', 'n', 'stop', 'encoding_format', 'dimensions',
    ];

    importantFields.forEach(field => {
      if (parameters[field] !== undefined) {
        coreParams[field] = parameters[field];
      }
    });

    return coreParams;
  }

  /**
   * Get cached response
   */
  async get(key, metadata = {}) {
    if (!this.backend) {
      return null;
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.backend.get(key);
      const responseTime = Date.now() - startTime;
      this._updateResponseTime(responseTime);

      if (result) {
        this.metrics.hits++;
        this._trackHit(metadata);
        logger.debug('Cache hit', { key, responseTime });
        return JSON.parse(result);
      } else {
        this.metrics.misses++;
        this._trackMiss(metadata);
        logger.debug('Cache miss', { key, responseTime });
        return null;
      }
    } catch (error) {
      this.metrics.errors++;
      this._trackError(error, 'get');
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Store response in cache
   */
  async set(key, data, ttl = null) {
    if (!this.backend) {
      return false;
    }

    try {
      const cacheTTL = ttl || cacheConfig.getTTL();
      const serializedData = JSON.stringify(data);
      
      await this.backend.set(key, serializedData, cacheTTL);
      this.metrics.sets++;
      
      logger.debug('Cache set', { key, ttl: cacheTTL });
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete cached item
   */
  async delete(key) {
    if (!this.backend) {
      return false;
    }

    try {
      const result = await this.backend.delete(key);
      this.metrics.deletes++;
      
      logger.debug('Cache delete', { key });
      return result;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Invalidate cache based on policies
   */
  async invalidate(criteria = {}) {
    if (!this.backend) {
      return false;
    }

    try {
      let invalidatedCount = 0;

      // Invalidate by model
      if (criteria.model) {
        invalidatedCount += await this._invalidateByModel(criteria.model);
      }

      // Invalidate by provider
      if (criteria.provider) {
        invalidatedCount += await this._invalidateByProvider(criteria.provider);
      }

      // Invalidate by pattern
      if (criteria.pattern) {
        invalidatedCount += await this._invalidateByPattern(criteria.pattern);
      }

      // Invalidate expired entries
      if (criteria.expiredOnly) {
        invalidatedCount += await this._invalidateExpired();
      }

      // Invalidate by age
      if (criteria.olderThan) {
        invalidatedCount += await this._invalidateByAge(criteria.olderThan);
      }

      // Clear all cache
      if (criteria.clearAll) {
        await this.clear();
        invalidatedCount = 'all';
      }

      logger.info('Cache invalidation completed', {
        criteria,
        invalidatedCount,
      });

      return invalidatedCount;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache invalidation error', {
        criteria,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Invalidate cache entries for a specific model
   */
  async _invalidateByModel(model) {
    const patterns = [
      `*:${model}:*`,
      `*model:${model}*`,
      `*"model":"${model}"*`,
    ];

    let count = 0;
    for (const pattern of patterns) {
      count += await this._invalidateByPattern(pattern);
    }

    return count;
  }

  /**
   * Invalidate cache entries for a specific provider
   */
  async _invalidateByProvider(provider) {
    const patterns = [
      `*:${provider}:*`,
      `*provider:${provider}*`,
      `*"provider":"${provider}"*`,
    ];

    let count = 0;
    for (const pattern of patterns) {
      count += await this._invalidateByPattern(pattern);
    }

    return count;
  }

  /**
   * Invalidate cache entries by pattern
   */
  async _invalidateByPattern(pattern) {
    if (this.backend.invalidateByPattern) {
      return await this.backend.invalidateByPattern(pattern);
    }

    // Fallback for backends that don't support pattern invalidation
    logger.warn('Backend does not support pattern invalidation', { pattern });
    return 0;
  }

  /**
   * Invalidate expired entries
   */
  async _invalidateExpired() {
    if (this.backend.invalidateExpired) {
      return await this.backend.invalidateExpired();
    }

    // TTL expiration is handled automatically by backends
    return 0;
  }

  /**
   * Invalidate entries older than specified time
   */
  async _invalidateByAge(maxAge) {
    if (this.backend.invalidateByAge) {
      return await this.backend.invalidateByAge(maxAge);
    }

    logger.warn('Backend does not support age-based invalidation');
    return 0;
  }

  /**
   * Schedule automatic cache invalidation
   */
  scheduleInvalidation() {
    const invalidationPolicies = cacheConfig.getInvalidationPolicies();
    
    // Schedule periodic cleanup of expired entries
    if (invalidationPolicies.maxAge) {
      setInterval(async () => {
        try {
          await this.invalidate({ expiredOnly: true });
        } catch (error) {
          logger.error('Scheduled cache invalidation failed', {
            error: error.message,
          });
        }
      }, 300000); // Every 5 minutes
    }

    // Schedule cleanup of old entries
    setInterval(async () => {
      try {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        await this.invalidate({ olderThan: oneDayAgo });
      } catch (error) {
        logger.error('Scheduled old entry cleanup failed', {
          error: error.message,
        });
      }
    }, 3600000); // Every hour

    logger.info('Cache invalidation scheduler started');
  }

  /**
   * Clear all cached items
   */
  async clear() {
    if (!this.backend) {
      return false;
    }

    try {
      await this.backend.clear();
      logger.info('Cache cleared');
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Cache clear error', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalHitsAndMisses = this.metrics.hits + this.metrics.misses;
    const uptime = Date.now() - this.metrics.startTime;
    
    const stats = {
      ...this.metrics,
      hitRate: totalHitsAndMisses > 0 ? (this.metrics.hits / totalHitsAndMisses) : 0,
      missRate: totalHitsAndMisses > 0 ? (this.metrics.misses / totalHitsAndMisses) : 0,
      errorRate: this.metrics.totalRequests > 0 
        ? (this.metrics.errors / this.metrics.totalRequests) : 0,
      requestsPerSecond: uptime > 0 ? (this.metrics.totalRequests / (uptime / 1000)) : 0,
      backend: cacheConfig.getBackend(),
      enabled: cacheConfig.isEnabled(),
      uptime,
      avgResponseTime: this.metrics.avgResponseTime,
      topEndpoints: this._getTopEndpoints(),
      topModels: this._getTopModels(),
      errorBreakdown: this.metrics.errorsByType,
    };

    if (this.backend && this.backend.getStats) {
      stats.backendStats = this.backend.getStats();
    }

    return stats;
  }

  /**
   * Update response time metrics
   */
  _updateResponseTime(responseTime) {
    this.metrics.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times for performance
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift();
    }
    
    // Calculate running average
    const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.avgResponseTime = sum / this.metrics.responseTimes.length;
  }

  /**
   * Track cache hit with metadata
   */
  _trackHit(metadata) {
    if (metadata.endpoint) {
      this.metrics.hitsByEndpoint[metadata.endpoint] = 
        (this.metrics.hitsByEndpoint[metadata.endpoint] || 0) + 1;
    }
    
    if (metadata.model) {
      this.metrics.hitsByModel[metadata.model] = 
        (this.metrics.hitsByModel[metadata.model] || 0) + 1;
    }
  }

  /**
   * Track cache miss with metadata
   */
  _trackMiss(metadata) {
    if (metadata.endpoint) {
      this.metrics.missesByEndpoint[metadata.endpoint] = 
        (this.metrics.missesByEndpoint[metadata.endpoint] || 0) + 1;
    }
    
    if (metadata.model) {
      this.metrics.missesByModel[metadata.model] = 
        (this.metrics.missesByModel[metadata.model] || 0) + 1;
    }
  }

  /**
   * Track cache errors with type classification
   */
  _trackError(error, operation) {
    const errorType = error.name || 'UnknownError';
    const key = `${operation}:${errorType}`;
    
    this.metrics.errorsByType[key] = 
      (this.metrics.errorsByType[key] || 0) + 1;
  }

  /**
   * Get top endpoints by cache usage
   */
  _getTopEndpoints() {
    const combined = {};
    
    // Combine hits and misses
    Object.keys(this.metrics.hitsByEndpoint).forEach(endpoint => {
      combined[endpoint] = {
        hits: this.metrics.hitsByEndpoint[endpoint] || 0,
        misses: this.metrics.missesByEndpoint[endpoint] || 0,
      };
    });
    
    Object.keys(this.metrics.missesByEndpoint).forEach(endpoint => {
      if (!combined[endpoint]) {
        combined[endpoint] = { hits: 0, misses: 0 };
      }
      combined[endpoint].misses = this.metrics.missesByEndpoint[endpoint] || 0;
    });

    // Calculate hit rates and sort
    return Object.entries(combined)
      .map(([endpoint, data]) => ({
        endpoint,
        hits: data.hits,
        misses: data.misses,
        total: data.hits + data.misses,
        hitRate: (data.hits + data.misses) > 0 ? data.hits / (data.hits + data.misses) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  /**
   * Get top models by cache usage
   */
  _getTopModels() {
    const combined = {};
    
    // Combine hits and misses for models
    Object.keys(this.metrics.hitsByModel).forEach(model => {
      combined[model] = {
        hits: this.metrics.hitsByModel[model] || 0,
        misses: this.metrics.missesByModel[model] || 0,
      };
    });
    
    Object.keys(this.metrics.missesByModel).forEach(model => {
      if (!combined[model]) {
        combined[model] = { hits: 0, misses: 0 };
      }
      combined[model].misses = this.metrics.missesByModel[model] || 0;
    });

    // Calculate hit rates and sort
    return Object.entries(combined)
      .map(([model, data]) => ({
        model,
        hits: data.hits,
        misses: data.misses,
        total: data.hits + data.misses,
        hitRate: (data.hits + data.misses) > 0 ? data.hits / (data.hits + data.misses) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      invalidations: 0,
      totalRequests: 0,
      avgResponseTime: 0,
      responseTimes: [],
      hitsByEndpoint: {},
      missesByEndpoint: {},
      hitsByModel: {},
      missesByModel: {},
      errorsByType: {},
      startTime: Date.now(),
    };
    
    logger.info('Cache metrics reset');
  }

  /**
   * Check if cache is healthy
   */
  async healthCheck() {
    if (!cacheConfig.isEnabled()) {
      return { healthy: true, message: 'Cache disabled' };
    }

    if (!this.backend) {
      return { healthy: false, message: 'Cache backend not initialized' };
    }

    try {
      const testKey = `health_check_${Date.now()}`;
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, 1);
      const result = await this.get(testKey);
      await this.delete(testKey);
      
      const healthy = result && result.timestamp === testValue.timestamp;
      return {
        healthy,
        message: healthy ? 'Cache working properly' : 'Cache test failed',
        stats: this.getStats(),
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Cache health check failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Normalize parameters for consistent cache keys
   */
  _normalizeParameters(params) {
    const normalized = { ...params };
    
    // Remove non-deterministic parameters
    delete normalized.stream;
    delete normalized.user;
    delete normalized.timestamp;
    
    // Sort arrays to ensure consistent ordering
    if (normalized.messages && Array.isArray(normalized.messages)) {
      normalized.messages = normalized.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
    }
    
    return normalized;
  }

  /**
   * Shutdown cache service
   */
  async shutdown() {
    if (this.backend && this.backend.disconnect) {
      await this.backend.disconnect();
      logger.info('Cache service shutdown');
    }
  }
}

/**
 * Memory Backend Implementation
 */
class MemoryBackend {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.timers = new Map();
  }

  async get(key) {
    return this.cache.get(key) || null;
  }

  async set(key, value, ttl) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this._clearTimer(firstKey);
    }

    this.cache.set(key, value);
    
    // Set TTL timer
    this._clearTimer(key);
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttl * 1000);
    
    this.timers.set(key, timer);
  }

  async delete(key) {
    this._clearTimer(key);
    return this.cache.delete(key);
  }

  async clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      usage: (this.cache.size / this.maxSize) * 100,
    };
  }

  async invalidateByPattern(pattern) {
    const keysToDelete = [];
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this._clearTimer(key);
    });

    return keysToDelete.length;
  }

  async invalidateByAge(_maxAge) {
    // Memory cache doesn't store timestamps, so we can't implement this
    return 0;
  }

  _clearTimer(key) {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

/**
 * Redis Backend Implementation
 */
class RedisBackend {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  async connect() {
    this.client = redis.createClient({
      url: this.config.url,
      database: this.config.db,
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error: error.message });
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    await this.client.connect();
  }

  async get(key) {
    const fullKey = this.config.keyPrefix + key;
    return await this.client.get(fullKey);
  }

  async set(key, value, ttl) {
    const fullKey = this.config.keyPrefix + key;
    await this.client.setEx(fullKey, ttl, value);
  }

  async delete(key) {
    const fullKey = this.config.keyPrefix + key;
    const result = await this.client.del(fullKey);
    return result > 0;
  }

  async clear() {
    const pattern = `${this.config.keyPrefix}*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  async getStats() {
    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      return {
        connected: this.client.isOpen,
        memory: info,
        keyspace,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async invalidateByPattern(pattern) {
    try {
      const fullPattern = this.config.keyPrefix + pattern;
      const keys = await this.client.keys(fullPattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        return keys.length;
      }
      return 0;
    } catch (error) {
      throw new Error(`Redis pattern invalidation failed: ${error.message}`);
    }
  }

  async invalidateByAge(_maxAge) {
    // Redis TTL handles expiration automatically
    // This would require storing timestamps in values for custom age-based cleanup
    return 0;
  }

  async invalidateExpired() {
    // Redis automatically removes expired keys
    return 0;
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
  }
}

module.exports = CacheService;