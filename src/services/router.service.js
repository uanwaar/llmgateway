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

      logger.info('Router Service initialized', {
        strategy: this.routingStrategy,
        failoverEnabled: this.failoverEnabled,
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
   * Shutdown router service
   */
  async shutdown() {
    logger.info('Shutting down Router Service');
    
    this.initialized = false;
    this.requestCounts.clear();
    this.responseMetrics.clear();
    
    logger.info('Router Service shutdown completed');
  }
}

// Export singleton instance
module.exports = new RouterService();