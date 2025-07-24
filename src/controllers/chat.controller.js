/**
 * Chat completions controller
 * 
 * Handles OpenAI-compatible chat completion requests
 * Routes to appropriate provider based on model
 */

const gatewayService = require('../services/gateway.service');
const logger = require('../utils/logger');

class ChatController {
  /**
   * Create chat completion
   */
  static async createCompletion(req, res) {
    const { model, messages, stream = false } = req.body;
    
    try {
      logger.info('Chat completion request', {
        requestId: req.id,
        model,
        messageCount: messages.length,
        stream,
      });
      
      // Use gateway service for request processing
      const result = await gatewayService.createChatCompletion(req.body, {
        requestId: req.id,
        stream,
      });
      
      // Handle streaming response
      if (stream) {
        // Set headers for Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        try {
          // Iterate through the streaming response
          for await (const chunk of result) {
            // Write each chunk as a Server-Sent Event
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          
          // Send the final "done" event
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (error) {
          logger.error('Streaming error', {
            requestId: req.id,
            error: error.message,
          });
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        }
        return;
      }
      
      // Handle non-streaming response - gateway service already returns transformed response
      logger.info('Chat completion completed', {
        requestId: req.id,
        model,
        tokensUsed: result.usage?.total_tokens || 0,
        finishReason: result.choices?.[0]?.finish_reason,
      });
      
      res.json(result);
      
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
   * Get available models for chat completion
   */
  static async getAvailableModels(req, res) {
    try {
      const models = gatewayService.getAvailableModels()
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