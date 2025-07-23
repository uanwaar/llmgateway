const { ProviderError } = require('../../utils/errors');

class ProviderInterface {
  constructor(config) {
    if (this.constructor === ProviderInterface) {
      throw new Error('ProviderInterface is abstract and cannot be instantiated directly');
    }
    this.config = config;
    this.name = this.constructor.name.replace('Adapter', '').toLowerCase();
  }

  async initialize() {
    throw new Error('initialize() method must be implemented by provider');
  }

  async healthCheck() {
    throw new Error('healthCheck() method must be implemented by provider');
  }

  async generateCompletion(_request) {
    throw new Error('generateCompletion() method must be implemented by provider');
  }

  async generateEmbedding(_request) {
    throw new Error('generateEmbedding() method must be implemented by provider');
  }

  async streamCompletion(_request) {
    throw new Error('streamCompletion() method must be implemented by provider');
  }

  async listModels() {
    throw new Error('listModels() method must be implemented by provider');
  }

  getModelInfo(_modelId) {
    throw new Error('getModelInfo() method must be implemented by provider');
  }

  validateRequest(request) {
    if (!request) {
      throw new ProviderError('Request is required', 'INVALID_REQUEST', this.name);
    }
    if (!request.model) {
      throw new ProviderError('Model is required', 'INVALID_REQUEST', this.name);
    }
    return true;
  }

  isSupported(feature) {
    const supportedFeatures = this.getSupportedFeatures();
    return supportedFeatures.includes(feature);
  }

  getSupportedFeatures() {
    return ['completion', 'embedding', 'streaming'];
  }

  getProviderInfo() {
    return {
      name: this.name,
      version: this.config.version || '1.0.0',
      features: this.getSupportedFeatures(),
      models: this.getAvailableModels(),
      endpoint: this.config.endpoint,
    };
  }

  getAvailableModels() {
    throw new Error('getAvailableModels() method must be implemented by provider');
  }

  getRateLimits() {
    return this.config.rateLimits || {
      requestsPerMinute: 60,
      tokensPerMinute: 10000,
    };
  }

  getCostInfo(model) {
    const costs = this.config.costs || {};
    return costs[model] || { inputCost: 0, outputCost: 0, currency: 'USD' };
  }

  async destroy() {
    // Clean up resources if needed
  }
}

module.exports = ProviderInterface;