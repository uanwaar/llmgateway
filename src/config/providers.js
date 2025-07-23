/**
 * Provider-specific configuration and settings
 * 
 * This module manages provider-specific configurations including:
 * - Model definitions and capabilities
 * - Cost calculations and limits
 * - Provider-specific settings
 * - Feature flags per provider
 */

// const config = require('./index'); // TODO: Use config when needed

/**
 * OpenAI provider configuration
 */
const openaiConfig = {
  name: 'openai',
  displayName: 'OpenAI',
  enabled: true,
  baseUrl: 'https://api.openai.com/v1',
  
  // Model definitions with pricing and capabilities
  models: {
    'gpt-4o': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      multimodal: true,
      pricing: {
        inputTokens: 0.0000025,  // $2.50 per 1M tokens
        outputTokens: 0.00001,   // $10.00 per 1M tokens
        imageTokens: 0.00765,     // Per 1K tokens for images
      },
      features: ['chat', 'streaming', 'function_calling', 'vision'],
    },
    'gpt-4o-mini': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      multimodal: true,
      pricing: {
        inputTokens: 0.00000015,  // $0.15 per 1M tokens
        outputTokens: 0.0000006,  // $0.60 per 1M tokens
        imageTokens: 0.002295,     // Per 1K tokens for images
      },
      features: ['chat', 'streaming', 'function_calling', 'vision'],
    },
    'gpt-4-turbo': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      multimodal: true,
      pricing: {
        inputTokens: 0.00001,    // $10.00 per 1M tokens
        outputTokens: 0.00003,   // $30.00 per 1M tokens
        imageTokens: 0.00765,     // Per 1K tokens for images
      },
      features: ['chat', 'streaming', 'function_calling', 'vision'],
    },
    'text-embedding-3-small': {
      type: 'embedding',
      contextWindow: 8191,
      dimensions: 1536,
      pricing: {
        inputTokens: 0.00000002,  // $0.02 per 1M tokens
      },
      features: ['embedding'],
    },
    'text-embedding-3-large': {
      type: 'embedding',
      contextWindow: 8191,
      dimensions: 3072,
      pricing: {
        inputTokens: 0.00000013,  // $0.13 per 1M tokens
      },
      features: ['embedding'],
    },
    'gpt-4o-audio': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      multimodal: true,
      pricing: {
        inputTokens: 0.0000025,
        outputTokens: 0.00001,
        audioTokens: 0.000100,  // $100 per 1M tokens for audio
      },
      features: ['chat', 'streaming', 'function_calling', 'vision', 'audio'],
    },
    'gpt-4o-realtime': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      multimodal: true,
      pricing: {
        inputTokens: 0.000005,
        outputTokens: 0.00002,
        audioTokens: 0.000100,
      },
      features: ['chat', 'realtime', 'audio'],
    },
    'gpt-4o-search-preview': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      multimodal: true,
      pricing: {
        inputTokens: 0.0000025,
        outputTokens: 0.00001,
      },
      features: ['chat', 'streaming', 'function_calling', 'vision', 'search'],
    },
    'gpt-4o-transcribe': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      multimodal: true,
      pricing: {
        inputTokens: 0.0000025,
        outputTokens: 0.00001,
        audioTokens: 0.000010,
      },
      features: ['chat', 'transcription', 'audio'],
    },
    'gpt-4o-mini-audio': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      multimodal: true,
      pricing: {
        inputTokens: 0.00000015,
        outputTokens: 0.0000006,
        audioTokens: 0.000100,
      },
      features: ['chat', 'streaming', 'function_calling', 'vision', 'audio'],
    },
    'gpt-4o-mini-realtime': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      multimodal: true,
      pricing: {
        inputTokens: 0.0000003,
        outputTokens: 0.0000012,
        audioTokens: 0.000100,
      },
      features: ['chat', 'realtime', 'audio'],
    },
    'gpt-4o-mini-search-preview': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      multimodal: true,
      pricing: {
        inputTokens: 0.00000015,
        outputTokens: 0.0000006,
      },
      features: ['chat', 'streaming', 'function_calling', 'vision', 'search'],
    },
    'gpt-4o-mini-transcribe': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      multimodal: true,
      pricing: {
        inputTokens: 0.00000015,
        outputTokens: 0.0000006,
        audioTokens: 0.000010,
      },
      features: ['chat', 'transcription', 'audio'],
    },
    'gpt-4o-mini-tts': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      multimodal: true,
      pricing: {
        inputTokens: 0.00000015,
        outputTokens: 0.0000006,
        audioTokens: 0.000015,
      },
      features: ['chat', 'tts', 'audio'],
    },
    'gpt-4': {
      type: 'chat',
      contextWindow: 8192,
      maxOutputTokens: 4096,
      multimodal: false,
      pricing: {
        inputTokens: 0.00003,
        outputTokens: 0.00006,
      },
      features: ['chat', 'streaming', 'function_calling'],
    },
    'gpt-4.1': {
      type: 'chat',
      contextWindow: 32768,
      maxOutputTokens: 4096,
      multimodal: false,
      pricing: {
        inputTokens: 0.00003,
        outputTokens: 0.00006,
      },
      features: ['chat', 'streaming', 'function_calling'],
    },
    'o3': {
      type: 'chat',
      contextWindow: 200000,
      maxOutputTokens: 65536,
      multimodal: false,
      pricing: {
        inputTokens: 0.000060,
        outputTokens: 0.000240,
      },
      features: ['chat', 'reasoning'],
    },
    'o3-pro': {
      type: 'chat',
      contextWindow: 200000,
      maxOutputTokens: 65536,
      multimodal: false,
      pricing: {
        inputTokens: 0.000120,
        outputTokens: 0.000480,
      },
      features: ['chat', 'reasoning', 'advanced'],
    },
    'o3-mini': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 65536,
      multimodal: false,
      pricing: {
        inputTokens: 0.000003,
        outputTokens: 0.000012,
      },
      features: ['chat', 'reasoning'],
    },
    'o3-deep-research': {
      type: 'chat',
      contextWindow: 200000,
      maxOutputTokens: 65536,
      multimodal: false,
      pricing: {
        inputTokens: 0.000180,
        outputTokens: 0.000720,
      },
      features: ['chat', 'reasoning', 'research'],
    },
    'o4-mini': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 65536,
      multimodal: false,
      pricing: {
        inputTokens: 0.000002,
        outputTokens: 0.000008,
      },
      features: ['chat', 'reasoning'],
    },
    'o4-mini-deep-research': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 65536,
      multimodal: false,
      pricing: {
        inputTokens: 0.000003,
        outputTokens: 0.000012,
      },
      features: ['chat', 'reasoning', 'research'],
    },
    'o1-preview': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 32768,
      multimodal: false,
      pricing: {
        inputTokens: 0.000015,
        outputTokens: 0.000060,
      },
      features: ['chat', 'reasoning'],
    },
    'o1-mini': {
      type: 'chat',
      contextWindow: 128000,
      maxOutputTokens: 65536,
      multimodal: false,
      pricing: {
        inputTokens: 0.000003,
        outputTokens: 0.000012,
      },
      features: ['chat', 'reasoning'],
    },
    'whisper-1': {
      type: 'transcription',
      contextWindow: 25000000,  // 25MB file limit
      maxOutputTokens: 4096,
      multimodal: true,
      pricing: {
        audioMinutes: 0.006,  // $0.006 per minute
      },
      features: ['transcription', 'audio'],
    },
  },

  // Default settings
  defaults: {
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
    maxConcurrentRequests: 10,
  },

  // Rate limits (per minute)
  rateLimits: {
    'gpt-4o': { requests: 500, tokens: 30000 },
    'gpt-4o-mini': { requests: 500, tokens: 200000 },
    'gpt-4-turbo': { requests: 500, tokens: 30000 },
    'text-embedding-3-small': { requests: 3000, tokens: 1000000 },
    'text-embedding-3-large': { requests: 3000, tokens: 1000000 },
  },
};

/**
 * Google Gemini provider configuration
 */
const geminiConfig = {
  name: 'gemini',
  displayName: 'Google Gemini',
  enabled: true,
  baseUrl: 'https://generativelanguage.googleapis.com/v1',
  
  // Model definitions with pricing and capabilities
  models: {
    'gemini-2.5-pro': {
      type: 'chat',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      multimodal: true,
      pricing: {
        inputTokens: 0.00000125,  // $1.25 per 1M tokens
        outputTokens: 0.00000375, // $3.75 per 1M tokens
        imageTokens: 0.00000125,   // Per 1K tokens for images
      },
      features: ['chat', 'streaming', 'function_calling', 'vision', 'audio'],
    },
    'gemini-2.5-flash': {
      type: 'chat',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      multimodal: true,
      pricing: {
        inputTokens: 0.000000075, // $0.075 per 1M tokens
        outputTokens: 0.0000003,  // $0.30 per 1M tokens
        imageTokens: 0.000000075,  // Per 1K tokens for images
      },
      features: ['chat', 'streaming', 'function_calling', 'vision', 'audio'],
    },
    'gemini-2.0-flash': {
      type: 'chat',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      multimodal: true,
      pricing: {
        inputTokens: 0.000000075, // $0.075 per 1M tokens
        outputTokens: 0.0000003,  // $0.30 per 1M tokens
        imageTokens: 0.000000075,  // Per 1K tokens for images
      },
      features: ['chat', 'streaming', 'function_calling', 'vision', 'audio'],
    },
    'gemini-2.0-flash-exp': {
      type: 'chat',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      multimodal: true,
      pricing: {
        inputTokens: 0,          // Free during preview
        outputTokens: 0,         // Free during preview
        imageTokens: 0,           // Free during preview
      },
      features: ['chat', 'streaming', 'function_calling', 'vision', 'audio'],
    },
    'gemini-1.5-pro': {
      type: 'chat',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      multimodal: true,
      pricing: {
        inputTokens: 0.00000125,  // $1.25 per 1M tokens
        outputTokens: 0.00000375, // $3.75 per 1M tokens
        imageTokens: 0.00000125,   // Per 1K tokens for images
      },
      features: ['chat', 'streaming', 'function_calling', 'vision'],
    },
    'gemini-1.5-flash': {
      type: 'chat',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      multimodal: true,
      pricing: {
        inputTokens: 0.000000075, // $0.075 per 1M tokens
        outputTokens: 0.0000003,  // $0.30 per 1M tokens
        imageTokens: 0.000000075,  // Per 1K tokens for images
      },
      features: ['chat', 'streaming', 'function_calling', 'vision'],
    },
    'text-embedding-004': {
      type: 'embedding',
      contextWindow: 2048,
      dimensions: 768,
      pricing: {
        inputTokens: 0.00000001,   // $0.01 per 1M tokens
      },
      features: ['embedding'],
    },
  },

  // Default settings
  defaults: {
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
    maxConcurrentRequests: 10,
  },

  // Rate limits (per minute)
  rateLimits: {
    'gemini-1.5-pro': { requests: 360, tokens: 4000000 },
    'gemini-1.5-flash': { requests: 1000, tokens: 4000000 },
    'gemini-2.0-flash-exp': { requests: 1500, tokens: 1000000 },
    'text-embedding-004': { requests: 1500, tokens: 1000000 },
  },
};

/**
 * Get provider configuration by name
 */
function getProviderConfig(providerName) {
  switch (providerName.toLowerCase()) {
  case 'openai':
    return openaiConfig;
  case 'gemini':
    return geminiConfig;
  default:
    throw new Error(`Unknown provider: ${providerName}`);
  }
}

/**
 * Get all available providers
 */
function getAllProviders() {
  return [openaiConfig, geminiConfig];
}

/**
 * Get enabled providers only
 */
function getEnabledProviders() {
  return getAllProviders().filter(provider => provider.enabled);
}

/**
 * Get all models from all providers
 */
function getAllModels() {
  const models = {};
  
  getAllProviders().forEach(provider => {
    Object.keys(provider.models).forEach(modelName => {
      models[modelName] = {
        ...provider.models[modelName],
        provider: provider.name,
        providerDisplayName: provider.displayName,
      };
    });
  });
  
  return models;
}

/**
 * Get models by type (chat, embedding, etc.)
 */
function getModelsByType(type) {
  const allModels = getAllModels();
  const filteredModels = {};
  
  Object.keys(allModels).forEach(modelName => {
    if (allModels[modelName].type === type) {
      filteredModels[modelName] = allModels[modelName];
    }
  });
  
  return filteredModels;
}

/**
 * Calculate cost for a request
 */
function calculateCost(modelName, inputTokens, outputTokens = 0, imageTokens = 0) {
  const allModels = getAllModels();
  const model = allModels[modelName];
  
  if (!model) {
    return { error: `Model ${modelName} not found` };
  }
  
  const pricing = model.pricing;
  const cost = {
    input: inputTokens * pricing.inputTokens,
    output: outputTokens * pricing.outputTokens,
    images: imageTokens * (pricing.imageTokens || 0),
    total: 0,
  };
  
  cost.total = cost.input + cost.output + cost.images;
  
  return {
    modelName,
    provider: model.provider,
    inputTokens,
    outputTokens,
    imageTokens,
    cost,
    currency: 'USD',
  };
}

/**
 * Get rate limit information for a model
 */
function getRateLimit(providerName, modelName) {
  const provider = getProviderConfig(providerName);
  return provider.rateLimits[modelName] || provider.defaults;
}

module.exports = {
  openai: openaiConfig,
  gemini: geminiConfig,
  getProviderConfig,
  getAllProviders,
  getEnabledProviders,
  getAllModels,
  getModelsByType,
  calculateCost,
  getRateLimit,
};