/**
 * Models controller
 * 
 * Handles OpenAI-compatible models endpoints
 */

const ProviderRegistry = require('../providers/base/registry');
const { ModelNotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

class ModelsController {
  /**
   * List all available models
   */
  static async listModels(req, res) {
    try {
      logger.info('List models request', {
        requestId: req.id,
      });
      
      const models = ProviderRegistry.getAvailableModels().map(model => ({
        id: model.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: model.provider,
        permission: [
          {
            id: `modelperm-${model.id}`,
            object: 'model_permission',
            created: Math.floor(Date.now() / 1000),
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: true,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: '*',
            group: null,
            is_blocking: false,
          },
        ],
        root: model.id,
        parent: null,
        // Additional metadata
        provider: model.provider,
        capabilities: model.capabilities,
        context_length: model.contextLength,
        max_tokens: model.maxTokens,
        pricing: model.pricing || null,
        description: model.description || null,
      }));
      
      logger.info('List models completed', {
        requestId: req.id,
        modelsCount: models.length,
      });
      
      res.json({
        object: 'list',
        data: models,
      });
      
    } catch (error) {
      logger.error('List models error', {
        requestId: req.id,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Get specific model details
   */
  static async getModel(req, res) {
    const { model } = req.params;
    
    try {
      logger.info('Get model request', {
        requestId: req.id,
        model,
      });
      
      const modelInfo = ProviderRegistry.getModelInfo(model);
      if (!modelInfo) {
        throw new ModelNotFoundError(model, {
          availableModels: ProviderRegistry.getAvailableModels().map(m => m.id),
          requestedModel: model,
        });
      }
      
      const modelDetails = {
        id: modelInfo.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: modelInfo.provider,
        permission: [
          {
            id: `modelperm-${modelInfo.id}`,
            object: 'model_permission',
            created: Math.floor(Date.now() / 1000),
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: true,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: '*',
            group: null,
            is_blocking: false,
          },
        ],
        root: modelInfo.id,
        parent: null,
        // Extended details
        provider: modelInfo.provider,
        capabilities: modelInfo.capabilities,
        context_length: modelInfo.contextLength,
        max_tokens: modelInfo.maxTokens,
        description: modelInfo.description || null,
        pricing: modelInfo.pricing || null,
        training_data_cutoff: modelInfo.trainingDataCutoff || null,
        supports_streaming: modelInfo.capabilities.includes('streaming'),
        supports_function_calling: modelInfo.capabilities.includes('function_calling'),
        supports_vision: modelInfo.capabilities.includes('vision'),
        supports_audio: modelInfo.capabilities.includes('audio'),
      };
      
      logger.info('Get model completed', {
        requestId: req.id,
        model,
        provider: modelInfo.provider,
      });
      
      res.json(modelDetails);
      
    } catch (error) {
      logger.error('Get model error', {
        requestId: req.id,
        model,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Get models by capability
   */
  static async getModelsByCapability(req, res) {
    const { capability } = req.params;
    
    try {
      logger.info('Get models by capability request', {
        requestId: req.id,
        capability,
      });
      
      const models = ProviderRegistry.getAvailableModels()
        .filter(model => model.capabilities.includes(capability))
        .map(model => ({
          id: model.id,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: model.provider,
          capability,
          provider: model.provider,
          context_length: model.contextLength,
          max_tokens: model.maxTokens,
          pricing: model.pricing || null,
        }));
      
      if (models.length === 0) {
        return res.status(404).json({
          error: {
            message: `No models found with capability: ${capability}`,
            type: 'not_found',
            param: 'capability',
            code: null,
          },
        });
      }
      
      logger.info('Get models by capability completed', {
        requestId: req.id,
        capability,
        modelsCount: models.length,
      });
      
      res.json({
        object: 'list',
        data: models,
        capability,
      });
      
    } catch (error) {
      logger.error('Get models by capability error', {
        requestId: req.id,
        capability,
        error: error.message,
      });
      
      throw error;
    }
  }
}

module.exports = ModelsController;