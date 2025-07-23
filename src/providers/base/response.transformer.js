const { logger } = require('../../utils/logger');
const { ValidationError } = require('../../utils/errors');

class ResponseTransformer {
  static transformToUnifiedFormat(providerResponse, providerName, originalRequest) {
    try {
      const unified = {
        id: this._generateResponseId(),
        provider: providerName,
        model: originalRequest.model,
        created: Math.floor(Date.now() / 1000),
        object: 'chat.completion',
        choices: [],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          reasoning_tokens: 0,
        },
        system_fingerprint: null,
        metadata: {
          provider_response_id: providerResponse.id || null,
          processing_time: null,
          cached: false,
        },
      };

      return unified;
    } catch (error) {
      logger.error('Failed to transform response to unified format', {
        provider: providerName,
        error: error.message,
      });
      throw new ValidationError(
        `Response transformation failed: ${error.message}`,
        'RESPONSE_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformEmbeddingToUnifiedFormat(providerResponse, providerName, originalRequest) {
    try {
      const unified = {
        id: this._generateResponseId(),
        provider: providerName,
        model: originalRequest.model,
        object: 'list',
        data: [],
        usage: {
          prompt_tokens: 0,
          total_tokens: 0,
        },
        metadata: {
          provider_response_id: providerResponse.id || null,
          processing_time: null,
          cached: false,
        },
      };

      return unified;
    } catch (error) {
      logger.error('Failed to transform embedding response to unified format', {
        provider: providerName,
        error: error.message,
      });
      throw new ValidationError(
        `Embedding response transformation failed: ${error.message}`,
        'RESPONSE_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformStreamingChunk(chunk, providerName, requestId) {
    try {
      const unified = {
        id: requestId,
        provider: providerName,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        choices: [],
        model: null,
      };

      return unified;
    } catch (error) {
      logger.error('Failed to transform streaming chunk', {
        provider: providerName,
        error: error.message,
      });
      throw new ValidationError(
        `Streaming chunk transformation failed: ${error.message}`,
        'CHUNK_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformError(error, providerName) {
    const errorMap = {
      401: 'AUTHENTICATION_ERROR',
      403: 'AUTHORIZATION_ERROR',
      429: 'RATE_LIMIT_ERROR',
      500: 'PROVIDER_ERROR',
      502: 'PROVIDER_UNAVAILABLE',
      503: 'PROVIDER_UNAVAILABLE',
      504: 'TIMEOUT_ERROR',
    };

    const errorType = errorMap[error.status] || 'UNKNOWN_ERROR';
    
    return {
      error: {
        type: errorType,
        code: error.code || error.status || 'unknown',
        message: error.message || 'An unknown error occurred',
        provider: providerName,
        details: error.details || null,
        timestamp: new Date().toISOString(),
      },
    };
  }

  static normalizeMessage(message, role = 'user') {
    if (typeof message === 'string') {
      return {
        role,
        content: message,
      };
    }

    if (Array.isArray(message.content)) {
      return {
        role: message.role || role,
        content: message.content.map(this._normalizeContentPart),
      };
    }

    return {
      role: message.role || role,
      content: message.content || message,
    };
  }

  static _normalizeContentPart(part) {
    if (typeof part === 'string') {
      return {
        type: 'text',
        text: part,
      };
    }

    if (part.type === 'image_url' || part.type === 'image') {
      return {
        type: 'image_url',
        image_url: {
          url: part.image_url?.url || part.url || part.data,
          detail: part.image_url?.detail || part.detail || 'auto',
        },
      };
    }

    if (part.type === 'audio') {
      return {
        type: 'input_audio',
        input_audio: {
          data: part.data || part.audio?.data,
          format: part.format || part.audio?.format || 'wav',
        },
      };
    }

    return part;
  }

  static validateUnifiedResponse(response) {
    const requiredFields = ['id', 'provider', 'model', 'created', 'object'];
    
    for (const field of requiredFields) {
      if (!(field in response)) {
        throw new ValidationError(
          `Missing required field: ${field}`,
          'INVALID_RESPONSE_FORMAT',
        );
      }
    }

    if (response.object === 'chat.completion' && !Array.isArray(response.choices)) {
      throw new ValidationError(
        'Choices must be an array for chat completions',
        'INVALID_RESPONSE_FORMAT',
      );
    }

    if (response.object === 'list' && !Array.isArray(response.data)) {
      throw new ValidationError(
        'Data must be an array for embedding responses',
        'INVALID_RESPONSE_FORMAT',
      );
    }

    return true;
  }

  static extractTokenUsage(providerResponse, providerName) {
    const defaultUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      reasoning_tokens: 0,
    };

    try {
      switch (providerName) {
      case 'openai':
        if (providerResponse.usage) {
          return {
            prompt_tokens: providerResponse.usage.prompt_tokens || 0,
            completion_tokens: providerResponse.usage.completion_tokens || 0,
            total_tokens: providerResponse.usage.total_tokens || 0,
            reasoning_tokens: providerResponse.usage.reasoning_tokens || 0,
          };
        }
        return defaultUsage;
        
      case 'gemini':
        if (providerResponse.usageMetadata) {
          return {
            prompt_tokens: providerResponse.usageMetadata.promptTokenCount || 0,
            completion_tokens: providerResponse.usageMetadata.candidatesTokenCount || 0,
            total_tokens: providerResponse.usageMetadata.totalTokenCount || 0,
          };
        }
        return defaultUsage;
        
      default:
        return defaultUsage;
      }
    } catch (error) {
      logger.warn('Failed to extract token usage', {
        provider: providerName,
        error: error.message,
      });
      return defaultUsage;
    }
  }

  static _generateResponseId() {
    return `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static addMetadata(response, metadata = {}) {
    if (!response.metadata) {
      response.metadata = {};
    }

    Object.assign(response.metadata, metadata);
    
    return response;
  }

  static sanitizeResponse(response) {
    const sanitized = { ...response };
    
    // Remove sensitive information
    if (sanitized.metadata) {
      delete sanitized.metadata.api_key;
      delete sanitized.metadata.auth_token;
    }

    // Clean up null or undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === null || sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }
}

module.exports = ResponseTransformer;