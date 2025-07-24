/**
 * Embeddings controller
 * 
 * Handles OpenAI-compatible embeddings requests
 */

const gatewayService = require('../services/gateway.service');
const logger = require('../utils/logger');

class EmbeddingsController {
  /**
   * Create embeddings
   */
  static async createEmbeddings(req, res) {
    const { model, input, encoding_format = 'float', dimensions } = req.body;
    
    try {
      logger.info('Embeddings request', {
        requestId: req.id,
        model,
        inputType: Array.isArray(input) ? 'array' : 'string',
        inputLength: Array.isArray(input) ? input.length : input.length,
        encodingFormat: encoding_format,
        dimensions,
      });
      
      // Use gateway service for embeddings processing
      const response = await gatewayService.createEmbeddings(req.body, {
        requestId: req.id,
      });
      
      // Gateway service returns already transformed response
      logger.info('Embeddings completed', {
        requestId: req.id,
        model,
        embeddingsCount: response.data?.length || 0,
        tokensUsed: response.usage?.total_tokens || 0,
      });
      
      res.json(response);
      
    } catch (error) {
      logger.error('Embeddings error', {
        requestId: req.id,
        model,
        error: error.message,
        provider: req.provider,
      });
      
      throw error;
    }
  }
  
  /**
   * Get available embedding models
   */
  static async getAvailableModels(req, res) {
    try {
      const models = gatewayService.getAvailableModels()
        .filter(model => model.capabilities.includes('embeddings'))
        .map(model => ({
          id: model.id,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: model.provider,
          permission: [],
          root: model.id,
          parent: null,
          max_dimensions: model.maxDimensions || null,
          default_dimensions: model.defaultDimensions || null,
        }));
      
      res.json({
        object: 'list',
        data: models,
      });
      
    } catch (error) {
      logger.error('Get embedding models error', {
        requestId: req.id,
        error: error.message,
      });
      
      throw error;
    }
  }
}

module.exports = EmbeddingsController;