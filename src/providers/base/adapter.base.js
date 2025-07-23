const ProviderInterface = require('./provider.interface');
const { logger } = require('../../utils/logger');
const { ProviderError, RateLimitError } = require('../../utils/errors');
const crypto = require('crypto');

class BaseAdapter extends ProviderInterface {
  constructor(config) {
    super(config);
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
    this.isInitialized = false;
    this.healthStatus = 'unknown';
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastHealthCheck: null,
    };
  }

  async initialize() {
    try {
      logger.info(`Initializing ${this.name} provider`, { provider: this.name });
      
      await this._validateConfiguration();
      await this._setupClient();
      await this.healthCheck();
      
      this.isInitialized = true;
      logger.info(`${this.name} provider initialized successfully`, { provider: this.name });
      
      return true;
    } catch (error) {
      logger.error(`Failed to initialize ${this.name} provider`, { 
        provider: this.name, 
        error: error.message, 
      });
      throw new ProviderError(
        `Initialization failed: ${error.message}`, 
        'INITIALIZATION_FAILED', 
        this.name,
      );
    }
  }

  async _validateConfiguration() {
    if (!this.config) {
      throw new Error('Configuration is required');
    }
    if (!this.config.apiKey && !this.config.endpoint) {
      throw new Error('Either apiKey or endpoint must be provided');
    }
  }

  async _setupClient() {
    // Override in child classes to setup HTTP client
  }

  async healthCheck() {
    const startTime = Date.now();
    
    try {
      const result = await this._performHealthCheck();
      const responseTime = Date.now() - startTime;
      
      this.healthStatus = 'healthy';
      this.metrics.lastHealthCheck = new Date();
      
      logger.debug(`Health check passed for ${this.name}`, {
        provider: this.name,
        responseTime,
        status: this.healthStatus,
      });
      
      return {
        status: 'healthy',
        provider: this.name,
        responseTime,
        timestamp: new Date(),
        details: result,
      };
    } catch (error) {
      this.healthStatus = 'unhealthy';
      this.metrics.lastHealthCheck = new Date();
      
      logger.warn(`Health check failed for ${this.name}`, {
        provider: this.name,
        error: error.message,
        status: this.healthStatus,
      });
      
      return {
        status: 'unhealthy',
        provider: this.name,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  async _performHealthCheck() {
    // Override in child classes to implement specific health checks
    return { message: 'Base health check passed' };
  }

  async generateCompletion(request) {
    return this._executeWithMetrics('generateCompletion', async () => {
      this.validateRequest(request);
      await this._checkRateLimit();
      
      const normalizedRequest = await this._normalizeRequest(request);
      const response = await this._makeCompletionRequest(normalizedRequest);
      
      return this._normalizeResponse(response);
    });
  }

  async generateEmbedding(request) {
    return this._executeWithMetrics('generateEmbedding', async () => {
      this.validateRequest(request);
      await this._checkRateLimit();
      
      const normalizedRequest = await this._normalizeEmbeddingRequest(request);
      const response = await this._makeEmbeddingRequest(normalizedRequest);
      
      return this._normalizeEmbeddingResponse(response);
    });
  }

  async streamCompletion(request) {
    this.validateRequest(request);
    await this._checkRateLimit();
    
    const normalizedRequest = await this._normalizeRequest(request);
    return this._makeStreamingRequest(normalizedRequest);
  }

  async _executeWithMetrics(operation, fn) {
    const startTime = Date.now();
    const requestId = this._generateRequestId();
    
    this.metrics.totalRequests++;
    
    logger.info(`Starting ${operation}`, {
      provider: this.name,
      operation,
      requestId,
    });
    
    try {
      const result = await fn();
      const responseTime = Date.now() - startTime;
      
      this.metrics.successfulRequests++;
      this._updateAverageResponseTime(responseTime);
      
      logger.info(`${operation} completed successfully`, {
        provider: this.name,
        operation,
        requestId,
        responseTime,
      });
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metrics.failedRequests++;
      
      logger.error(`${operation} failed`, {
        provider: this.name,
        operation,
        requestId,
        responseTime,
        error: error.message,
      });
      
      throw error;
    }
  }

  async _checkRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const rateLimits = this.getRateLimits();
    
    if (timeSinceLastRequest < (60000 / rateLimits.requestsPerMinute)) {
      throw new RateLimitError(
        'Rate limit exceeded',
        this.name,
        rateLimits.requestsPerMinute,
      );
    }
    
    this.lastRequestTime = now;
    this.requestCount++;
  }

  _generateRequestId() {
    return crypto.randomBytes(8).toString('hex');
  }

  _updateAverageResponseTime(responseTime) {
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageResponseTime = (
      (this.metrics.averageResponseTime * (totalRequests - 1)) + responseTime
    ) / totalRequests;
  }

  async _normalizeRequest(_request) {
    // Override in child classes to normalize requests
    return _request;
  }

  async _normalizeEmbeddingRequest(_request) {
    // Override in child classes to normalize embedding requests
    return _request;
  }

  _normalizeResponse(_response) {
    // Override in child classes to normalize responses
    return _response;
  }

  _normalizeEmbeddingResponse(_response) {
    // Override in child classes to normalize embedding responses
    return _response;
  }

  async _makeCompletionRequest(_request) {
    throw new Error('_makeCompletionRequest() must be implemented by provider');
  }

  async _makeEmbeddingRequest(_request) {
    throw new Error('_makeEmbeddingRequest() must be implemented by provider');
  }

  async _makeStreamingRequest(_request) {
    throw new Error('_makeStreamingRequest() must be implemented by provider');
  }

  getMetrics() {
    return {
      ...this.metrics,
      provider: this.name,
      healthStatus: this.healthStatus,
      isInitialized: this.isInitialized,
    };
  }

  async destroy() {
    logger.info(`Destroying ${this.name} provider`, { provider: this.name });
    this.isInitialized = false;
    this.healthStatus = 'destroyed';
  }
}

module.exports = BaseAdapter;