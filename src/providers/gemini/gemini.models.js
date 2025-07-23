const GEMINI_MODELS = {
  // Gemini 2.5 Series
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'tools'],
    contextWindow: 2000000, // 2M tokens
    maxTokens: 8192,
    inputCost: 1.25,
    outputCost: 3.75,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      video: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      contextCaching: true,
      reasoning: true,
    },
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'tools'],
    contextWindow: 1000000, // 1M tokens
    maxTokens: 8192,
    inputCost: 0.075,
    outputCost: 0.30,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      video: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      contextCaching: true,
    },
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal'],
    contextWindow: 100000,
    maxTokens: 4096,
    inputCost: 0.037,
    outputCost: 0.15,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: false,
      video: false,
      tools: false,
      systemMessages: true,
      streaming: true,
      json_mode: false,
      contextCaching: false,
    },
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'tools'],
    contextWindow: 1000000,
    maxTokens: 8192,
    inputCost: 0.15,
    outputCost: 0.60,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      video: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      contextCaching: true,
    },
  },

  // Gemini 1.5 Series (Legacy)
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'tools'],
    contextWindow: 2000000,
    maxTokens: 8192,
    inputCost: 1.25,
    outputCost: 5.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      video: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      contextCaching: true,
      legacy: true,
    },
  },
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'tools'],
    contextWindow: 1000000,
    maxTokens: 8192,
    inputCost: 0.075,
    outputCost: 0.30,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      video: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      contextCaching: true,
      legacy: true,
    },
  },

  // TTS Models
  'gemini-2.5-flash-preview-tts': {
    id: 'gemini-2.5-flash-preview-tts',
    name: 'Gemini 2.5 Flash TTS',
    provider: 'gemini',
    type: 'tts',
    capabilities: ['tts', 'streaming'],
    contextWindow: 32000,
    maxTokens: null,
    inputCost: 3.00,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_characters',
    features: {
      tts: true,
      streaming: true,
      multiSpeaker: true,
      voiceCloning: false,
      voices: ['Zephyr', 'Puck', 'Charon', 'Nova', 'Echo', 'Fable', 'Onyx', 'Shimmer'],
      formats: ['audio/wav'],
      sampleRate: 24000,
      bitDepth: 16,
      channels: 1,
    },
  },
  'gemini-2.5-pro-preview-tts': {
    id: 'gemini-2.5-pro-preview-tts',
    name: 'Gemini 2.5 Pro TTS',
    provider: 'gemini',
    type: 'tts',
    capabilities: ['tts', 'streaming'],
    contextWindow: 32000,
    maxTokens: null,
    inputCost: 6.00,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_characters',
    features: {
      tts: true,
      streaming: true,
      multiSpeaker: true,
      voiceCloning: true,
      voiceInstructions: true,
      voices: ['Zephyr', 'Puck', 'Charon', 'Nova', 'Echo', 'Fable', 'Onyx', 'Shimmer'],
      formats: ['audio/wav'],
      sampleRate: 24000,
      bitDepth: 16,
      channels: 1,
    },
  },

  // Embedding Models
  'text-embedding-004': {
    id: 'text-embedding-004',
    name: 'Text Embedding 004',
    provider: 'gemini',
    type: 'embedding',
    capabilities: ['embedding'],
    contextWindow: 8192,
    maxTokens: null,
    dimensions: 768,
    inputCost: 0.25,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      embedding: true,
      configurableDimensions: true,
      maxDimensions: 768,
      taskTypes: [
        'SEMANTIC_SIMILARITY', 'CLASSIFICATION', 'CLUSTERING',
        'QUESTION_ANSWERING', 'FACT_VERIFICATION',
      ],
    },
  },
  'gemini-embedding-001': {
    id: 'gemini-embedding-001',
    name: 'Gemini Embedding 001',
    provider: 'gemini',
    type: 'embedding',
    capabilities: ['embedding', 'multimodal'],
    contextWindow: 8192,
    maxTokens: null,
    dimensions: 768,
    inputCost: 0.125,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      embedding: true,
      multimodal: true,
      vision: true,
      audio: true,
      taskTypes: ['SEMANTIC_SIMILARITY', 'CLASSIFICATION', 'CLUSTERING'],
    },
  },
};

const GEMINI_TASK_TYPES = {
  SEMANTIC_SIMILARITY: 'SEMANTIC_SIMILARITY',
  CLASSIFICATION: 'CLASSIFICATION',
  CLUSTERING: 'CLUSTERING',
  QUESTION_ANSWERING: 'QUESTION_ANSWERING',
  FACT_VERIFICATION: 'FACT_VERIFICATION',
};

const GEMINI_VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Nova', 'Echo', 'Fable', 
  'Onyx', 'Shimmer', 'Ballad', 'Coral', 'Sage', 'Verse',
  'Alloy', 'Ash', 'Breeze', 'Citrus', 'Dawn', 'Ember',
  'Grove', 'Harbor', 'Iris', 'Jade', 'Kale', 'Luna',
  'Meadow', 'Nectar', 'Ocean', 'Pine', 'Quest', 'River',
  'Stone', 'Tide', 'Vale', 'Wind',
];

const SAFETY_CATEGORIES = {
  HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
  HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH', 
  HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
};

const SAFETY_THRESHOLDS = {
  BLOCK_NONE: 'BLOCK_NONE',
  BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH',
  BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
  BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
};

class GeminiModels {
  static getModel(modelId) {
    return GEMINI_MODELS[modelId] || null;
  }

  static getAllModels() {
    return Object.values(GEMINI_MODELS);
  }

  static getModelsByType(type) {
    return Object.values(GEMINI_MODELS).filter(model => model.type === type);
  }

  static getModelsByCapability(capability) {
    return Object.values(GEMINI_MODELS).filter(model => 
      model.capabilities.includes(capability),
    );
  }

  static isModelSupported(modelId) {
    return modelId in GEMINI_MODELS;
  }

  static getModelCapabilities(modelId) {
    const model = GEMINI_MODELS[modelId];
    return model ? model.capabilities : [];
  }

  static getModelFeatures(modelId) {
    const model = GEMINI_MODELS[modelId];
    return model ? model.features : {};
  }

  static getCostInfo(modelId) {
    const model = GEMINI_MODELS[modelId];
    if (!model) return null;

    return {
      inputCost: model.inputCost,
      outputCost: model.outputCost,
      currency: model.currency,
      unit: model.unit,
    };
  }

  static getContextWindow(modelId) {
    const model = GEMINI_MODELS[modelId];
    return model ? model.contextWindow : null;
  }

  static getMaxTokens(modelId) {
    const model = GEMINI_MODELS[modelId];
    return model ? model.maxTokens : null;
  }

  static supportsFeature(modelId, feature) {
    const model = GEMINI_MODELS[modelId];
    return model && model.features && model.features[feature] === true;
  }

  static getCompletionModels() {
    return this.getModelsByType('completion');
  }

  static getEmbeddingModels() {
    return this.getModelsByType('embedding');
  }

  static getTTSModels() {
    return this.getModelsByType('tts');
  }

  static getStreamingModels() {
    return this.getModelsByCapability('streaming');
  }

  static getMultimodalModels() {
    return this.getModelsByCapability('multimodal');
  }

  static getToolCapableModels() {
    return this.getModelsByCapability('tools');
  }

  static validateModel(modelId, requiredCapability = null) {
    const model = this.getModel(modelId);
    
    if (!model) {
      return {
        valid: false,
        error: `Model '${modelId}' is not supported`,
      };
    }

    if (requiredCapability && !model.capabilities.includes(requiredCapability)) {
      return {
        valid: false,
        error: `Model '${modelId}' does not support '${requiredCapability}' capability`,
      };
    }

    return {
      valid: true,
      model,
    };
  }

  static getTaskTypes() {
    return Object.values(GEMINI_TASK_TYPES);
  }

  static getValidTaskType(taskType) {
    return GEMINI_TASK_TYPES[taskType] || taskType;
  }

  static getAvailableVoices() {
    return [...GEMINI_VOICES];
  }

  static isValidVoice(voice) {
    return GEMINI_VOICES.includes(voice);
  }

  static getSafetyCategories() {
    return Object.values(SAFETY_CATEGORIES);
  }

  static getSafetyThresholds() {
    return Object.values(SAFETY_THRESHOLDS);
  }

  static getDefaultSafetySettings() {
    return [
      {
        category: SAFETY_CATEGORIES.HARM_CATEGORY_HARASSMENT,
        threshold: SAFETY_THRESHOLDS.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: SAFETY_CATEGORIES.HARM_CATEGORY_HATE_SPEECH,
        threshold: SAFETY_THRESHOLDS.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: SAFETY_CATEGORIES.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: SAFETY_THRESHOLDS.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: SAFETY_CATEGORIES.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: SAFETY_THRESHOLDS.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];
  }

  static getModelList() {
    return Object.keys(GEMINI_MODELS).map(id => ({
      id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'google',
      permission: [],
      root: id,
      parent: null,
    }));
  }

  static getModelEndpoint(modelId) {
    const model = this.getModel(modelId);
    if (!model) return null;

    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    
    switch (model.type) {
    case 'completion':
      return `${baseUrl}/models/${modelId}`;
    case 'embedding':
      return `${baseUrl}/models/${modelId}`;
    case 'tts':
      return `${baseUrl}/models/${modelId}`;
    default:
      return `${baseUrl}/models/${modelId}`;
    }
  }

  static isLegacyModel(modelId) {
    const model = this.getModel(modelId);
    return model && model.features && model.features.legacy === true;
  }

  static getRecommendedModel(type, capability = null) {
    const models = this.getModelsByType(type);
    
    if (capability) {
      const capableModels = models.filter(model => 
        model.capabilities.includes(capability),
      );
      
      if (capableModels.length > 0) {
        // Return the most cost-effective non-legacy model
        return capableModels
          .filter(model => !model.features?.legacy)
          .sort((a, b) => a.inputCost - b.inputCost)[0] || capableModels[0];
      }
    }

    // Return the most cost-effective model for the type
    return models
      .filter(model => !model.features?.legacy)
      .sort((a, b) => a.inputCost - b.inputCost)[0] || models[0];
  }
}

module.exports = {
  GEMINI_MODELS,
  GEMINI_TASK_TYPES,
  GEMINI_VOICES,
  SAFETY_CATEGORIES,
  SAFETY_THRESHOLDS,
  GeminiModels,
};