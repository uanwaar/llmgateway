/**
 * Models controller
 * 
 * Handles OpenAI-compatible models endpoints
 */

const gatewayService = require('../services/gateway.service');
const { ModelNotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config');

class ModelsController {
  /**
   * List all available models
   */
  static async listModels(req, res) {
    try {
      logger.info('List models request', {
        requestId: req.id,
        query: req.query,
      });
      
      // Fetch base models list
      let models = gatewayService.getAvailableModels();

      // Filtering support (query params)
      // capability: string or comma-separated; case-insensitive with synonyms
      // type: completion|embedding|transcription|tts (comma-separated allowed)
      // provider: openai|gemini (comma-separated allowed)
      // realtime: true|1 to include realtime-capable models (capability or configured)
      // search: substring filter on id
      const {
        capability: capabilityQuery,
        type: typeQuery,
        provider: providerQuery,
        realtime: realtimeQuery,
        search: searchQuery,
      } = req.query || {};

      const toArray = (v) =>
        (typeof v === 'string' ? v.split(',') : Array.isArray(v) ? v : [])
          .map(s => String(s).trim().toLowerCase())
          .filter(Boolean);

      const capSynonyms = {
        chat: 'completion',
        completion: 'completion',
        message: 'completion',
        messages: 'completion',
        embeddings: 'embedding',
        embedding: 'embedding',
        asr: 'transcription',
        stt: 'transcription',
        transcribe: 'transcription',
        transcription: 'transcription',
        tts: 'tts',
        speech: 'tts',
        realtime: 'realtime',
        streaming: 'streaming',
        vision: 'multimodal', // treat "vision" as multimodal capability
        multimodal: 'multimodal',
        audio: 'audio',
        web_search: 'web_search',
      };

      const normalizeCap = (c) => capSynonyms[c] || c;

      // Precompute realtime-configured model ids
      const realtimeConfiguredIds = new Set(
        (config.realtime?.models || []).map(m => m.id),
      );

  // Apply provider filter
      if (providerQuery) {
        const providers = new Set(toArray(providerQuery));
        models = models.filter(m => providers.has(String(m.provider).toLowerCase()));
      }

      // Apply type filter
      if (typeQuery) {
        const types = new Set(toArray(typeQuery));
        models = models.filter(m => types.has(String(m.type).toLowerCase()));
      }

      // Apply capability filter (supports multiple, AND semantics by default)
      if (capabilityQuery) {
        const rawCaps = toArray(capabilityQuery);
        const caps = rawCaps.map(normalizeCap);
        models = models.filter(m => {
          const cset = new Set((m.capabilities || []).map(x => String(x).toLowerCase()));
          // Special handling: "audio" can also mean tts/transcription types
          const hasAudio = cset.has('audio') || ['tts', 'transcription'].includes(String(m.type).toLowerCase());
          return caps.every(cap => {
            if (cap === 'audio') return hasAudio;
            if (cap === 'vision' || cap === 'multimodal') return cset.has('multimodal');
            return cset.has(cap);
          });
        });
      }

  // Apply realtime filter (true/1): include models with capability 'realtime' OR listed in config.realtime.models
      if (realtimeQuery && ['true', '1', 'yes'].includes(String(realtimeQuery).toLowerCase())) {
        models = models.filter(m => {
          const caps = new Set((m.capabilities || []).map(x => String(x).toLowerCase()));
          return caps.has('realtime') || realtimeConfiguredIds.has(m.id);
        });
      }

      // Apply search filter
      if (searchQuery) {
        const q = String(searchQuery).toLowerCase();
        models = models.filter(m => String(m.id).toLowerCase().includes(q));
      }

      // De-duplicate by id (defensive)
      if (models.length > 1) {
        const map = new Map();
        for (const m of models) {
          if (!map.has(m.id)) map.set(m.id, m);
        }
        models = Array.from(map.values());
      }

      const result = models.map(model => ({
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
  type: model.type,
  context_length: model.contextLength,
  max_tokens: model.maxTokens,
  pricing: model.pricing || null,
  description: model.description || null,
  // helpers
  is_realtime: (model.capabilities || []).map(x => String(x).toLowerCase()).includes('realtime') || realtimeConfiguredIds.has(model.id),
      }));
      
      logger.info('List models completed', {
        requestId: req.id,
  modelsCount: result.length,
      });
      
      res.json({
        object: 'list',
  data: result,
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
      
      const modelInfo = gatewayService.getModelInfo(model);
      if (!modelInfo) {
        throw new ModelNotFoundError(model, {
          availableModels: gatewayService.getAvailableModels().map(m => m.id),
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
      
      // Case-insensitive capability with synonyms
      const capMap = {
        chat: 'completion',
        completion: 'completion',
        message: 'completion',
        embeddings: 'embedding',
        embedding: 'embedding',
        asr: 'transcription',
        stt: 'transcription',
        transcribe: 'transcription',
        transcription: 'transcription',
        tts: 'tts',
        speech: 'tts',
        realtime: 'realtime',
        streaming: 'streaming',
        vision: 'multimodal',
        multimodal: 'multimodal',
        audio: 'audio',
        web_search: 'web_search',
      };
      const reqCapRaw = String(capability || '').toLowerCase();
      const reqCap = capMap[reqCapRaw] || reqCapRaw;

      const realtimeConfiguredIds = new Set((config.realtime?.models || []).map(m => m.id));

      const base = gatewayService.getAvailableModels();
      const filtered = base.filter(model => {
        const caps = new Set((model.capabilities || []).map(c => String(c).toLowerCase()));
        if (reqCap === 'audio') {
          const hasAudio = caps.has('audio') || ['tts', 'transcription'].includes(String(model.type).toLowerCase());
          return hasAudio;
        }
        if (reqCap === 'vision' || reqCap === 'multimodal') {
          return caps.has('multimodal');
        }
        if (reqCap === 'realtime') {
          return caps.has('realtime') || realtimeConfiguredIds.has(model.id);
        }
        return caps.has(reqCap);
      });

      // De-duplicate by id (defensive)
      const unique = new Map();
      for (const m of filtered) {
        if (!unique.has(m.id)) unique.set(m.id, m);
      }
      const deduped = Array.from(unique.values());

      const models = deduped.map(model => ({
        id: model.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: model.provider,
        capability: reqCap,
        provider: model.provider,
        type: model.type,
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