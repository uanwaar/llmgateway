const ResponseTransformer = require('../base/response.transformer');
const { ValidationError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');
const { GeminiModels } = require('./gemini.models');

class GeminiTransformer {
  static transformChatRequest(request) {
    try {
      const transformed = {
        contents: this._normalizeContents(request.messages),
        generationConfig: this._extractGenerationConfig(request),
      };

      if (request.systemInstruction || request.system) {
        transformed.systemInstruction = {
          parts: [
            {
              text: request.systemInstruction || request.system,
            },
          ],
        };
      }

      if (request.tools && request.tools.length > 0) {
        transformed.tools = this._transformTools(request.tools);
      }

      if (request.safetySettings) {
        transformed.safetySettings = request.safetySettings;
      } else {
        transformed.safetySettings = GeminiModels.getDefaultSafetySettings();
      }

      return transformed;
    } catch (error) {
      logger.error('Failed to transform Gemini chat request', {
        error: error.message,
        model: request.model,
      });
      throw new ValidationError(
        `Gemini chat request transformation failed: ${error.message}`,
        'REQUEST_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformEmbeddingRequest(request) {
    try {
      const transformed = {
        content: {
          parts: [],
        },
        taskType: request.taskType || 'SEMANTIC_SIMILARITY',
      };

      if (typeof request.input === 'string') {
        transformed.content.parts.push({ text: request.input });
      } else if (Array.isArray(request.input)) {
        // For batch embedding, return batch request format
        return {
          requests: request.input.map(text => ({
            content: {
              parts: [{ text }],
            },
            taskType: request.taskType || 'SEMANTIC_SIMILARITY',
          })),
        };
      } else if (typeof request.input === 'object') {
        transformed.content = request.input;
      }

      if (request.outputDimensionality) {
        transformed.outputDimensionality = request.outputDimensionality;
      }

      return transformed;
    } catch (error) {
      logger.error('Failed to transform Gemini embedding request', {
        error: error.message,
        model: request.model,
      });
      throw new ValidationError(
        `Gemini embedding request transformation failed: ${error.message}`,
        'REQUEST_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformTTSRequest(request) {
    try {
      const transformed = {
        contents: [
          {
            parts: [
              {
                text: request.input,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {},
          },
        },
      };

      // Handle voice configuration
      if (request.voice) {
        transformed.generationConfig.speechConfig.voiceConfig = {
          prebuiltVoiceConfig: {
            voiceName: request.voice,
          },
        };
      }

      // Handle multi-speaker configuration
      if (request.multiSpeakerConfig) {
        transformed.generationConfig.speechConfig.voiceConfig = {
          multiSpeakerVoiceConfig: request.multiSpeakerConfig,
        };
      }

      // Add system instruction for voice styling
      if (request.instructions) {
        transformed.systemInstruction = {
          parts: [
            {
              text: request.instructions,
            },
          ],
        };
      }

      return transformed;
    } catch (error) {
      logger.error('Failed to transform Gemini TTS request', {
        error: error.message,
        model: request.model,
      });
      throw new ValidationError(
        `Gemini TTS request transformation failed: ${error.message}`,
        'REQUEST_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformChatResponse(response, originalRequest) {
    try {
      const unified = ResponseTransformer.transformToUnifiedFormat(
        response, 'gemini', originalRequest,
      );
      
      // Transform Gemini specific response structure
      if (response.candidates && response.candidates.length > 0) {
        unified.choices = response.candidates.map((candidate, index) => {
          const choice = {
            index,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: null,
            },
            finish_reason: this._mapFinishReason(candidate.finishReason),
            safety_ratings: candidate.safetyRatings,
          };

          // Extract content from parts
          if (candidate.content && candidate.content.parts) {
            const textParts = candidate.content.parts.filter(part => part.text);
            if (textParts.length > 0) {
              choice.message.content = textParts.map(part => part.text).join('');
            }

            // Handle function calls
            const functionCalls = candidate.content.parts.filter(part => part.functionCall);
            if (functionCalls.length > 0) {
              choice.message.tool_calls = functionCalls.map((part, i) => ({
                id: `call_${Date.now()}_${i}`,
                type: 'function',
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args),
                },
              }));
            }
          }

          return choice;
        });
      }

      // Add usage information
      if (response.usageMetadata) {
        unified.usage = {
          prompt_tokens: response.usageMetadata.promptTokenCount || 0,
          completion_tokens: response.usageMetadata.candidatesTokenCount || 0,
          total_tokens: response.usageMetadata.totalTokenCount || 0,
        };
      }

      unified.metadata = {
        ...unified.metadata,
        provider_response: response,
      };

      ResponseTransformer.validateUnifiedResponse(unified);
      return ResponseTransformer.sanitizeResponse(unified);
    } catch (error) {
      logger.error('Failed to transform Gemini chat response', {
        error: error.message,
      });
      throw new ValidationError(
        `Gemini chat response transformation failed: ${error.message}`,
        'RESPONSE_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformEmbeddingResponse(response, originalRequest) {
    try {
      const unified = ResponseTransformer.transformEmbeddingToUnifiedFormat(
        response, 'gemini', originalRequest,
      );
      
      // Handle single embedding response
      if (response.embedding) {
        unified.data = [{
          object: 'embedding',
          index: 0,
          embedding: response.embedding.values,
        }];
        unified.usage = {
          prompt_tokens: response.tokenCount || 0,
          total_tokens: response.tokenCount || 0,
        };
      }
      
      // Handle batch embedding response
      else if (response.embeddings) {
        unified.data = response.embeddings.map((embedding, index) => ({
          object: 'embedding',
          index,
          embedding: embedding.values,
        }));
        unified.usage = {
          prompt_tokens: response.tokenCount || 0,
          total_tokens: response.tokenCount || 0,
        };
      }

      unified.metadata = {
        ...unified.metadata,
        taskType: originalRequest.taskType || 'SEMANTIC_SIMILARITY',
        dimensions: unified.data?.[0]?.embedding?.length || null,
      };

      return ResponseTransformer.sanitizeResponse(unified);
    } catch (error) {
      logger.error('Failed to transform Gemini embedding response', {
        error: error.message,
      });
      throw new ValidationError(
        `Gemini embedding response transformation failed: ${error.message}`,
        'RESPONSE_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformTTSResponse(response, originalRequest) {
    try {
      const unified = {
        id: ResponseTransformer._generateResponseId(),
        provider: 'gemini',
        model: originalRequest.model,
        object: 'audio',
        created: Math.floor(Date.now() / 1000),
        data: null,
        metadata: {
          voice: originalRequest.voice,
          format: 'audio/wav',
          sampleRate: 24000,
          bitDepth: 16,
          channels: 1,
          cached: false,
        },
      };

      // Extract audio data from response
      if (response.candidates && response.candidates[0]?.content?.parts) {
        const audioPart = response.candidates[0].content.parts.find(
          part => part.inlineData?.mimeType?.startsWith('audio/'),
        );
        
        if (audioPart) {
          unified.data = audioPart.inlineData.data;
          unified.metadata.mimeType = audioPart.inlineData.mimeType;
        }
      }

      // Add usage information
      if (response.usageMetadata) {
        unified.usage = {
          prompt_tokens: response.usageMetadata.promptTokenCount || 0,
          total_tokens: response.usageMetadata.totalTokenCount || 0,
        };
      }

      return ResponseTransformer.sanitizeResponse(unified);
    } catch (error) {
      logger.error('Failed to transform Gemini TTS response', {
        error: error.message,
      });
      throw new ValidationError(
        `Gemini TTS response transformation failed: ${error.message}`,
        'RESPONSE_TRANSFORMATION_ERROR',
      );
    }
  }

  static transformStreamingChunk(chunk, requestId) {
    try {
      const unified = {
        id: requestId,
        provider: 'gemini',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        choices: [],
      };

      if (chunk.candidates && chunk.candidates.length > 0) {
        unified.choices = chunk.candidates.map((candidate, index) => {
          const choice = {
            index,
            delta: {
              content: null,
              tool_calls: null,
            },
            finish_reason: candidate.finishReason || null,
          };

          // Extract content from parts
          if (candidate.content && candidate.content.parts) {
            const textParts = candidate.content.parts.filter(part => part.text);
            if (textParts.length > 0) {
              choice.delta.content = textParts.map(part => part.text).join('');
            }

            // Handle function calls
            const functionCalls = candidate.content.parts.filter(part => part.functionCall);
            if (functionCalls.length > 0) {
              choice.delta.tool_calls = functionCalls.map((part, i) => ({
                index: i,
                id: `call_${Date.now()}_${i}`,
                type: 'function',
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args),
                },
              }));
            }
          }

          return choice;
        });
      }

      // Add usage metadata if available
      if (chunk.usageMetadata) {
        unified.usage = {
          prompt_tokens: chunk.usageMetadata.promptTokenCount || 0,
          completion_tokens: chunk.usageMetadata.candidatesTokenCount || 0,
          total_tokens: chunk.usageMetadata.totalTokenCount || 0,
        };
      }

      return unified;
    } catch (error) {
      logger.error('Failed to transform Gemini streaming chunk', {
        error: error.message,
        requestId,
      });
      throw new ValidationError(
        `Gemini streaming chunk transformation failed: ${error.message}`,
        'CHUNK_TRANSFORMATION_ERROR',
      );
    }
  }

  static _normalizeContents(messages) {
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array');
    }

    const contents = [];
    
    for (const message of messages) {
      const role = this._mapRole(message.role);
      const content = {
        role,
        parts: [],
      };

      if (typeof message.content === 'string') {
        content.parts.push({ text: message.content });
      } else if (Array.isArray(message.content)) {
        for (const part of message.content) {
          content.parts.push(this._transformContentPart(part));
        }
      } else if (message.content && typeof message.content === 'object') {
        content.parts.push(this._transformContentPart(message.content));
      }

      // Handle tool responses
      if (message.tool_call_id && message.content) {
        content.parts = [{
          functionResponse: {
            name: message.name || 'unknown',
            response: {
              result: message.content,
            },
          },
        }];
      }

      contents.push(content);
    }

    return contents;
  }

  static _transformContentPart(part) {
    if (typeof part === 'string') {
      return { text: part };
    }

    if (part.type === 'text') {
      return { text: part.text };
    }

    if (part.type === 'image_url' || part.type === 'image') {
      const imageData = part.image_url?.url || part.url || part.data;
      
      if (imageData.startsWith('data:')) {
        const [mimeInfo, base64Data] = imageData.split(',');
        const mimeType = mimeInfo.match(/data:([^;]+)/)[1];
        
        return {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        };
      } else {
        return {
          fileData: {
            fileUri: imageData,
            mimeType: part.mimeType || 'image/jpeg',
          },
        };
      }
    }

    if (part.type === 'audio' || part.type === 'input_audio') {
      const audioData = part.input_audio?.data || part.audio?.data || part.data;
      const format = part.input_audio?.format || part.audio?.format || part.format || 'wav';
      
      return {
        inlineData: {
          mimeType: `audio/${format}`,
          data: audioData,
        },
      };
    }

    if (part.type === 'video') {
      return {
        fileData: {
          fileUri: part.video_url || part.url || part.data,
          mimeType: part.mimeType || 'video/mp4',
        },
      };
    }

    return part;
  }

  static _mapRole(role) {
    const roleMap = {
      'system': 'user', // Gemini doesn't have system role, use systemInstruction instead
      'user': 'user',
      'assistant': 'model',
      'tool': 'user', // Tool responses come from user
      'function': 'user',
    };

    return roleMap[role] || 'user';
  }

  static _mapFinishReason(reason) {
    const reasonMap = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter',
      'OTHER': 'stop',
      'FINISH_REASON_UNSPECIFIED': 'stop',
    };

    return reasonMap[reason] || reason?.toLowerCase() || 'stop';
  }

  static _extractGenerationConfig(request) {
    const config = {};

    if (request.max_tokens || request.maxOutputTokens) {
      config.maxOutputTokens = request.max_tokens || request.maxOutputTokens;
    }

    if (request.temperature !== undefined) {
      config.temperature = request.temperature;
    }

    if (request.top_p !== undefined) {
      config.topP = request.top_p;
    }

    if (request.top_k !== undefined) {
      config.topK = request.top_k;
    }

    if (request.stop || request.stopSequences) {
      config.stopSequences = Array.isArray(request.stop) ? request.stop : [request.stop];
    }

    if (request.candidateCount) {
      config.candidateCount = request.candidateCount;
    }

    if (request.response_format?.type === 'json_object') {
      config.responseMimeType = 'application/json';
    }

    return config;
  }

  static _transformTools(tools) {
    const functionDeclarations = [];

    for (const tool of tools) {
      if (tool.type === 'function') {
        functionDeclarations.push({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        });
      }
    }

    return [{
      functionDeclarations,
    }];
  }

  static transformError(error) {
    return ResponseTransformer.transformError(error, 'gemini');
  }

  static validateRequest(request, type) {
    const validators = {
      chat: this._validateChatRequest,
      embedding: this._validateEmbeddingRequest,
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

  static _validateTTSRequest(request) {
    if (!request.model) {
      throw new ValidationError('Model is required', 'MISSING_MODEL');
    }

    if (!request.input) {
      throw new ValidationError('Input text is required', 'MISSING_INPUT');
    }

    if (!request.voice && !request.multiSpeakerConfig) {
      throw new ValidationError('Voice or multi-speaker config is required', 'MISSING_VOICE');
    }

    if (request.voice && !GeminiModels.isValidVoice(request.voice)) {
      throw new ValidationError(
        `Invalid voice: ${request.voice}`,
        'INVALID_VOICE',
      );
    }

    return true;
  }
}

module.exports = GeminiTransformer;