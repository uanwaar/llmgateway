const ResponseTransformer = require('../base/response.transformer');
const { ValidationError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');

class OpenAITransformer {
  static transformChatRequest(request) {
    try {
      const transformed = {
        model: request.model,
        messages: this._normalizeMessages(request.messages),
        ...this._extractChatParameters(request),
      };

      if (request.tools && request.tools.length > 0) {
        transformed.tools = this._transformTools(request.tools);
      }

      if (request.tool_choice) {
        transformed.tool_choice = request.tool_choice;
      }

      return transformed;
    } catch (error) {
      logger.error('Failed to transform OpenAI chat request', {
        error: error.message,
        model: request.model,
      });
      throw new ValidationError(
        `OpenAI chat request transformation failed: ${error.message}`,
        'REQUEST_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformEmbeddingRequest(request) {
    try {
      const transformed = {
        model: request.model,
        input: request.input,
      };

      if (request.dimensions) {
        transformed.dimensions = request.dimensions;
      }

      if (request.encoding_format) {
        transformed.encoding_format = request.encoding_format;
      }

      if (request.user) {
        transformed.user = request.user;
      }

      return transformed;
    } catch (error) {
      logger.error('Failed to transform OpenAI embedding request', {
        error: error.message,
        model: request.model,
      });
      throw new ValidationError(
        `OpenAI embedding request transformation failed: ${error.message}`,
        'REQUEST_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformTranscriptionRequest(request) {
    try {
      const transformed = {
        model: request.model,
        file: request.file,
      };

      if (request.language) {
        transformed.language = request.language;
      }

      if (request.prompt) {
        transformed.prompt = request.prompt;
      }

      if (request.response_format) {
        transformed.response_format = request.response_format;
      }

      if (request.temperature !== undefined) {
        transformed.temperature = request.temperature;
      }

      if (request.timestamp_granularities) {
        transformed.timestamp_granularities = request.timestamp_granularities;
      }

      if (request.stream) {
        transformed.stream = request.stream;
      }

      if (request.chunking_strategy) {
        transformed.chunking_strategy = request.chunking_strategy;
      }

      if (request.include) {
        transformed.include = request.include;
      }

      return transformed;
    } catch (error) {
      logger.error('Failed to transform OpenAI transcription request', {
        error: error.message,
        model: request.model,
      });
      throw new ValidationError(
        `OpenAI transcription request transformation failed: ${error.message}`,
        'REQUEST_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformTTSRequest(request) {
    try {
      const transformed = {
        model: request.model,
        input: request.input,
        voice: request.voice,
      };

      if (request.response_format) {
        transformed.response_format = request.response_format;
      }

      if (request.speed !== undefined) {
        transformed.speed = request.speed;
      }

      if (request.instructions) {
        transformed.instructions = request.instructions;
      }

      if (request.stream_format) {
        transformed.stream_format = request.stream_format;
      }

      return transformed;
    } catch (error) {
      logger.error('Failed to transform OpenAI TTS request', {
        error: error.message,
        model: request.model,
      });
      throw new ValidationError(
        `OpenAI TTS request transformation failed: ${error.message}`,
        'REQUEST_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformChatResponse(response, originalRequest) {
    try {
      const unified = ResponseTransformer.transformToUnifiedFormat(
        response, 'openai', originalRequest,
      );
      
      // Transform OpenAI specific response structure
      if (response.choices && response.choices.length > 0) {
        unified.choices = response.choices.map((choice, index) => ({
          index,
          message: {
            role: choice.message?.role || 'assistant',
            content: choice.message?.content || null,
            tool_calls: choice.message?.tool_calls || null,
            refusal: choice.message?.refusal || null,
          },
          finish_reason: choice.finish_reason,
          logprobs: choice.logprobs || null,
        }));
      }

      // Add usage information
      unified.usage = ResponseTransformer.extractTokenUsage(response, 'openai');

      // Add OpenAI specific metadata
      if (response.system_fingerprint) {
        unified.system_fingerprint = response.system_fingerprint;
      }

      unified.metadata = {
        ...unified.metadata,
        provider_response_id: response.id,
        provider_model: response.model,
        provider_created: response.created,
      };

      ResponseTransformer.validateUnifiedResponse(unified);
      return ResponseTransformer.sanitizeResponse(unified);
    } catch (error) {
      logger.error('Failed to transform OpenAI chat response', {
        error: error.message,
        responseId: response.id,
      });
      throw new ValidationError(
        `OpenAI chat response transformation failed: ${error.message}`,
        'RESPONSE_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformEmbeddingResponse(response, originalRequest) {
    try {
      const unified = ResponseTransformer.transformEmbeddingToUnifiedFormat(
        response, 'openai', originalRequest,
      );
      
      // Transform OpenAI embedding data
      if (response.data && Array.isArray(response.data)) {
        unified.data = response.data.map((item, index) => ({
          object: 'embedding',
          index,
          embedding: item.embedding,
        }));
      }

      // Add usage information
      unified.usage = ResponseTransformer.extractTokenUsage(response, 'openai');

      unified.metadata = {
        ...unified.metadata,
        provider_response_id: response.id || null,
        provider_model: response.model,
        dimensions: response.data?.[0]?.embedding?.length || null,
      };

      return ResponseTransformer.sanitizeResponse(unified);
    } catch (error) {
      logger.error('Failed to transform OpenAI embedding response', {
        error: error.message,
      });
      throw new ValidationError(
        `OpenAI embedding response transformation failed: ${error.message}`,
        'RESPONSE_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformTranscriptionResponse(response, originalRequest) {
    try {
      const unified = {
        id: ResponseTransformer._generateResponseId(),
        provider: 'openai',
        model: originalRequest.model,
        object: 'transcription',
        created: Math.floor(Date.now() / 1000),
        text: response.text || '',
        metadata: {
          provider_response: response,
          cached: false,
        },
      };

      // Add detailed information for verbose responses
      if (response.language) {
        unified.language = response.language;
      }

      if (response.duration) {
        unified.duration = response.duration;
      }

      if (response.words) {
        unified.words = response.words;
      }

      if (response.segments) {
        unified.segments = response.segments;
      }

      if (response.logprobs) {
        unified.logprobs = response.logprobs;
      }

      return ResponseTransformer.sanitizeResponse(unified);
    } catch (error) {
      logger.error('Failed to transform OpenAI transcription response', {
        error: error.message,
      });
      throw new ValidationError(
        `OpenAI transcription response transformation failed: ${error.message}`,
        'RESPONSE_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformTTSResponse(response, originalRequest) {
    try {
      const unified = {
        id: ResponseTransformer._generateResponseId(),
        provider: 'openai',
        model: originalRequest.model,
        object: 'audio',
        created: Math.floor(Date.now() / 1000),
        data: response.data || response,
        metadata: {
          voice: originalRequest.voice,
          format: originalRequest.response_format || 'mp3',
          cached: false,
        },
      };

      return ResponseTransformer.sanitizeResponse(unified);
    } catch (error) {
      logger.error('Failed to transform OpenAI TTS response', {
        error: error.message,
      });
      throw new ValidationError(
        `OpenAI TTS response transformation failed: ${error.message}`,
        'RESPONSE_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformStreamingChunk(chunk, requestId) {
    try {
      return ResponseTransformer.transformStreamingChunk(chunk, 'openai', requestId);
    } catch (error) {
      logger.error('Failed to transform OpenAI streaming chunk', {
        error: error.message,
        requestId,
      });
      throw new ValidationError(
        `OpenAI streaming chunk transformation failed: ${error.message}`,
        'CHUNK_TRANSFORMATION_ERROR',
      );
    }
  }

  static _normalizeMessages(messages) {
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array');
    }

    return messages.map(message => {
      const normalized = ResponseTransformer.normalizeMessage(message);
      
      // Handle OpenAI specific message formats
      if (Array.isArray(normalized.content)) {
        normalized.content = normalized.content.map(part => {
          if (part.type === 'image_url') {
            return {
              type: 'image_url',
              image_url: {
                url: part.image_url.url,
                detail: part.image_url.detail || 'auto',
              },
            };
          }
          
          if (part.type === 'input_audio') {
            return {
              type: 'input_audio',
              input_audio: {
                data: part.input_audio.data,
                format: part.input_audio.format || 'wav',
              },
            };
          }

          return part;
        });
      }

      return normalized;
    });
  }

  static _extractChatParameters(request) {
    const parameters = {};

    const allowedParams = [
      'max_tokens', 'temperature', 'top_p', 'frequency_penalty', 
      'presence_penalty', 'stop', 'stream', 'stream_options',
      'user', 'response_format', 'seed', 'logit_bias', 'logprobs',
      'top_logprobs', 'n', 'service_tier', 'parallel_tool_calls',
    ];

    allowedParams.forEach(param => {
      if (request[param] !== undefined) {
        parameters[param] = request[param];
      }
    });

    return parameters;
  }

  static _transformTools(tools) {
    return tools.map(tool => {
      if (tool.type === 'function') {
        return {
          type: 'function',
          function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
            strict: tool.function.strict,
          },
        };
      }

      // Pass through built-in tools
      return tool;
    });
  }

  static transformError(error) {
    return ResponseTransformer.transformError(error, 'openai');
  }

  static validateRequest(request, type) {
    const validators = {
      chat: this._validateChatRequest,
      embedding: this._validateEmbeddingRequest,
      transcription: this._validateTranscriptionRequest,
      tts: this._validateTTSRequest,
    };

    const validator = validators[type];
    if (!validator) {
      throw new ValidationError(`Unknown request type: ${type}`, 'INVALID_REQUEST_TYPE');
    }

    return validator.call(this, request);
  }

  static _validateChatRequest(request) {
    if (!request.model) {
      throw new ValidationError('Model is required', 'MISSING_MODEL');
    }

    if (!request.messages || !Array.isArray(request.messages) ||
        request.messages.length === 0) {
      throw new ValidationError(
        'Messages array is required and cannot be empty',
        'INVALID_MESSAGES',
      );
    }

    // Validate message structure
    request.messages.forEach((message, index) => {
      if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
        throw new ValidationError(
          `Invalid role in message ${index}: ${message.role}`,
          'INVALID_MESSAGE_ROLE',
        );
      }

      if (!message.content && !message.tool_calls) {
        throw new ValidationError(
          `Message ${index} must have content or tool_calls`,
          'INVALID_MESSAGE_CONTENT',
        );
      }
    });

    return true;
  }

  static _validateEmbeddingRequest(request) {
    if (!request.model) {
      throw new ValidationError('Model is required', 'MISSING_MODEL');
    }

    if (!request.input) {
      throw new ValidationError('Input is required', 'MISSING_INPUT');
    }

    return true;
  }

  static _validateTranscriptionRequest(request) {
    if (!request.model) {
      throw new ValidationError('Model is required', 'MISSING_MODEL');
    }

    if (!request.file) {
      throw new ValidationError('Audio file is required', 'MISSING_FILE');
    }

    return true;
  }

  static _validateTTSRequest(request) {
    if (!request.model) {
      throw new ValidationError('Model is required', 'MISSING_MODEL');
    }

    if (!request.input) {
      throw new ValidationError('Input text is required', 'MISSING_INPUT');
    }

    if (!request.voice) {
      throw new ValidationError('Voice is required', 'MISSING_VOICE');
    }

    const validVoices = [
      'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer',
      'ash', 'ballad', 'coral', 'sage', 'verse',
    ];
    if (!validVoices.includes(request.voice)) {
      throw new ValidationError(
        `Invalid voice: ${request.voice}. Valid voices: ${validVoices.join(', ')}`,
        'INVALID_VOICE',
      );
    }

    return true;
  }
}

module.exports = OpenAITransformer;