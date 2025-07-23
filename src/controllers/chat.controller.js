/**
 * Chat completions controller
 * 
 * Handles OpenAI-compatible chat completion requests
 * Routes to appropriate provider based on model
 */

const ProviderRegistry = require('../providers/base/registry');
const ResponseTransformer = require('../providers/base/response.transformer');
const { ModelNotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

class ChatController {
  /**
   * Create chat completion
   */
  static async createCompletion(req, res) {
    const { model, messages, stream = false, ...options } = req.body;
    
    try {
      logger.info('Chat completion request', {
        requestId: req.id,
        model,
        messageCount: messages.length,
        stream,
        provider: req.provider,
      });
      
      // Get provider for the model
      const provider = ProviderRegistry.getProviderForModel(model);
      if (!provider) {
        throw new ModelNotFoundError(model, {
          availableModels: ProviderRegistry.getAvailableModels(),
          requestedModel: model,
        });
      }
      
      // Add provider info to request for metrics
      req.provider = provider.name;
      
      // Prepare request for provider
      const providerRequest = {
        model,
        messages,
        stream,
        ...options,
      };
      
      // Handle streaming response
      if (stream) {
        return await ChatController._handleStreamingResponse(
          req, res, provider, providerRequest,
        );
      }
      
      // Handle non-streaming response
      const response = await provider.createChatCompletion(providerRequest);
      
      // Transform response to OpenAI format
      const transformedResponse = ResponseTransformer.transformChatCompletion(
        response, 
        provider.name,
        model,
      );
      
      logger.info('Chat completion completed', {
        requestId: req.id,
        model,
        provider: provider.name,
        tokensUsed: transformedResponse.usage?.total_tokens || 0,
        finishReason: transformedResponse.choices?.[0]?.finish_reason,
      });
      
      res.json(transformedResponse);
      
    } catch (error) {
      logger.error('Chat completion error', {
        requestId: req.id,
        model,
        error: error.message,
        provider: req.provider,
      });
      
      throw error;
    }
  }
  
  /**
   * Handle streaming response
   */
  static async _handleStreamingResponse(req, res, provider, providerRequest) {
    try {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
      
      // Get streaming response from provider
      const stream = await provider.createChatCompletionStream(providerRequest);
      let tokenCount = 0;
      
      // Handle stream events
      stream.on('data', (chunk) => {
        try {
          // Transform chunk to OpenAI format
          const transformedChunk = ResponseTransformer.transformStreamChunk(
            chunk,
            provider.name,
            providerRequest.model,
          );
          
          if (transformedChunk) {
            res.write(`data: ${JSON.stringify(transformedChunk)}\n\n`);
            tokenCount++;
          }
        } catch (error) {
          logger.error('Stream chunk transformation error', {
            requestId: req.id,
            error: error.message,
            chunk: chunk.toString(),
          });
        }
      });
      
      stream.on('end', () => {
        // Send final chunk
        res.write('data: [DONE]\n\n');
        res.end();
        
        logger.info('Streaming chat completion completed', {
          requestId: req.id,
          model: providerRequest.model,
          provider: provider.name,
          streamedTokens: tokenCount,
        });
      });
      
      stream.on('error', (error) => {
        logger.error('Stream error', {
          requestId: req.id,
          error: error.message,
          provider: provider.name,
        });
        
        if (!res.headersSent) {
          res.status(500).json({
            error: {
              message: 'Stream error occurred',
              type: 'stream_error',
              code: 'stream_error',
            },
          });
        } else {
          res.write('data: {"error": {"message": "Stream error occurred"}}\n\n');
          res.end();
        }
      });
      
      // Handle client disconnect
      req.on('close', () => {
        logger.info('Client disconnected from stream', {
          requestId: req.id,
          provider: provider.name,
        });
        
        if (stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
      });
      
    } catch (error) {
      logger.error('Streaming setup error', {
        requestId: req.id,
        error: error.message,
        provider: provider.name,
      });
      
      throw error;
    }
  }
  
  /**
   * Get available models for chat completion
   */
  static async getAvailableModels(req, res) {
    try {
      const models = ProviderRegistry.getAvailableModels()
        .filter(model => model.capabilities.includes('chat'))
        .map(model => ({
          id: model.id,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: model.provider,
          permission: [],
          root: model.id,
          parent: null,
        }));
      
      res.json({
        object: 'list',
        data: models,
      });
      
    } catch (error) {
      logger.error('Get chat models error', {
        requestId: req.id,
        error: error.message,
      });
      
      throw error;
    }
  }
}

module.exports = ChatController;