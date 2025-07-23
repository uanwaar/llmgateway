const BaseAdapter = require('../base/adapter.base');
const OpenAIClient = require('./openai.client');
const OpenAITransformer = require('./openai.transformer');
const { OpenAIModels } = require('./openai.models');
const { logger } = require('../../utils/logger');
const { ProviderError, ValidationError } = require('../../utils/errors');

class OpenAIAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.client = null;
    this.models = OpenAIModels;
  }

  async _setupClient() {
    try {
      this.client = new OpenAIClient(this.config);
      logger.debug('OpenAI client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenAI client', { error: error.message });
      throw new ProviderError(
        `OpenAI client initialization failed: ${error.message}`,
        'CLIENT_INITIALIZATION_FAILED',
        'openai',
      );
    }
  }

  async _performHealthCheck() {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const result = await this.client.healthCheck();
      
      if (result.status === 'healthy') {
        return {
          status: 'healthy',
          message: 'OpenAI API is accessible',
          timestamp: result.timestamp,
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw new ProviderError(
        `OpenAI health check failed: ${error.message}`,
        'HEALTH_CHECK_FAILED',
        'openai',
      );
    }
  }

  async _normalizeRequest(request) {
    const validation = this.models.validateModel(request.model, 'completion');
    if (!validation.valid) {
      throw new ValidationError(validation.error, 'INVALID_MODEL', 'openai');
    }

    return OpenAITransformer.transformChatRequest(request);
  }

  async _normalizeEmbeddingRequest(request) {
    const validation = this.models.validateModel(request.model, 'embedding');
    if (!validation.valid) {
      throw new ValidationError(validation.error, 'INVALID_MODEL', 'openai');
    }

    return OpenAITransformer.transformEmbeddingRequest(request);
  }

  _normalizeResponse(response) {
    return response;
  }

  _normalizeEmbeddingResponse(response) {
    return response;
  }

  async _makeCompletionRequest(request) {
    if (!this.client) {
      throw new ProviderError('OpenAI client not initialized', 'CLIENT_NOT_INITIALIZED', 'openai');
    }

    try {
      logger.debug('Making OpenAI completion request', {
        model: request.model,
        messageCount: request.messages?.length,
        useResponsesAPI: this.config.useResponsesAPI !== false,
      });

      // Use responses API by default, fallback to chat completions if disabled
      if (this.config.useResponsesAPI !== false) {
        return await this._makeResponsesAPIRequest(request);
      } else {
        const response = await this.client.chatCompletion(request);
        return OpenAITransformer.transformChatResponse(response, request);
      }
    } catch (error) {
      logger.error('OpenAI completion request failed', {
        error: error.message,
        model: request.model,
      });
      throw error;
    }
  }

  async _makeResponsesAPIRequest(request) {
    try {
      const transformedRequest = OpenAITransformer.transformResponseRequest(request);
      const response = await this.client.createResponse(transformedRequest);
      
      // If it's a background request, return the response ID for polling
      if (transformedRequest.background) {
        return {
          id: response.id,
          status: response.status,
          created: response.created,
          background: true,
        };
      }
      
      // For non-background requests, check if response is complete
      if (response.status === 'completed') {
        return OpenAITransformer.transformResponseResponse(response, request);
      } else {
        // Poll for completion if not immediately ready
        return await this._pollForCompletion(response.id, request);
      }
    } catch (error) {
      logger.warn('Responses API failed, falling back to chat completions', {
        error: error.message,
        model: request.model,
      });
      
      // Fallback to chat completions API
      const response = await this.client.chatCompletion(request);
      return OpenAITransformer.transformChatResponse(response, request);
    }
  }

  async _pollForCompletion(responseId, originalRequest, maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.client.retrieveResponse(responseId);
        
        if (response.status === 'completed') {
          return OpenAITransformer.transformResponseResponse(response, originalRequest);
        } else if (response.status === 'failed' || response.status === 'cancelled') {
          throw new ProviderError(
            `Response ${response.status}: ${response.error?.message || 'Unknown error'}`,
            'RESPONSE_FAILED',
            'openai'
          );
        }
        
        // Wait before next poll (exponential backoff)
        const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }
    
    throw new ProviderError(
      'Response polling timed out',
      'POLLING_TIMEOUT',
      'openai'
    );
  }

  async createResponse(request) {
    return this._executeWithMetrics('createResponse', async () => {
      const validation = this.models.validateModel(request.model, 'completion');
      if (!validation.valid) {
        throw new ValidationError(validation.error, 'INVALID_MODEL', 'openai');
      }

      if (!this.client) {
        throw new ProviderError(
          'OpenAI client not initialized', 
          'CLIENT_NOT_INITIALIZED', 
          'openai',
        );
      }

      try {
        logger.debug('Making OpenAI response request', {
          model: request.model,
          messageCount: request.messages?.length,
          background: request.background,
        });

        const transformedRequest = OpenAITransformer.transformResponseRequest(request);
        const response = await this.client.createResponse(transformedRequest);
        
        if (request.stream) {
          return this._createResponseStreamingWrapper(response, request);
        }

        return OpenAITransformer.transformResponseResponse(response, request);
      } catch (error) {
        logger.error('OpenAI response request failed', {
          error: error.message,
          model: request.model,
        });
        throw error;
      }
    });
  }

  async retrieveResponse(responseId) {
    return this._executeWithMetrics('retrieveResponse', async () => {
      if (!this.client) {
        throw new ProviderError(
          'OpenAI client not initialized', 
          'CLIENT_NOT_INITIALIZED', 
          'openai',
        );
      }

      try {
        logger.debug('Retrieving OpenAI response', { responseId });
        const response = await this.client.retrieveResponse(responseId);
        return OpenAITransformer.transformResponseResponse(response);
      } catch (error) {
        logger.error('OpenAI retrieve response failed', {
          error: error.message,
          responseId,
        });
        throw error;
      }
    });
  }

  async cancelResponse(responseId) {
    return this._executeWithMetrics('cancelResponse', async () => {
      if (!this.client) {
        throw new ProviderError(
          'OpenAI client not initialized', 
          'CLIENT_NOT_INITIALIZED', 
          'openai',
        );
      }

      try {
        logger.debug('Cancelling OpenAI response', { responseId });
        const response = await this.client.cancelResponse(responseId);
        return OpenAITransformer.transformResponseResponse(response);
      } catch (error) {
        logger.error('OpenAI cancel response failed', {
          error: error.message,
          responseId,
        });
        throw error;
      }
    });
  }

  async _makeEmbeddingRequest(request) {
    if (!this.client) {
      throw new ProviderError('OpenAI client not initialized', 'CLIENT_NOT_INITIALIZED', 'openai');
    }

    try {
      logger.debug('Making OpenAI embedding request', {
        model: request.model,
        inputType: Array.isArray(request.input) ? 'array' : 'string',
      });

      const response = await this.client.createEmbedding(request);
      return OpenAITransformer.transformEmbeddingResponse(response, request);
    } catch (error) {
      logger.error('OpenAI embedding request failed', {
        error: error.message,
        model: request.model,
      });
      throw error;
    }
  }

  async _makeStreamingRequest(request) {
    if (!this.client) {
      throw new ProviderError('OpenAI client not initialized', 'CLIENT_NOT_INITIALIZED', 'openai');
    }

    try {
      logger.debug('Making OpenAI streaming request', {
        model: request.model,
      });

      const streamRequest = { ...request, stream: true };
      const response = await this.client.chatCompletion(streamRequest);
      
      return this._createStreamingWrapper(response, request);
    } catch (error) {
      logger.error('OpenAI streaming request failed', {
        error: error.message,
        model: request.model,
      });
      throw error;
    }
  }

  async transcribeAudio(request) {
    return this._executeWithMetrics('transcribeAudio', async () => {
      OpenAITransformer.validateRequest(request, 'transcription');

      const validation = this.models.validateModel(request.model, 'transcription');
      if (!validation.valid) {
        throw new ValidationError(validation.error, 'INVALID_MODEL', 'openai');
      }

      const transformedRequest = OpenAITransformer
        .transformTranscriptionRequest(request);
      
      if (!this.client) {
        throw new ProviderError(
          'OpenAI client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'openai',
        );
      }

      const response = await this.client.transcribeAudio(
        transformedRequest,
      );

      if (request.stream) {
        return this._createTranscriptionStreamingWrapper(
          response,
          request,
        );
      }

      return OpenAITransformer.transformTranscriptionResponse(response, request);
    });
  }

  async translateAudio(request) {
    return this._executeWithMetrics('translateAudio', async () => {
      if (!request.model) {
        throw new ValidationError('Model is required', 'MISSING_MODEL');
      }

      if (!request.file) {
        throw new ValidationError('Audio file is required', 'MISSING_FILE');
      }

      const transformedRequest = {
        model: request.model,
        file: request.file,
        prompt: request.prompt,
        response_format: request.response_format || 'json',
        temperature: request.temperature || 0,
      };

      if (!this.client) {
        throw new ProviderError(
          'OpenAI client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'openai',
        );
      }

      const response = await this.client.translateAudio(transformedRequest);
      return OpenAITransformer.transformTranscriptionResponse(response, request);
    });
  }

  async generateSpeech(request) {
    return this._executeWithMetrics('generateSpeech', async () => {
      OpenAITransformer.validateRequest(request, 'tts');

      const validation = this.models.validateModel(request.model, 'tts');
      if (!validation.valid) {
        throw new ValidationError(validation.error, 'INVALID_MODEL', 'openai');
      }

      const transformedRequest = OpenAITransformer.transformTTSRequest(request);

      if (!this.client) {
        throw new ProviderError(
          'OpenAI client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'openai',
        );
      }

      const response = await this.client.generateSpeech(
        transformedRequest,
      );

      if (request.stream_format === 'sse') {
        return this._createTTSStreamingWrapper(response, request);
      }

      return OpenAITransformer.transformTTSResponse(response, request);
    });
  }

  async listModels() {
    try {
      if (!this.client) {
        throw new ProviderError(
          'OpenAI client not initialized',
          'CLIENT_NOT_INITIALIZED',
          'openai',
        );
      }

      // Use our static model definitions for consistency
      const models = this.models.getModelList();
      
      return {
        object: 'list',
        data: models,
        provider: 'openai',
      };
    } catch (error) {
      logger.error('Failed to list OpenAI models', { error: error.message });
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
      provider: 'openai',
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

  getSupportedFeatures() {
    return [
      'completion',
      'embedding', 
      'streaming',
      'multimodal',
      'transcription',
      'translation',
      'tts',
      'tools',
      'vision',
      'audio',
      'reasoning',
      'responses',
      'background_processing',
      'built_in_tools',
      'web_search',
      'file_search',
      'code_interpreter',
      'image_generation',
    ];
  }

  getCostInfo(model) {
    return this.models.getCostInfo(model);
  }

  _createStreamingWrapper(response, originalRequest) {
    const requestId = this._generateRequestId();
    
    return {
      id: requestId,
      provider: 'openai',
      model: originalRequest.model,
      streaming: true,
      async *[Symbol.asyncIterator] () {
        try {
          for await (const chunk of response) {
            const transformedChunk = OpenAITransformer.transformStreamingChunk(chunk, requestId);
            yield transformedChunk;
          }
        } catch (error) {
          logger.error('Error in OpenAI streaming response', {
            error: error.message,
            requestId,
          });
          throw error;
        }
      },
    };
  }

  _createTranscriptionStreamingWrapper(response, originalRequest) {
    const requestId = this._generateRequestId();
    
    return {
      id: requestId,
      provider: 'openai',
      model: originalRequest.model,
      streaming: true,
      type: 'transcription',
      async *[Symbol.asyncIterator] () {
        try {
          for await (const chunk of response) {
            yield {
              id: requestId,
              provider: 'openai',
              model: originalRequest.model,
              text: chunk.text || '',
              start: chunk.x_start || null,
              end: chunk.x_end || null,
              timestamp: Date.now(),
            };
          }
        } catch (error) {
          logger.error('Error in OpenAI transcription streaming response', {
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
      provider: 'openai',
      model: originalRequest.model,
      streaming: true,
      type: 'tts',
      async *[Symbol.asyncIterator] () {
        try {
          for await (const chunk of response) {
            yield {
              id: requestId,
              provider: 'openai',
              model: originalRequest.model,
              delta: chunk.delta || chunk,
              timestamp: Date.now(),
            };
          }
        } catch (error) {
          logger.error('Error in OpenAI TTS streaming response', {
            error: error.message,
            requestId,
          });
          throw error;
        }
      },
    };
  }

  _createResponseStreamingWrapper(response, originalRequest) {
    const requestId = this._generateRequestId();
    
    return {
      id: requestId,
      provider: 'openai',
      model: originalRequest.model,
      streaming: true,
      type: 'response',
      async *[Symbol.asyncIterator] () {
        try {
          for await (const event of response) {
            const transformedEvent = OpenAITransformer.transformResponseStreamingEvent(
              event, 
              requestId,
            );
            yield transformedEvent;
          }
        } catch (error) {
          logger.error('Error in OpenAI response streaming', {
            error: error.message,
            requestId,
          });
          throw error;
        }
      },
    };
  }

  async destroy() {
    await super.destroy();
    
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }

    logger.info('OpenAI adapter destroyed');
  }
}

module.exports = OpenAIAdapter;