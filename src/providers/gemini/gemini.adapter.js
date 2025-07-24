const BaseAdapter = require('../base/adapter.base');
const GeminiClient = require('./gemini.client');
const GeminiTransformer = require('./gemini.transformer');
const { GeminiModels } = require('./gemini.models');
const { logger } = require('../../utils/logger');
const { ProviderError, ValidationError } = require('../../utils/errors');

class GeminiAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.client = null;
    this.models = GeminiModels;
    this.contextCache = new Map();
    this.cacheTimeout = config.cacheTimeout || 3600000; // 1 hour default
  }

  async _setupClient() {
    try {
      this.client = new GeminiClient(this.config);
      logger.debug('Gemini client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gemini client', { error: error.message });
      throw new ProviderError(
        `Gemini client initialization failed: ${error.message}`,
        'CLIENT_INITIALIZATION_FAILED',
        'gemini',
      );
    }
  }

  async _performHealthCheck() {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    try {
      const result = await this.client.healthCheck();
      
      if (result.status === 'healthy') {
        return {
          status: 'healthy',
          message: 'Gemini API is accessible',
          timestamp: result.timestamp,
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw new ProviderError(
        `Gemini health check failed: ${error.message}`,
        'HEALTH_CHECK_FAILED',
        'gemini',
      );
    }
  }

  async _normalizeRequest(request) {
    const validation = this.models.validateModel(request.model, 'completion');
    if (!validation.valid) {
      throw new ValidationError(validation.error, 'INVALID_MODEL', 'gemini');
    }

    const transformedRequest = GeminiTransformer.transformChatRequest(request);
    // Preserve the model field for the adapter to use
    transformedRequest.model = request.model;
    
    return transformedRequest;
  }

  async _normalizeEmbeddingRequest(request) {
    const validation = this.models.validateModel(request.model, 'embedding');
    if (!validation.valid) {
      throw new ValidationError(validation.error, 'INVALID_MODEL', 'gemini');
    }

    return GeminiTransformer.transformEmbeddingRequest(request);
  }

  _normalizeResponse(response) {
    return response;
  }

  _normalizeEmbeddingResponse(response) {
    return response;
  }

  async _makeCompletionRequest(request) {
    if (!this.client) {
      throw new ProviderError(
        'Gemini client not initialized',
        'CLIENT_NOT_INITIALIZED',
        'gemini',
      );
    }

    try {
      logger.debug('Making Gemini completion request', {
        model: request.model,
        contentCount: request.contents?.length,
      });

      const model = request.model;
      const requestData = await this._addContextCaching(request);
      
      const response = await this.client.generateContent(model, requestData);
      return GeminiTransformer.transformChatResponse(response, request);
    } catch (error) {
      logger.error('Gemini completion request failed', {
        error: error.message,
        model: request.model,
      });
      throw error;
    }
  }

  async _makeEmbeddingRequest(request) {
    if (!this.client) {
      throw new ProviderError(
        'Gemini client not initialized',
        'CLIENT_NOT_INITIALIZED',
        'gemini',
      );
    }

    try {
      logger.debug('Making Gemini embedding request', {
        model: request.model,
        isBatch: request.requests !== undefined,
      });

      const model = request.model;
      
      // Handle batch embeddings
      if (request.requests) {
        const response = await this.client.batchEmbedContents(model, request);
        return GeminiTransformer.transformEmbeddingResponse(response, request);
      }
      
      // Handle single embedding
      const response = await this.client.embedContent(model, request);
      return GeminiTransformer.transformEmbeddingResponse(response, request);
    } catch (error) {
      logger.error('Gemini embedding request failed', {
        error: error.message,
        model: request.model,
      });
      throw error;
    }
  }

  async _makeStreamingRequest(request) {
    if (!this.client) {
      throw new ProviderError(
        'Gemini client not initialized',
        'CLIENT_NOT_INITIALIZED',
        'gemini',
      );
    }

    try {
      logger.debug('Making Gemini streaming request', {
        model: request.model,
      });

      const model = request.model;
      const requestData = await this._addContextCaching(request);
      
      const response = await this.client.streamGenerateContent(model, requestData);
      return this._createStreamingWrapper(response, request);
    } catch (error) {
      logger.error('Gemini streaming request failed', {
        error: error.message,
        model: request.model,
      });
      throw error;
    }
  }

  async generateSpeech(request) {
    return this._executeWithMetrics('generateSpeech', async () => {
      GeminiTransformer.validateRequest(request, 'tts');

      const validation = this.models.validateModel(request.model, 'tts');
      if (!validation.valid) {
        throw new ValidationError(validation.error, 'INVALID_MODEL', 'gemini');
      }

      const transformedRequest = GeminiTransformer.transformTTSRequest(request);

      if (!this.client) {
        throw new ProviderError(
          'Gemini client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'gemini',
        );
      }

      const model = request.model;
      const response = await this.client.generateContent(model, transformedRequest);

      if (request.stream_format === 'sse') {
        return this._createTTSStreamingWrapper(response, request);
      }

      return GeminiTransformer.transformTTSResponse(response, request);
    });
  }

  async uploadFile(file, metadata) {
    return this._executeWithMetrics('uploadFile', async () => {
      if (!this.client) {
        throw new ProviderError(
          'Gemini client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'gemini',
        );
      }

      const response = await this.client.uploadFile(file, metadata);
      return response;
    });
  }

  async getFile(fileId) {
    return this._executeWithMetrics('getFile', async () => {
      if (!this.client) {
        throw new ProviderError(
          'Gemini client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'gemini',
        );
      }

      const response = await this.client.getFile(fileId);
      return response;
    });
  }

  async listFiles(pageSize = 10, pageToken = null) {
    return this._executeWithMetrics('listFiles', async () => {
      if (!this.client) {
        throw new ProviderError(
          'Gemini client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'gemini',
        );
      }

      const response = await this.client.listFiles(pageSize, pageToken);
      return response;
    });
  }

  async deleteFile(fileId) {
    return this._executeWithMetrics('deleteFile', async () => {
      if (!this.client) {
        throw new ProviderError(
          'Gemini client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'gemini',
        );
      }

      const response = await this.client.deleteFile(fileId);
      return response;
    });
  }

  async countTokens(request) {
    return this._executeWithMetrics('countTokens', async () => {
      if (!this.client) {
        throw new ProviderError(
          'Gemini client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'gemini',
        );
      }

      const model = request.model;
      const contents = GeminiTransformer._normalizeContents(request.messages || [request]);
      
      const response = await this.client.countTokens(model, { contents });
      return {
        total_tokens: response.totalTokens,
        total_billable_characters: response.totalBillableCharacters,
        details: response.promptTokensDetails,
      };
    });
  }

  async listModels() {
    try {
      if (!this.client) {
        throw new ProviderError(
          'Gemini client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'gemini',
        );
      }

      // Use our static model definitions for consistency
      const models = this.models.getModelList();
      
      return {
        object: 'list',
        data: models,
        provider: 'gemini',
      };
    } catch (error) {
      logger.error('Failed to list Gemini models', { error: error.message });
      throw error;
    }
  }

  getModelInfo(modelId) {
    const model = this.models.getModel(modelId);
    if (!model) {
      throw new ValidationError(`Model '${modelId}' not found`, 'MODEL_NOT_FOUND');
    }

    return {
      id: model.id,
      name: model.name,
      provider: 'gemini',
      type: model.type,
      capabilities: model.capabilities,
      features: model.features,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      cost: {
        input: model.inputCost,
        output: model.outputCost,
        currency: model.currency,
        unit: model.unit,
      },
    };
  }

  getAvailableModels() {
    return this.models.getAllModels().map(model => ({
      id: model.id,
      name: model.name,
      type: model.type,
      capabilities: model.capabilities,
    }));
  }

  getSupportedModels() {
    return this.getAvailableModels();
  }

  getSupportedFeatures() {
    return [
      'completion',
      'embedding', 
      'streaming',
      'multimodal',
      'tts',
      'tools',
      'vision',
      'audio',
      'video',
      'context_caching',
      'file_upload',
      'system_instruction',
      'json_mode',
    ];
  }

  getCostInfo(model) {
    return this.models.getCostInfo(model);
  }

  async _addContextCaching(request) {
    // Check if the model supports context caching
    if (!this.models.supportsFeature(request.model, 'contextCaching')) {
      return request;
    }

    // Add context caching logic here if needed
    // For now, just return the request as-is
    return request;
  }

  _createStreamingWrapper(response, originalRequest) {
    const requestId = this._generateRequestId();
    
    return {
      id: requestId,
      provider: 'gemini',
      model: originalRequest.model,
      streaming: true,
      async *[Symbol.asyncIterator] () {
        try {
          for await (const chunk of response) {
            const transformedChunk = GeminiTransformer.transformStreamingChunk(chunk, requestId);
            yield transformedChunk;
          }
        } catch (error) {
          logger.error('Error in Gemini streaming response', {
            error: error.message,
            requestId,
          });
          throw error;
        }
      },
    };
  }

  _createTTSStreamingWrapper(response, originalRequest) {
    const requestId = this._generateRequestId();
    
    return {
      id: requestId,
      provider: 'gemini',
      model: originalRequest.model,
      streaming: true,
      type: 'tts',
      async *[Symbol.asyncIterator] () {
        try {
          // Gemini TTS doesn't support true streaming yet
          // Return the full audio in one chunk
          const audioData = GeminiTransformer.transformTTSResponse(response, originalRequest);
          yield {
            id: requestId,
            provider: 'gemini',
            model: originalRequest.model,
            delta: audioData.data,
            timestamp: Date.now(),
          };
        } catch (error) {
          logger.error('Error in Gemini TTS streaming response', {
            error: error.message,
            requestId,
          });
          throw error;
        }
      },
    };
  }

  _clearContextCache() {
    const now = Date.now();
    for (const [key, entry] of this.contextCache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.contextCache.delete(key);
      }
    }
  }

  async destroy() {
    await super.destroy();
    
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }

    this.contextCache.clear();
    
    logger.info('Gemini adapter destroyed');
  }
}

module.exports = GeminiAdapter;