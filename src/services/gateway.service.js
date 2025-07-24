/**
 * Main gateway orchestration service
 * 
 * Responsibilities:
 * - Request routing and delegation
 * - Provider failover handling
 * - Response aggregation and formatting
 * - Cross-cutting concerns coordination
 */

const { registry } = require('../providers/base/registry');
const routerService = require('./router.service');
const config = require('../config');
const logger = require('../utils/logger');
const { 
  GatewayError, 
  ModelNotFoundError,
  RateLimitError,
} = require('../utils/errors');

class GatewayService {
  constructor() {
    this.initialized = false;
    this.providerFailureCount = new Map();
    this.circuitBreakers = new Map();
    this.providers = new Map(); // Direct provider storage
    this.modelToProvider = new Map(); // Model to provider mapping
    this.providerHealthStatus = new Map(); // Provider health status
  }

  /**
   * Initialize the gateway service
   */
  async initialize() {
    try {
      logger.info('Initializing Gateway Service');

      // Initialize providers based on configuration
      await this.initializeProviders();

      // Initialize router service
      await routerService.initialize();
      
      // Set up health status callback from registry
      registry.setHealthStatusCallback((providerName, healthStatus) => {
        this.updateProviderHealth(providerName, healthStatus);
      });

      this.initialized = true;
      logger.info('Gateway Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gateway Service', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Initialize and register providers
   */
  async initializeProviders() {
    const providerConfigs = config.providers;
    const initPromises = [];

    // Initialize OpenAI provider
    if (providerConfigs.openai && providerConfigs.openai.enabled) {
      initPromises.push(this.initializeOpenAIProvider(providerConfigs.openai));
    }

    // Initialize Gemini provider
    if (providerConfigs.gemini && providerConfigs.gemini.enabled) {
      initPromises.push(this.initializeGeminiProvider(providerConfigs.gemini));
    }

    const results = await Promise.allSettled(initPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info('Provider initialization completed', {
      total: results.length,
      successful,
      failed,
    });

    if (failed > 0) {
      const errors = results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason.message);
      logger.warn('Some providers failed to initialize', { errors });
    }

    if (successful === 0) {
      throw new GatewayError('No providers were successfully initialized');
    }
  }

  /**
   * Initialize OpenAI provider
   */
  async initializeOpenAIProvider(config) {
    try {
      const OpenAIAdapter = require('../providers/openai/openai.adapter');
      const adapter = new OpenAIAdapter(config);
      
      await adapter.initialize();
      
      // Store provider directly
      this.providers.set('openai', adapter);
      
      // Build model-to-provider mapping
      const models = adapter.getSupportedModels();
      for (const model of models) {
        this.modelToProvider.set(model.id, 'openai');
      }
      
      // Register with registry for health monitoring only
      registry.register('openai', adapter);
      
      logger.info('OpenAI provider initialized and registered');
    } catch (error) {
      logger.error('Failed to initialize OpenAI provider', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Initialize Gemini provider
   */
  async initializeGeminiProvider(config) {
    try {
      const GeminiAdapter = require('../providers/gemini/gemini.adapter');
      const adapter = new GeminiAdapter(config);
      
      await adapter.initialize();
      
      // Store provider directly
      this.providers.set('gemini', adapter);
      
      // Build model-to-provider mapping
      const models = adapter.getSupportedModels();
      for (const model of models) {
        this.modelToProvider.set(model.id, 'gemini');
      }
      
      // Register with registry for health monitoring only
      registry.register('gemini', adapter);
      
      logger.info('Gemini provider initialized and registered');
    } catch (error) {
      logger.error('Failed to initialize Gemini provider', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process chat completion request
   */
  async createChatCompletion(request, options = {}) {
    this.ensureInitialized();

    const { model, ...requestData } = request;
    const requestId = options.requestId;

    try {
      logger.info('Processing chat completion request', {
        requestId,
        model,
        streaming: requestData.stream || false,
      });

      // Get appropriate provider for the model
      const provider = await this.selectProvider(model, 'completion', options);
      
      if (!provider) {
        throw new ModelNotFoundError(model, {
          availableModels: this.getAvailableModels().map(m => m.id),
        });
      }

      // Execute request with failover - use streamCompletion for streaming requests
      const method = requestData.stream ? 'streamCompletion' : 'generateCompletion';
      const result = await this.executeWithFailover(
        method,
        provider,
        request,
        options,
      );

      logger.info('Chat completion request completed', {
        requestId,
        model,
        provider: provider.constructor.name,
      });

      return result;
    } catch (error) {
      logger.error('Chat completion request failed', {
        requestId,
        model,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process embeddings request
   */
  async createEmbeddings(request, options = {}) {
    this.ensureInitialized();

    const { model, ...requestData } = request;
    const requestId = options.requestId;

    try {
      logger.info('Processing embeddings request', {
        requestId,
        model,
        inputType: Array.isArray(requestData.input) ? 'array' : 'string',
      });

      // Get appropriate provider for the model
      const provider = await this.selectProvider(model, 'embedding', options);
      
      if (!provider) {
        throw new ModelNotFoundError(model, {
          availableModels: this.getAvailableModels()
            .filter(m => m.capabilities.includes('embedding'))
            .map(m => m.id),
        });
      }

      // Execute request with failover
      const result = await this.executeWithFailover(
        'generateEmbedding',
        provider,
        request,
        options,
      );

      logger.info('Embeddings request completed', {
        requestId,
        model,
        provider: provider.constructor.name,
      });

      return result;
    } catch (error) {
      logger.error('Embeddings request failed', {
        requestId,
        model,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process audio transcription request
   */
  async createTranscription(request, options = {}) {
    this.ensureInitialized();

    const { model } = request;
    const requestId = options.requestId;

    try {
      logger.info('Processing transcription request', {
        requestId,
        model,
      });

      // Get appropriate provider for the model
      const provider = await this.selectProvider(model, 'transcription', options);
      
      if (!provider) {
        throw new ModelNotFoundError(model, {
          availableModels: this.getAvailableModels()
            .filter(m => m.capabilities.includes('transcription'))
            .map(m => m.id),
        });
      }

      // Execute request with failover
      const result = await this.executeWithFailover(
        'transcribeAudio',
        provider,
        request,
        options,
      );

      logger.info('Transcription request completed', {
        requestId,
        model,
        provider: provider.constructor.name,
      });

      return result;
    } catch (error) {
      logger.error('Transcription request failed', {
        requestId,
        model,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Select appropriate provider for request
   */
  async selectProvider(model, capability, options = {}) {
    const criteria = {
      model,
      capability,
      excludeUnhealthy: true,
      ...options.routingCriteria,
    };

    // Get provider that supports this model
    const providerName = this.modelToProvider.get(model);
    if (!providerName) {
      logger.warn('No provider found for model', { model });
      return null;
    }

    // Get eligible providers (for now just the one that supports the model)
    const eligibleProviders = [];
    const provider = this.providers.get(providerName);
    
    if (provider) {
      // Check if provider is healthy and circuit breaker is not open
      const healthStatus = this.providerHealthStatus.get(providerName) || 'unknown';
      const isCircuitOpen = this.isCircuitBreakerOpen(providerName);
      
      if (healthStatus !== 'unhealthy' && !isCircuitOpen) {
        eligibleProviders.push({
          name: providerName,
          adapter: provider,
          healthStatus,
        });
      }
    }

    if (eligibleProviders.length === 0) {
      logger.warn('No available providers after filtering', {
        model,
        capability,
        providerName,
      });
      return null;
    }

    // Use router service for selection (for future multi-provider scenarios)
    return routerService.selectBestProvider(eligibleProviders, criteria);
  }

  /**
   * Execute request with failover support
   */
  async executeWithFailover(method, primaryProvider, request, options = {}) {
    const maxRetries = config.routing?.maxRetries || 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await primaryProvider[method](request, options);
        
        // Reset failure count on success
        this.resetProviderFailures(primaryProvider.constructor.name);
        
        return result;
      } catch (error) {
        lastError = error;
        
        logger.warn(`Provider request failed (attempt ${attempt}/${maxRetries})`, {
          provider: primaryProvider.constructor.name,
          method,
          error: error.message,
          requestId: options.requestId,
        });

        // Record failure
        this.recordProviderFailure(primaryProvider.constructor.name);
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          break;
        }

        // Try failover on last attempt
        if (attempt === maxRetries) {
          const fallbackProvider = await this.selectFallbackProvider(
            primaryProvider,
            request.model,
            options,
          );

          if (fallbackProvider) {
            try {
              const result = await fallbackProvider[method](request, options);
              
              logger.info('Failover successful', {
                primaryProvider: primaryProvider.constructor.name,
                fallbackProvider: fallbackProvider.constructor.name,
                requestId: options.requestId,
              });
              
              return result;
            } catch (failoverError) {
              logger.error('Failover also failed', {
                fallbackProvider: fallbackProvider.constructor.name,
                error: failoverError.message,
                requestId: options.requestId,
              });
            }
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new GatewayError('Request failed after all retry attempts');
  }

  /**
   * Select fallback provider
   */
  async selectFallbackProvider(failedProvider, model, _options) {
    // For now, we only have one provider per model, so no fallback available
    // In future, when multiple providers support same model, implement fallback logic
    logger.debug('No fallback provider available for model', { model });
    return null;
  }

  /**
   * Record provider failure for circuit breaker
   */
  recordProviderFailure(providerName) {
    const current = this.providerFailureCount.get(providerName) || 0;
    this.providerFailureCount.set(providerName, current + 1);

    const threshold = config.routing?.circuitBreakerThreshold || 5;
    if (current + 1 >= threshold) {
      this.openCircuitBreaker(providerName);
    }
  }

  /**
   * Reset provider failure count
   */
  resetProviderFailures(providerName) {
    this.providerFailureCount.set(providerName, 0);
    this.closeCircuitBreaker(providerName);
  }

  /**
   * Open circuit breaker for provider
   */
  openCircuitBreaker(providerName) {
    const timeout = config.routing?.circuitBreakerTimeout || 60000;
    this.circuitBreakers.set(providerName, Date.now() + timeout);
    
    logger.warn(`Circuit breaker opened for provider: ${providerName}`, {
      timeout: timeout / 1000,
    });
  }

  /**
   * Close circuit breaker for provider
   */
  closeCircuitBreaker(providerName) {
    if (this.circuitBreakers.has(providerName)) {
      this.circuitBreakers.delete(providerName);
      logger.info(`Circuit breaker closed for provider: ${providerName}`);
    }
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitBreakerOpen(providerName) {
    const breakerTime = this.circuitBreakers.get(providerName);
    if (!breakerTime) return false;

    if (Date.now() > breakerTime) {
      this.closeCircuitBreaker(providerName);
      return false;
    }

    return true;
  }

  /**
   * Check if error should not trigger retry
   */
  isNonRetryableError(error) {
    return error instanceof RateLimitError ||
           error instanceof ModelNotFoundError ||
           (error.statusCode >= 400 && error.statusCode < 500);
  }

  /**
   * Get available models from all providers
   */
  getAvailableModels() {
    const models = [];
    
    for (const [providerName, provider] of this.providers) {
      if (provider.isInitialized) {
        try {
          const providerModels = provider.getSupportedModels();
          for (const model of providerModels) {
            models.push({
              id: model.id,
              provider: providerName,
              capabilities: model.capabilities || [],
              maxTokens: model.maxTokens,
              multimodal: model.multimodal || false,
              type: model.type || 'completion',
            });
          }
        } catch (error) {
          logger.warn(`Failed to get models from provider ${providerName}`, {
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
    const providerName = this.modelToProvider.get(modelId);
    if (!providerName) {
      return null;
    }
    
    const provider = this.providers.get(providerName);
    if (!provider || !provider.isInitialized) {
      return null;
    }
    
    try {
      const models = provider.getSupportedModels();
      const model = models.find(m => m.id === modelId);
      if (model) {
        return {
          ...model,
          provider: providerName,
        };
      }
    } catch (error) {
      logger.warn(`Failed to get model info from provider ${providerName}`, {
        error: error.message,
      });
    }
    
    return null;
  }

  /**
   * Get provider for a specific model
   */
  getProviderForModel(modelId) {
    const providerName = this.modelToProvider.get(modelId);
    if (!providerName) {
      return null;
    }
    
    const provider = this.providers.get(providerName);
    if (!provider) {
      return null;
    }
    
    return {
      name: providerName,
      adapter: provider,
    };
  }

  /**
   * Update provider health status (called by registry health checks)
   */
  updateProviderHealth(providerName, healthStatus) {
    this.providerHealthStatus.set(providerName, healthStatus);
  }

  /**
   * Get gateway status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      providers: registry.getRegistryStatus(),
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      failureCounts: Object.fromEntries(this.providerFailureCount),
    };
  }

  /**
   * Ensure gateway is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new GatewayError('Gateway service not initialized');
    }
  }

  /**
   * Shutdown gateway service
   */
  async shutdown() {
    logger.info('Shutting down Gateway Service');
    
    try {
      await routerService.shutdown();
      await registry.destroy();
      
      this.initialized = false;
      this.providerFailureCount.clear();
      this.circuitBreakers.clear();
      this.providers.clear();
      this.modelToProvider.clear();
      this.providerHealthStatus.clear();
      
      logger.info('Gateway Service shutdown completed');
    } catch (error) {
      logger.error('Error during Gateway Service shutdown', {
        error: error.message,
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new GatewayService();