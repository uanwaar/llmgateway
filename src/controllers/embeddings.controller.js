/**
 * Embeddings controller
 * 
 * Handles OpenAI-compatible embeddings requests
 */

const ProviderRegistry = require('../providers/base/registry');
const ResponseTransformer = require('../providers/base/response.transformer');
const { ModelNotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class EmbeddingsController {
  /**
   * Create embeddings
   */
  static async createEmbeddings(req, res) {
    const { model, input, encoding_format = 'float', dimensions, user } = req.body;
    
    try {
      logger.info('Embeddings request', {
        requestId: req.id,
        model,
        inputType: Array.isArray(input) ? 'array' : 'string',
        inputLength: Array.isArray(input) ? input.length : input.length,
        encodingFormat: encoding_format,
        dimensions,
      });
      
      // Get provider for the model
      const provider = ProviderRegistry.getProviderForModel(model);
      if (!provider) {
        throw new ModelNotFoundError(model, {
          availableModels: ProviderRegistry.getAvailableModels()
            .filter(m => m.capabilities.includes('embeddings'))
            .map(m => m.id),
          requestedModel: model,
        });
      }
      
      // Add provider info to request for metrics
      req.provider = provider.name;
      
      // Validate model supports embeddings
      const modelInfo = ProviderRegistry.getModelInfo(model);
      if (!modelInfo || !modelInfo.capabilities.includes('embeddings')) {
        throw new ValidationError(
          `Model ${model} does not support embeddings`,
          'model',
          model,
          {
            modelCapabilities: modelInfo?.capabilities || [],
            requiredCapability: 'embeddings',
          },
        );
      }
      
      // Prepare request for provider
      const providerRequest = {
        model,
        input,
        encoding_format,
        dimensions,
        user,
      };
      
      // Get embeddings from provider
      const response = await provider.createEmbeddings(providerRequest);
      
      // Transform response to OpenAI format
      const transformedResponse = ResponseTransformer.transformEmbeddings(
        response,
        provider.name,
        model,
      );
      
      logger.info('Embeddings completed', {
        requestId: req.id,
        model,
        provider: provider.name,
        embeddingsCount: transformedResponse.data?.length || 0,
        tokensUsed: transformedResponse.usage?.total_tokens || 0,
      });
      
      res.json(transformedResponse);
      
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
      const models = ProviderRegistry.getAvailableModels()
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