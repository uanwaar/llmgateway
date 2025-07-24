const { logger } = require('../../utils/logger');
const { ProviderError } = require('../../utils/errors');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 30000; // 30 seconds
    this.healthStatusCallback = null; // Callback to notify gateway service
  }

  register(name, adapter) {
    if (!name || typeof name !== 'string') {
      throw new ProviderError('Provider name must be a non-empty string', 'INVALID_PROVIDER_NAME');
    }

    if (!adapter || typeof adapter !== 'object') {
      throw new ProviderError('Provider adapter must be an object', 'INVALID_PROVIDER_ADAPTER');
    }

    if (this.providers.has(name)) {
      logger.warn(`Provider ${name} is already registered, replacing existing registration`);
    }

    this.providers.set(name, {
      adapter,
      registeredAt: new Date(),
      lastHealthCheck: null,
      healthStatus: 'unknown',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
      },
    });

    logger.info(`Provider ${name} registered successfully`, { provider: name });

    // Start health check monitoring if this is the first provider
    if (this.providers.size === 1) {
      this.startHealthCheckMonitoring();
    }
  }

  unregister(name) {
    if (!this.providers.has(name)) {
      throw new ProviderError(`Provider ${name} is not registered`, 'PROVIDER_NOT_FOUND');
    }

    const providerInfo = this.providers.get(name);
    
    // Clean up the adapter
    if (providerInfo.adapter && typeof providerInfo.adapter.destroy === 'function') {
      providerInfo.adapter.destroy().catch(error => {
        logger.warn(`Error destroying provider ${name}`, { provider: name, error: error.message });
      });
    }

    this.providers.delete(name);
    logger.info(`Provider ${name} unregistered successfully`, { provider: name });

    // Stop health check monitoring if no providers remain
    if (this.providers.size === 0) {
      this.stopHealthCheckMonitoring();
    }
  }

  get(name) {
    const providerInfo = this.providers.get(name);
    return providerInfo ? providerInfo.adapter : null;
  }

  list() {
    return Array.from(this.providers.keys());
  }

  getAll() {
    const result = {};
    for (const [name, info] of this.providers) {
      result[name] = info.adapter;
    }
    return result;
  }

  isRegistered(name) {
    return this.providers.has(name);
  }

  getHealthy() {
    const healthy = [];
    for (const [, info] of this.providers) {
      if (info.healthStatus === 'healthy') {
        healthy.push(info.adapter);
      }
    }
    return healthy;
  }

  getUnhealthy() {
    const unhealthy = [];
    for (const [name, info] of this.providers) {
      if (info.healthStatus === 'unhealthy') {
        unhealthy.push({
          name,
          adapter: info.adapter,
          lastHealthCheck: info.lastHealthCheck,
        });
      }
    }
    return unhealthy;
  }

  getBest(criteria = {}) {
    const availableProviders = this.getEligibleProviders(criteria);
    
    if (availableProviders.length === 0) {
      return null;
    }

    if (availableProviders.length === 1) {
      return availableProviders[0].adapter;
    }

    return this.selectBestProvider(availableProviders, criteria);
  }

  /**
   * Get all available models from registered providers
   */
  getAvailableModels() {
    const models = [];
    
    for (const [name, info] of this.providers) {
      if (info.healthStatus === 'healthy' && info.adapter.isInitialized) {
        try {
          const providerModels = info.adapter.getSupportedModels();
          for (const model of providerModels) {
            models.push({
              id: model.id,
              provider: name,
              capabilities: model.capabilities || [],
              maxTokens: model.maxTokens,
              multimodal: model.multimodal || false,
              type: model.type || 'completion',
            });
          }
        } catch (error) {
          logger.warn(`Failed to get models from provider ${name}`, {
            error: error.message,
          });
        }
      }
    }
    
    return models;
  }

  /**
   * Get model information by ID
   */
  getModelInfo(modelId) {
    for (const [name, info] of this.providers) {
      if (info.healthStatus === 'healthy' && info.adapter.isInitialized) {
        try {
          const models = info.adapter.getSupportedModels();
          const model = models.find(m => m.id === modelId);
          if (model) {
            return {
              ...model,
              provider: name,
            };
          }
        } catch (error) {
          logger.warn(`Failed to get model info from provider ${name}`, {
            error: error.message,
          });
        }
      }
    }
    
    return null;
  }

  /**
   * Get the best provider for a specific model
   */
  getProviderForModel(modelId) {
    const modelInfo = this.getModelInfo(modelId);
    if (!modelInfo) {
      return null;
    }
    
    return this.get(modelInfo.provider);
  }

  getEligibleProviders(criteria) {
    const eligible = [];

    // If a specific model is required, first find which provider supports it
    let targetProviderName = null;
    if (criteria.model) {
      const modelInfo = this.getModelInfo(criteria.model);
      if (!modelInfo) {
        return []; // Model not found in any provider
      }
      targetProviderName = modelInfo.provider;
    }

    for (const [name, info] of this.providers) {
      // Skip if provider is excluded
      if (criteria.excludeProviders && criteria.excludeProviders.includes(name)) {
        continue;
      }

      // Skip if specific providers are required and this isn't one of them
      if (criteria.requireProviders && !criteria.requireProviders.includes(name)) {
        continue;
      }

      // Skip unhealthy providers unless explicitly allowed
      if (info.healthStatus === 'unhealthy' && criteria.excludeUnhealthy !== false) {
        continue;
      }

      // If a model is specified, only include the provider that supports it
      if (targetProviderName && name !== targetProviderName) {
        continue;
      }

      // Check if provider supports required feature
      if (criteria.feature && !info.adapter.isSupported(criteria.feature)) {
        continue;
      }

      eligible.push({ name, ...info });
    }

    return eligible;
  }

  selectBestProvider(providers, criteria) {
    let selected = providers[0];

    switch (criteria.performance) {
    case 'fastest':
      selected = this.selectFastestProvider(providers);
      break;
    case 'most_reliable':
      selected = this.selectMostReliableProvider(providers);
      break;
    default:
      // Default to cost-based selection
      if (criteria.cost === 'lowest') {
        selected = this.selectCheapestProvider(providers, criteria.model);
      } else if (criteria.cost === 'highest') {
        selected = this.selectMostExpensiveProvider(providers, criteria.model);
      }
    }

    return selected.adapter;
  }

  selectFastestProvider(providers) {
    return providers.reduce((fastest, current) => {
      const fastestMetrics = fastest.adapter.getMetrics();
      const currentMetrics = current.adapter.getMetrics();
      
      return currentMetrics.averageResponseTime < fastestMetrics.averageResponseTime 
        ? current 
        : fastest;
    });
  }

  selectMostReliableProvider(providers) {
    return providers.reduce((most, current) => {
      const mostMetrics = most.adapter.getMetrics();
      const currentMetrics = current.adapter.getMetrics();
      
      const mostSuccessRate = mostMetrics.totalRequests > 0 
        ? mostMetrics.successfulRequests / mostMetrics.totalRequests 
        : 0;
      const currentSuccessRate = currentMetrics.totalRequests > 0 
        ? currentMetrics.successfulRequests / currentMetrics.totalRequests 
        : 0;
      
      return currentSuccessRate > mostSuccessRate ? current : most;
    });
  }

  selectCheapestProvider(providers, model) {
    return providers.reduce((cheapest, current) => {
      const cheapestCost = cheapest.adapter.getCostInfo(model);
      const currentCost = current.adapter.getCostInfo(model);
      
      const cheapestTotal = cheapestCost.inputCost + cheapestCost.outputCost;
      const currentTotal = currentCost.inputCost + currentCost.outputCost;
      
      return currentTotal < cheapestTotal ? current : cheapest;
    });
  }

  selectMostExpensiveProvider(providers, model) {
    return providers.reduce((expensive, current) => {
      const expensiveCost = expensive.adapter.getCostInfo(model);
      const currentCost = current.adapter.getCostInfo(model);
      
      const expensiveTotal = expensiveCost.inputCost + expensiveCost.outputCost;
      const currentTotal = currentCost.inputCost + currentCost.outputCost;
      
      return currentTotal > expensiveTotal ? current : expensive;
    });
  }

  async initializeAll() {
    const initPromises = [];
    
    for (const [name, info] of this.providers) {
      if (!info.adapter.isInitialized) {
        initPromises.push(
          info.adapter.initialize()
            .then(() => {
              logger.info(`Provider ${name} initialized successfully`);
              return { name, success: true };
            })
            .catch(error => {
              logger.error(`Failed to initialize provider ${name}`, { error: error.message });
              return { name, success: false, error: error.message };
            }),
        );
      }
    }

    const results = await Promise.allSettled(initPromises);
    const summary = {
      total: results.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          summary.successful++;
        } else {
          summary.failed++;
          summary.errors.push({
            provider: result.value.name,
            error: result.value.error,
          });
        }
      } else {
        summary.failed++;
        summary.errors.push({
          provider: 'unknown',
          error: result.reason.message,
        });
      }
    });

    logger.info('Provider initialization completed', summary);
    return summary;
  }

  startHealthCheckMonitoring() {
    if (this.healthCheckInterval) {
      return; // Already running
    }

    logger.info('Starting provider health check monitoring');
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.healthCheckIntervalMs);

    // Perform initial health check
    setImmediate(() => this.performHealthChecks());
  }

  stopHealthCheckMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Stopped provider health check monitoring');
    }
  }

  /**
   * Set callback for health status updates
   */
  setHealthStatusCallback(callback) {
    this.healthStatusCallback = callback;
  }

  async performHealthChecks() {
    const healthPromises = [];

    for (const [name, info] of this.providers) {
      healthPromises.push(
        info.adapter.healthCheck()
          .then(result => {
            info.lastHealthCheck = new Date();
            info.healthStatus = result.status;
            
            // Notify gateway service of health status change
            if (this.healthStatusCallback) {
              this.healthStatusCallback(name, result.status);
            }
            
            return { name, result };
          })
          .catch(error => {
            info.lastHealthCheck = new Date();
            info.healthStatus = 'unhealthy';
            
            // Notify gateway service of health status change
            if (this.healthStatusCallback) {
              this.healthStatusCallback(name, 'unhealthy');
            }
            
            return { name, error: error.message };
          }),
      );
    }

    const results = await Promise.allSettled(healthPromises);
    const healthSummary = {
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
    };

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const { name, result: healthResult, error } = result.value;
        
        if (error) {
          healthSummary.unhealthy++;
          logger.warn(`Health check failed for provider ${name}`, { provider: name, error });
        } else {
          healthSummary[healthResult.status]++;
          logger.debug(`Health check completed for provider ${name}`, { 
            provider: name, 
            status: healthResult.status,
            responseTime: healthResult.responseTime,
          });
        }
      }
    });

    logger.debug('Health check summary', healthSummary);
  }

  getRegistryStatus() {
    const status = {
      totalProviders: this.providers.size,
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
      unknown: 0,
      providers: {},
    };

    for (const [name, info] of this.providers) {
      status[info.healthStatus]++;
      status.providers[name] = {
        healthStatus: info.healthStatus,
        registeredAt: info.registeredAt,
        lastHealthCheck: info.lastHealthCheck,
        metrics: info.metrics,
      };
    }

    return status;
  }

  async destroy() {
    logger.info('Destroying provider registry');
    
    this.stopHealthCheckMonitoring();
    
    const destroyPromises = [];
    for (const [name, info] of this.providers) {
      if (info.adapter && typeof info.adapter.destroy === 'function') {
        destroyPromises.push(
          info.adapter.destroy().catch(error => {
            logger.warn(`Error destroying provider ${name}`, { error: error.message });
          }),
        );
      }
    }

    await Promise.allSettled(destroyPromises);
    this.providers.clear();
    
    logger.info('Provider registry destroyed');
  }
}

// Singleton instance
const registry = new ProviderRegistry();

module.exports = { ProviderRegistry, registry };