/**
 * Intelligent request routing logic
 * 
 * Features:
 * - Provider selection algorithms
 * - Load balancing strategies  
 * - Health-based routing
 * - Cost optimization routing
 */

const config = require('../config');
const logger = require('../utils/logger');
const { GatewayError } = require('../utils/errors');

class RouterService {
  constructor() {
    this.initialized = false;
    this.requestCounts = new Map(); // For round-robin load balancing
    this.responseMetrics = new Map(); // For performance-based routing
    this.routingStrategy = 'cost_optimized'; // Default strategy
    
    // High-throughput optimizations
    this.providerPool = new Map(); // Connection pools per provider
    this.circuitBreakers = new Map(); // Circuit breakers per provider
    this.loadBalancingCache = new Map(); // Cached provider selections
    this.cacheTimeout = 60000; // 1 minute cache timeout
    this.metricsWindow = 1000; // Sliding window for metrics (last 1000 requests)
    this.adaptiveTimeout = true; // Enable adaptive timeout based on performance
    this.concurrencyLimits = new Map(); // Per-provider concurrency limits
    this.requestQueue = []; // Queue for handling burst traffic
    this.processingQueue = false;
  }

  /**
   * Initialize router service
   */
  async initialize() {
    try {
      logger.info('Initializing Router Service');

      // Load routing configuration
      const routingConfig = config.routing || {};
      this.routingStrategy = routingConfig.strategy || 'cost_optimized';
      this.failoverEnabled = routingConfig.failoverEnabled !== false;
      
      // High-throughput configuration
      this.cacheTimeout = routingConfig.cacheTimeout || 60000;
      this.metricsWindow = routingConfig.metricsWindow || 1000;
      this.adaptiveTimeout = routingConfig.adaptiveTimeout !== false;
      this.maxQueueSize = routingConfig.maxQueueSize || 10000;
      this.queueProcessingInterval = routingConfig.queueProcessingInterval || 100;
      
      // Initialize circuit breakers for each provider
      this.initializeCircuitBreakers();
      
      // Start queue processing
      this.startQueueProcessing();

      logger.info('Router Service initialized', {
        strategy: this.routingStrategy,
        failoverEnabled: this.failoverEnabled,
        highThroughputMode: true,
        cacheTimeout: this.cacheTimeout,
        metricsWindow: this.metricsWindow,
      });

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize Router Service', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Select best provider from available providers
   */
  selectBestProvider(availableProviders, criteria = {}) {
    if (!this.initialized) {
      throw new GatewayError('Router service not initialized');
    }

    if (!availableProviders || availableProviders.length === 0) {
      return null;
    }

    if (availableProviders.length === 1) {
      return availableProviders[0].adapter;
    }

    // Apply selection strategy
    const strategy = criteria.routingStrategy || this.routingStrategy;
    
    switch (strategy) {
    case 'cost_optimized':
      return this.selectCostOptimizedProvider(availableProviders, criteria);
      
    case 'performance':
      return this.selectPerformanceBasedProvider(availableProviders, criteria);
      
    case 'round_robin':
      return this.selectRoundRobinProvider(availableProviders, criteria);
      
    case 'health_based':
      return this.selectHealthBasedProvider(availableProviders, criteria);
      
    case 'weighted':
      return this.selectWeightedProvider(availableProviders, criteria);
      
    default:
      logger.warn('Unknown routing strategy, falling back to cost optimization', {
        strategy,
      });
      return this.selectCostOptimizedProvider(availableProviders, criteria);
    }
  }

  /**
   * Cost-optimized provider selection
   */
  selectCostOptimizedProvider(providers, criteria) {
    const { model } = criteria;
    
    if (!model) {
      // Fallback to round-robin if no model specified
      return this.selectRoundRobinProvider(providers, criteria);
    }

    logger.debug('Selecting cost-optimized provider', {
      model,
      providerCount: providers.length,
    });

    let bestProvider = null;
    let lowestCost = Infinity;

    for (const providerInfo of providers) {
      const { adapter, name } = providerInfo;
      
      try {
        // Get cost information for the model
        const costInfo = adapter.getCostInfo ? adapter.getCostInfo(model) : null;
        
        if (costInfo) {
          // Calculate total cost (input + output)
          const totalCost = (costInfo.inputCost || 0) + (costInfo.outputCost || 0);
          
          if (totalCost < lowestCost) {
            lowestCost = totalCost;
            bestProvider = adapter;
          }

          logger.debug('Provider cost evaluation', {
            provider: name,
            model,
            inputCost: costInfo.inputCost,
            outputCost: costInfo.outputCost,
            totalCost,
          });
        } else {
          // If no cost info available, consider as backup option
          if (!bestProvider) {
            bestProvider = adapter;
          }
        }
      } catch (error) {
        logger.warn('Failed to get cost info for provider', {
          provider: name,
          model,
          error: error.message,
        });
      }
    }

    if (bestProvider) {
      logger.info('Selected cost-optimized provider', {
        provider: bestProvider.constructor.name,
        model,
        cost: lowestCost === Infinity ? 'unknown' : lowestCost,
      });
    }

    return bestProvider || providers[0].adapter;
  }

  /**
   * Performance-based provider selection
   */
  selectPerformanceBasedProvider(providers, _criteria) {
    logger.debug('Selecting performance-based provider', {
      providerCount: providers.length,
    });

    let bestProvider = null;
    let bestResponseTime = Infinity;

    for (const providerInfo of providers) {
      const { adapter, name } = providerInfo;
      
      try {
        // Get performance metrics
        const metrics = adapter.getMetrics ? adapter.getMetrics() : {};
        const avgResponseTime = metrics.averageResponseTime || Infinity;
        const successRate = metrics.totalRequests > 0 
          ? metrics.successfulRequests / metrics.totalRequests 
          : 0;

        // Consider both response time and success rate
        const performanceScore = avgResponseTime * (1 / Math.max(successRate, 0.1));

        if (performanceScore < bestResponseTime) {
          bestResponseTime = performanceScore;
          bestProvider = adapter;
        }

        logger.debug('Provider performance evaluation', {
          provider: name,
          avgResponseTime,
          successRate,
          performanceScore,
        });
      } catch (error) {
        logger.warn('Failed to get metrics for provider', {
          provider: name,
          error: error.message,
        });
      }
    }

    if (bestProvider) {
      logger.info('Selected performance-based provider', {
        provider: bestProvider.constructor.name,
        performanceScore: bestResponseTime === Infinity ? 'unknown' : bestResponseTime,
      });
    }

    return bestProvider || providers[0].adapter;
  }

  /**
   * Round-robin provider selection
   */
  selectRoundRobinProvider(providers, _criteria) {
    const key = _criteria.model || 'default';
    const currentCount = this.requestCounts.get(key) || 0;
    const selectedIndex = currentCount % providers.length;
    
    this.requestCounts.set(key, currentCount + 1);

    const selectedProvider = providers[selectedIndex];

    logger.debug('Selected round-robin provider', {
      provider: selectedProvider.name,
      index: selectedIndex,
      total: providers.length,
      key,
    });

    return selectedProvider.adapter;
  }

  /**
   * Health-based provider selection
   */
  selectHealthBasedProvider(providers, criteria) {
    logger.debug('Selecting health-based provider', {
      providerCount: providers.length,
    });

    // Filter to only healthy providers
    const healthyProviders = providers.filter(p => p.healthStatus === 'healthy');
    
    if (healthyProviders.length === 0) {
      logger.warn('No healthy providers available, falling back to degraded providers');
      const degradedProviders = providers.filter(p => p.healthStatus === 'degraded');
      
      if (degradedProviders.length > 0) {
        return this.selectRoundRobinProvider(degradedProviders, criteria);
      }
      
      // Last resort: use any available provider
      return providers[0].adapter;
    }

    // Among healthy providers, use round-robin
    return this.selectRoundRobinProvider(healthyProviders, criteria);
  }

  /**
   * Weighted provider selection
   */
  selectWeightedProvider(providers, _criteria) {
    logger.debug('Selecting weighted provider', {
      providerCount: providers.length,
    });

    // Get weights from configuration or calculate based on health/performance
    const weightedProviders = providers.map(providerInfo => {
      const { adapter, name } = providerInfo;
      let weight = 1; // Default weight

      try {
        // Calculate weight based on health and performance
        const metrics = adapter.getMetrics ? adapter.getMetrics() : {};
        const successRate = metrics.totalRequests > 0 
          ? metrics.successfulRequests / metrics.totalRequests 
          : 0.5;
        
        const healthMultiplier = providerInfo.healthStatus === 'healthy' ? 1.0 :
          providerInfo.healthStatus === 'degraded' ? 0.5 : 0.1;

        weight = successRate * healthMultiplier;

        logger.debug('Provider weight calculation', {
          provider: name,
          successRate,
          healthStatus: providerInfo.healthStatus,
          healthMultiplier,
          finalWeight: weight,
        });
      } catch (error) {
        logger.warn('Failed to calculate weight for provider', {
          provider: name,
          error: error.message,
        });
      }

      return {
        ...providerInfo,
        weight: Math.max(weight, 0.01), // Minimum weight to avoid division by zero
      };
    });

    // Select provider using weighted random selection
    const totalWeight = weightedProviders.reduce((sum, p) => sum + p.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const providerInfo of weightedProviders) {
      currentWeight += providerInfo.weight;
      if (random <= currentWeight) {
        logger.info('Selected weighted provider', {
          provider: providerInfo.name,
          weight: providerInfo.weight,
          totalWeight,
        });
        return providerInfo.adapter;
      }
    }

    // Fallback to last provider
    return weightedProviders[weightedProviders.length - 1].adapter;
  }

  /**
   * Record request metrics for performance-based routing
   */
  recordRequestMetrics(providerName, responseTime, success) {
    const key = providerName;
    const existing = this.responseMetrics.get(key) || {
      totalRequests: 0,
      totalResponseTime: 0,
      successfulRequests: 0,
    };

    existing.totalRequests++;
    existing.totalResponseTime += responseTime;
    if (success) {
      existing.successfulRequests++;
    }

    this.responseMetrics.set(key, existing);

    // Keep only recent metrics (sliding window)
    if (existing.totalRequests > 1000) {
      existing.totalRequests = Math.floor(existing.totalRequests * 0.9);
      existing.totalResponseTime = Math.floor(existing.totalResponseTime * 0.9);
      existing.successfulRequests = Math.floor(existing.successfulRequests * 0.9);
    }
  }

  /**
   * Get routing statistics
   */
  getRoutingStats() {
    const stats = {
      strategy: this.routingStrategy,
      requestCounts: Object.fromEntries(this.requestCounts),
      responseMetrics: {},
    };

    // Calculate averages for response metrics
    for (const [provider, metrics] of this.responseMetrics) {
      stats.responseMetrics[provider] = {
        totalRequests: metrics.totalRequests,
        averageResponseTime: metrics.totalRequests > 0 
          ? metrics.totalResponseTime / metrics.totalRequests 
          : 0,
        successRate: metrics.totalRequests > 0 
          ? metrics.successfulRequests / metrics.totalRequests 
          : 0,
      };
    }

    return stats;
  }

  /**
   * Update routing strategy
   */
  setRoutingStrategy(strategy) {
    const validStrategies = [
      'cost_optimized',
      'performance', 
      'round_robin',
      'health_based',
      'weighted',
    ];

    if (!validStrategies.includes(strategy)) {
      throw new GatewayError(`Invalid routing strategy: ${strategy}`);
    }

    this.routingStrategy = strategy;
    logger.info('Routing strategy updated', { strategy });
  }

  /**
   * Reset routing metrics
   */
  resetMetrics() {
    this.requestCounts.clear();
    this.responseMetrics.clear();
    logger.info('Routing metrics reset');
  }

  /**
   * Initialize circuit breakers for providers
   */
  initializeCircuitBreakers() {
    const providers = ['openai', 'gemini']; // Get from config
    
    providers.forEach(provider => {
      this.circuitBreakers.set(provider, {
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failureCount: 0,
        failureThreshold: 5,
        timeout: 60000, // 1 minute
        lastFailureTime: 0,
        successCount: 0,
        halfOpenSuccessThreshold: 3
      });
      
      this.concurrencyLimits.set(provider, {
        current: 0,
        max: 100, // Configurable per provider
        queue: []
      });
    });
  }

  /**
   * Start request queue processing for burst traffic handling
   */
  startQueueProcessing() {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    
    const processQueue = async () => {
      while (this.processingQueue && this.requestQueue.length > 0) {
        const batch = this.requestQueue.splice(0, 10); // Process in batches
        
        await Promise.all(batch.map(async (request) => {
          try {
            const result = await this.processQueuedRequest(request);
            request.resolve(result);
          } catch (error) {
            request.reject(error);
          }
        }));
      }
      
      // Continue processing
      if (this.processingQueue) {
        setTimeout(processQueue, this.queueProcessingInterval);
      }
    };
    
    processQueue();
  }

  /**
   * Process a queued request
   */
  async processQueuedRequest(request) {
    const { availableProviders, criteria } = request;
    return this.selectBestProviderInternal(availableProviders, criteria);
  }

  /**
   * Enhanced provider selection with caching and circuit breaking
   */
  selectBestProvider(availableProviders, criteria = {}) {
    if (!this.initialized) {
      throw new GatewayError('Router service not initialized');
    }

    // Check cache first for high-frequency requests
    const cacheKey = this.generateCacheKey(availableProviders, criteria);
    const cachedResult = this.loadBalancingCache.get(cacheKey);
    
    if (cachedResult && Date.now() - cachedResult.timestamp < this.cacheTimeout) {
      // Verify cached provider is still healthy
      if (this.isProviderHealthy(cachedResult.provider)) {
        return cachedResult.provider;
      } else {
        // Remove stale cache entry
        this.loadBalancingCache.delete(cacheKey);
      }
    }

    // Handle burst traffic with queueing
    if (this.requestQueue.length > this.maxQueueSize) {
      throw new GatewayError('Request queue full', 503);
    }

    // For high-load scenarios, use async processing
    if (this.requestQueue.length > 100) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          availableProviders,
          criteria,
          resolve,
          reject,
          timestamp: Date.now()
        });
      });
    }

    return this.selectBestProviderInternal(availableProviders, criteria, cacheKey);
  }

  /**
   * Internal provider selection logic
   */
  selectBestProviderInternal(availableProviders, criteria, cacheKey) {
    if (!availableProviders || availableProviders.length === 0) {
      return null;
    }

    // Filter providers based on circuit breaker state
    const healthyProviders = availableProviders.filter(p => 
      this.isProviderHealthy(p.name) && this.checkCircuitBreaker(p.name)
    );

    if (healthyProviders.length === 0) {
      // Try half-open circuit breakers
      const halfOpenProviders = availableProviders.filter(p => {
        const breaker = this.circuitBreakers.get(p.name);
        return breaker && breaker.state === 'HALF_OPEN';
      });
      
      if (halfOpenProviders.length > 0) {
        return this.selectFromProviders(halfOpenProviders, criteria, cacheKey);
      }
      
      // Last resort: force reset a circuit breaker
      this.forceResetBestCircuitBreaker(availableProviders);
      return this.selectFromProviders(availableProviders, criteria, cacheKey);
    }

    return this.selectFromProviders(healthyProviders, criteria, cacheKey);
  }

  /**
   * Select from filtered providers and cache result
   */
  selectFromProviders(providers, criteria, cacheKey) {
    if (providers.length === 1) {
      const provider = providers[0].adapter;
      if (cacheKey) {
        this.cacheProviderSelection(cacheKey, provider);
      }
      return provider;
    }

    // Apply selection strategy with optimizations
    const strategy = criteria.routingStrategy || this.routingStrategy;
    let selectedProvider;
    
    switch (strategy) {
      case 'performance':
        selectedProvider = this.selectPerformanceBasedProviderOptimized(providers, criteria);
        break;
      case 'round_robin':
        selectedProvider = this.selectRoundRobinProviderOptimized(providers, criteria);
        break;
      case 'weighted':
        selectedProvider = this.selectWeightedProviderOptimized(providers, criteria);
        break;
      default:
        selectedProvider = this.selectCostOptimizedProvider(providers, criteria);
    }

    // Cache successful selection
    if (selectedProvider && cacheKey) {
      this.cacheProviderSelection(cacheKey, selectedProvider);
    }

    return selectedProvider;
  }

  /**
   * Generate cache key for provider selection
   */
  generateCacheKey(providers, criteria) {
    const providerNames = providers.map(p => p.name).sort().join(',');
    const model = criteria.model || 'default';
    const strategy = criteria.routingStrategy || this.routingStrategy;
    return `${strategy}:${model}:${providerNames}`;
  }

  /**
   * Cache provider selection
   */
  cacheProviderSelection(cacheKey, provider) {
    this.loadBalancingCache.set(cacheKey, {
      provider,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.loadBalancingCache.size > 1000) {
      const oldestKey = this.loadBalancingCache.keys().next().value;
      this.loadBalancingCache.delete(oldestKey);
    }
  }

  /**
   * Check circuit breaker state
   */
  checkCircuitBreaker(providerName) {
    const breaker = this.circuitBreakers.get(providerName);
    if (!breaker) return true;

    const now = Date.now();

    switch (breaker.state) {
      case 'CLOSED':
        return true;
        
      case 'OPEN':
        if (now - breaker.lastFailureTime > breaker.timeout) {
          breaker.state = 'HALF_OPEN';
          breaker.successCount = 0;
          logger.info(`Circuit breaker HALF_OPEN for provider: ${providerName}`);
          return true;
        }
        return false;
        
      case 'HALF_OPEN':
        return true;
        
      default:
        return true;
    }
  }

  /**
   * Record circuit breaker result
   */
  recordCircuitBreakerResult(providerName, success, responseTime) {
    const breaker = this.circuitBreakers.get(providerName);
    if (!breaker) return;

    if (success) {
      if (breaker.state === 'HALF_OPEN') {
        breaker.successCount++;
        if (breaker.successCount >= breaker.halfOpenSuccessThreshold) {
          breaker.state = 'CLOSED';
          breaker.failureCount = 0;
          logger.info(`Circuit breaker CLOSED for provider: ${providerName}`);
        }
      } else if (breaker.state === 'CLOSED') {
        breaker.failureCount = Math.max(0, breaker.failureCount - 1);
      }
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = Date.now();
      
      if (breaker.failureCount >= breaker.failureThreshold) {
        breaker.state = 'OPEN';
        logger.warn(`Circuit breaker OPEN for provider: ${providerName}`, {
          failureCount: breaker.failureCount,
          threshold: breaker.failureThreshold
        });
      }
    }

    // Record metrics with sliding window optimization
    this.recordRequestMetricsOptimized(providerName, responseTime, success);
  }

  /**
   * Optimized metrics recording with sliding window
   */
  recordRequestMetricsOptimized(providerName, responseTime, success) {
    const key = providerName;
    const existing = this.responseMetrics.get(key) || {
      totalRequests: 0,
      totalResponseTime: 0,
      successfulRequests: 0,
      recentRequests: [], // Sliding window
      lastUpdated: Date.now()
    };

    // Add to sliding window
    existing.recentRequests.push({
      responseTime,
      success,
      timestamp: Date.now()
    });

    // Maintain sliding window size
    if (existing.recentRequests.length > this.metricsWindow) {
      existing.recentRequests.shift();
    }

    // Update aggregate metrics
    existing.totalRequests++;
    existing.totalResponseTime += responseTime;
    if (success) {
      existing.successfulRequests++;
    }
    existing.lastUpdated = Date.now();

    this.responseMetrics.set(key, existing);
  }

  /**
   * Optimized performance-based selection
   */
  selectPerformanceBasedProviderOptimized(providers, criteria) {
    logger.debug('Selecting performance-based provider (optimized)', {
      providerCount: providers.length,
    });

    let bestProvider = null;
    let bestScore = Infinity;

    for (const providerInfo of providers) {
      const { adapter, name } = providerInfo;
      
      try {
        const metrics = this.responseMetrics.get(name);
        if (!metrics || metrics.recentRequests.length < 5) {
          // Not enough data, use fallback
          if (!bestProvider) bestProvider = adapter;
          continue;
        }

        // Calculate recent performance metrics
        const recentRequests = metrics.recentRequests.slice(-100); // Last 100 requests
        const recentSuccessful = recentRequests.filter(r => r.success);
        
        if (recentSuccessful.length === 0) continue;

        const avgResponseTime = recentSuccessful.reduce((sum, r) => sum + r.responseTime, 0) / recentSuccessful.length;
        const successRate = recentSuccessful.length / recentRequests.length;
        
        // Performance score (lower is better)
        const performanceScore = avgResponseTime * (1 / Math.max(successRate, 0.1));
        
        if (performanceScore < bestScore) {
          bestScore = performanceScore;
          bestProvider = adapter;
        }

      } catch (error) {
        logger.warn('Failed to calculate performance metrics', {
          provider: name,
          error: error.message,
        });
      }
    }

    return bestProvider || providers[0].adapter;
  }

  /**
   * Optimized round-robin selection with load balancing
   */
  selectRoundRobinProviderOptimized(providers, criteria) {
    const model = criteria.model || 'default';
    
    // Use weighted round-robin based on current load
    const availableProviders = providers.filter(p => {
      const limit = this.concurrencyLimits.get(p.name);
      return !limit || limit.current < limit.max;
    });

    if (availableProviders.length === 0) {
      // All providers at capacity, use regular round-robin
      const currentCount = this.requestCounts.get(model) || 0;
      const selectedIndex = currentCount % providers.length;
      this.requestCounts.set(model, currentCount + 1);
      return providers[selectedIndex].adapter;
    }

    // Select provider with lowest current load
    const sortedByLoad = availableProviders.sort((a, b) => {
      const loadA = this.concurrencyLimits.get(a.name)?.current || 0;
      const loadB = this.concurrencyLimits.get(b.name)?.current || 0;
      return loadA - loadB;
    });

    return sortedByLoad[0].adapter;
  }

  /**
   * Optimized weighted selection with real-time metrics
   */
  selectWeightedProviderOptimized(providers, criteria) {
    const weightedProviders = providers.map(providerInfo => {
      const { adapter, name } = providerInfo;
      let weight = 1;

      try {
        const metrics = this.responseMetrics.get(name);
        const breaker = this.circuitBreakers.get(name);
        const concurrency = this.concurrencyLimits.get(name);

        // Calculate weight based on recent performance
        if (metrics && metrics.recentRequests.length > 0) {
          const recent = metrics.recentRequests.slice(-50);
          const successRate = recent.filter(r => r.success).length / recent.length;
          const avgResponseTime = recent.filter(r => r.success)
            .reduce((sum, r) => sum + r.responseTime, 0) / recent.filter(r => r.success).length;
          
          // Weight factors
          const performanceFactor = Math.max(0.1, 1 / (avgResponseTime / 1000)); // Faster = higher weight
          const reliabilityFactor = successRate;
          const loadFactor = concurrency ? Math.max(0.1, 1 - (concurrency.current / concurrency.max)) : 1;
          const circuitFactor = breaker?.state === 'CLOSED' ? 1 : 0.1;

          weight = performanceFactor * reliabilityFactor * loadFactor * circuitFactor;
        }

      } catch (error) {
        logger.warn('Failed to calculate optimized weight', {
          provider: name,
          error: error.message,
        });
      }

      return {
        ...providerInfo,
        weight: Math.max(weight, 0.01)
      };
    });

    // Weighted random selection
    const totalWeight = weightedProviders.reduce((sum, p) => sum + p.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const providerInfo of weightedProviders) {
      currentWeight += providerInfo.weight;
      if (random <= currentWeight) {
        return providerInfo.adapter;
      }
    }

    return weightedProviders[weightedProviders.length - 1].adapter;
  }

  /**
   * Check if provider is healthy and available
   */
  isProviderHealthy(providerName) {
    const breaker = this.circuitBreakers.get(providerName);
    const concurrency = this.concurrencyLimits.get(providerName);
    
    return (!breaker || breaker.state !== 'OPEN') && 
           (!concurrency || concurrency.current < concurrency.max);
  }

  /**
   * Force reset the best available circuit breaker
   */
  forceResetBestCircuitBreaker(providers) {
    let bestProvider = null;
    let oldestFailure = Infinity;

    for (const provider of providers) {
      const breaker = this.circuitBreakers.get(provider.name);
      if (breaker && breaker.state === 'OPEN') {
        if (breaker.lastFailureTime < oldestFailure) {
          oldestFailure = breaker.lastFailureTime;
          bestProvider = provider.name;
        }
      }
    }

    if (bestProvider) {
      const breaker = this.circuitBreakers.get(bestProvider);
      breaker.state = 'HALF_OPEN';
      breaker.successCount = 0;
      logger.warn(`Force reset circuit breaker for provider: ${bestProvider}`);
    }
  }

  /**
   * Update concurrency tracking
   */
  updateConcurrency(providerName, increment = true) {
    const limit = this.concurrencyLimits.get(providerName);
    if (limit) {
      if (increment) {
        limit.current = Math.min(limit.current + 1, limit.max);
      } else {
        limit.current = Math.max(limit.current - 1, 0);
      }
    }
  }

  /**
   * Get enhanced routing statistics
   */
  getRoutingStatsOptimized() {
    const stats = {
      strategy: this.routingStrategy,
      highThroughputMode: true,
      requestCounts: Object.fromEntries(this.requestCounts),
      responseMetrics: {},
      circuitBreakers: {},
      concurrencyLimits: {},
      cacheStats: {
        size: this.loadBalancingCache.size,
        hitRate: 0 // Would need to track hits/misses
      },
      queueStats: {
        size: this.requestQueue.length,
        maxSize: this.maxQueueSize
      }
    };

    // Enhanced response metrics with sliding window data
    for (const [provider, metrics] of this.responseMetrics) {
      const recent = metrics.recentRequests.slice(-100);
      const successful = recent.filter(r => r.success);
      
      stats.responseMetrics[provider] = {
        totalRequests: metrics.totalRequests,
        recentRequests: recent.length,
        averageResponseTime: successful.length > 0 
          ? successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length 
          : 0,
        recentSuccessRate: recent.length > 0 ? successful.length / recent.length : 0,
        overallSuccessRate: metrics.totalRequests > 0 
          ? metrics.successfulRequests / metrics.totalRequests 
          : 0,
      };
    }

    // Circuit breaker states
    for (const [provider, breaker] of this.circuitBreakers) {
      stats.circuitBreakers[provider] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        failureThreshold: breaker.failureThreshold
      };
    }

    // Concurrency limits
    for (const [provider, limit] of this.concurrencyLimits) {
      stats.concurrencyLimits[provider] = {
        current: limit.current,
        max: limit.max,
        utilization: (limit.current / limit.max * 100).toFixed(1) + '%'
      };
    }

    return stats;
  }

  /**
   * Shutdown router service
   */
  async shutdown() {
    logger.info('Shutting down Router Service');
    
    this.processingQueue = false;
    this.initialized = false;
    this.requestCounts.clear();
    this.responseMetrics.clear();
    this.circuitBreakers.clear();
    this.concurrencyLimits.clear();
    this.loadBalancingCache.clear();
    this.requestQueue.length = 0;
    
    logger.info('Router Service shutdown completed');
  }
}

// Export singleton instance
module.exports = new RouterService();