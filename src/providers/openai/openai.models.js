const OPENAI_MODELS = {
  // GPT-4o Series
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4 Omni',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'tools'],
    contextWindow: 128000,
    maxTokens: 16384,
    inputCost: 2.50,
    outputCost: 10.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
    },
  },
  'gpt-4o-audio': {
    id: 'gpt-4o-audio',
    name: 'GPT-4 Omni Audio',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'audio', 'tools'],
    contextWindow: 128000,
    maxTokens: 16384,
    inputCost: 2.50,
    outputCost: 10.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      realtime: true,
    },
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4 Omni Mini',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'tools'],
    contextWindow: 128000,
    maxTokens: 16384,
    inputCost: 0.15,
    outputCost: 0.60,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
    },
  },
  'gpt-4o-mini-audio': {
    id: 'gpt-4o-mini-audio',
    name: 'GPT-4 Omni Mini Audio',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'audio', 'tools'],
    contextWindow: 128000,
    maxTokens: 16384,
    inputCost: 0.15,
    outputCost: 0.60,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      realtime: true,
    },
  },

  // GPT-4 Series
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'tools'],
    contextWindow: 128000,
    maxTokens: 4096,
    inputCost: 10.00,
    outputCost: 30.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
    },
  },
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'tools'],
    contextWindow: 8192,
    maxTokens: 4096,
    inputCost: 30.00,
    outputCost: 60.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: false,
    },
  },

  // GPT-4o Extended Models
  'gpt-4o-realtime': {
    id: 'gpt-4o-realtime',
    name: 'GPT-4 Omni Realtime',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'audio', 'realtime'],
    contextWindow: 128000,
    maxTokens: 16384,
    inputCost: 2.50,
    outputCost: 10.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      realtime: true,
    },
  },
  'gpt-4o-search-preview': {
    id: 'gpt-4o-search-preview',
    name: 'GPT-4 Omni Search Preview',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'web_search'],
    contextWindow: 128000,
    maxTokens: 16384,
    inputCost: 2.50,
    outputCost: 10.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      web_search: true,
    },
  },
  'gpt-4o-mini-realtime': {
    id: 'gpt-4o-mini-realtime',
    name: 'GPT-4 Omni Mini Realtime',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'audio', 'realtime'],
    contextWindow: 128000,
    maxTokens: 16384,
    inputCost: 0.15,
    outputCost: 0.60,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: true,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      realtime: true,
    },
  },
  'gpt-4o-mini-search-preview': {
    id: 'gpt-4o-mini-search-preview',
    name: 'GPT-4 Omni Mini Search Preview',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'multimodal', 'web_search'],
    contextWindow: 128000,
    maxTokens: 16384,
    inputCost: 0.15,
    outputCost: 0.60,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: true,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
      web_search: true,
    },
  },

  // GPT-4.1
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'streaming', 'tools'],
    contextWindow: 128000,
    maxTokens: 4096,
    inputCost: 10.00,
    outputCost: 30.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: true,
      json_mode: true,
    },
  },

  // O-Series (Reasoning Models)
  'o3': {
    id: 'o3',
    name: 'O3',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'reasoning', 'tools'],
    contextWindow: 200000,
    maxTokens: 100000,
    inputCost: 5.00,
    outputCost: 15.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: false,
      reasoning: true,
      json_mode: true,
    },
  },
  'o3-pro': {
    id: 'o3-pro',
    name: 'O3 Pro',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'reasoning', 'tools'],
    contextWindow: 200000,
    maxTokens: 100000,
    inputCost: 15.00,
    outputCost: 50.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: false,
      reasoning: true,
      json_mode: true,
      advanced_reasoning: true,
    },
  },
  'o3-mini': {
    id: 'o3-mini',
    name: 'O3 Mini',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'reasoning', 'tools'],
    contextWindow: 128000,
    maxTokens: 65536,
    inputCost: 1.00,
    outputCost: 4.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: false,
      reasoning: true,
      json_mode: true,
    },
  },
  'o3-deep-research': {
    id: 'o3-deep-research',
    name: 'O3 Deep Research',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'reasoning', 'tools', 'deep_research'],
    contextWindow: 200000,
    maxTokens: 100000,
    inputCost: 20.00,
    outputCost: 80.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: false,
      reasoning: true,
      json_mode: true,
      deep_research: true,
    },
  },
  'o4-mini': {
    id: 'o4-mini',
    name: 'O4 Mini',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'reasoning', 'tools'],
    contextWindow: 128000,
    maxTokens: 65536,
    inputCost: 0.80,
    outputCost: 3.20,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: false,
      reasoning: true,
      json_mode: true,
    },
  },
  'o4-mini-deep-research': {
    id: 'o4-mini-deep-research',
    name: 'O4 Mini Deep Research',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'reasoning', 'tools', 'deep_research'],
    contextWindow: 128000,
    maxTokens: 65536,
    inputCost: 8.00,
    outputCost: 32.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: true,
      systemMessages: true,
      streaming: false,
      reasoning: true,
      json_mode: true,
      deep_research: true,
    },
  },
  'o1-preview': {
    id: 'o1-preview',
    name: 'O1 Preview',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'reasoning'],
    contextWindow: 128000,
    maxTokens: 32768,
    inputCost: 15.00,
    outputCost: 60.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: false,
      systemMessages: false,
      streaming: false,
      reasoning: true,
      json_mode: false,
    },
  },
  'o1-mini': {
    id: 'o1-mini',
    name: 'O1 Mini',
    provider: 'openai',
    type: 'completion',
    capabilities: ['completion', 'reasoning'],
    contextWindow: 128000,
    maxTokens: 65536,
    inputCost: 3.00,
    outputCost: 12.00,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      vision: false,
      audio: false,
      tools: false,
      systemMessages: false,
      streaming: false,
      reasoning: true,
      json_mode: false,
    },
  },

  // Audio Models
  'whisper-1': {
    id: 'whisper-1',
    name: 'Whisper',
    provider: 'openai',
    type: 'transcription',
    capabilities: ['transcription', 'translation'],
    contextWindow: null,
    maxTokens: null,
    inputCost: 0.006,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_minute',
    features: {
      transcription: true,
      translation: true,
      streaming: false,
      formats: ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
    },
  },
  'gpt-4o-transcribe': {
    id: 'gpt-4o-transcribe',
    name: 'GPT-4 Omni Transcribe',
    provider: 'openai',
    type: 'transcription',
    capabilities: ['transcription', 'streaming'],
    contextWindow: null,
    maxTokens: null,
    inputCost: 0.012,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_minute',
    features: {
      transcription: true,
      translation: false,
      streaming: true,
      logprobs: true,
      formats: ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      chunkingStrategies: ['auto', 'server_vad'],
    },
  },
  'gpt-4o-mini-transcribe': {
    id: 'gpt-4o-mini-transcribe',
    name: 'GPT-4 Omni Mini Transcribe',
    provider: 'openai',
    type: 'transcription',
    capabilities: ['transcription', 'streaming'],
    contextWindow: null,
    maxTokens: null,
    inputCost: 0.008,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_minute',
    features: {
      transcription: true,
      translation: false,
      streaming: true,
      logprobs: true,
      formats: ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      chunkingStrategies: ['auto', 'server_vad'],
    },
  },

  // TTS Models
  'tts-1': {
    id: 'tts-1',
    name: 'TTS-1',
    provider: 'openai',
    type: 'tts',
    capabilities: ['tts'],
    contextWindow: null,
    maxTokens: 4096,
    inputCost: 15.00,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_characters',
    features: {
      tts: true,
      streaming: false,
      voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
      formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
      maxInput: 4096,
      speedRange: [0.25, 4.0],
    },
  },
  'tts-1-hd': {
    id: 'tts-1-hd',
    name: 'TTS-1 HD',
    provider: 'openai',
    type: 'tts',
    capabilities: ['tts'],
    contextWindow: null,
    maxTokens: 4096,
    inputCost: 30.00,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_characters',
    features: {
      tts: true,
      streaming: false,
      voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
      formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
      maxInput: 4096,
      speedRange: [0.25, 4.0],
      highDefinition: true,
    },
  },
  'gpt-4o-mini-tts': {
    id: 'gpt-4o-mini-tts',
    name: 'GPT-4 Omni Mini TTS',
    provider: 'openai',
    type: 'tts',
    capabilities: ['tts', 'streaming'],
    contextWindow: null,
    maxTokens: 4096,
    inputCost: 25.00,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_characters',
    features: {
      tts: true,
      streaming: true,
      voices: [
        'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer',
        'ash', 'ballad', 'coral', 'sage', 'verse',
      ],
      formats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
      maxInput: 4096,
      speedRange: [0.25, 4.0],
      voiceInstructions: true,
      streamFormats: ['sse', 'audio'],
    },
  },

  // Embedding Models
  'text-embedding-3-large': {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    provider: 'openai',
    type: 'embedding',
    capabilities: ['embedding'],
    contextWindow: 8191,
    maxTokens: null,
    dimensions: 3072,
    inputCost: 0.13,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      embedding: true,
      maxDimensions: 3072,
      reducedDimensions: true,
    },
  },
  'text-embedding-3-small': {
    id: 'text-embedding-3-small',
    name: 'Text Embedding 3 Small',
    provider: 'openai',
    type: 'embedding',
    capabilities: ['embedding'],
    contextWindow: 8191,
    maxTokens: null,
    dimensions: 1536,
    inputCost: 0.02,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      embedding: true,
      maxDimensions: 1536,
      reducedDimensions: true,
    },
  },
  'text-embedding-ada-002': {
    id: 'text-embedding-ada-002',
    name: 'Text Embedding Ada 002',
    provider: 'openai',
    type: 'embedding',
    capabilities: ['embedding'],
    contextWindow: 8191,
    maxTokens: null,
    dimensions: 1536,
    inputCost: 0.10,
    outputCost: 0,
    currency: 'USD',
    unit: 'per_1M_tokens',
    features: {
      embedding: true,
      maxDimensions: 1536,
      reducedDimensions: false,
    },
  },
};

class OpenAIModels {
  static getModel(modelId) {
    return OPENAI_MODELS[modelId] || null;
  }

  static getAllModels() {
    return Object.values(OPENAI_MODELS);
  }

  static getModelsByType(type) {
    return Object.values(OPENAI_MODELS).filter(model => model.type === type);
  }

  static getModelsByCapability(capability) {
    return Object.values(OPENAI_MODELS).filter(model => 
      model.capabilities.includes(capability),
    );
  }

  static isModelSupported(modelId) {
    return modelId in OPENAI_MODELS;
  }

  static getModelCapabilities(modelId) {
    const model = OPENAI_MODELS[modelId];
    return model ? model.capabilities : [];
  }

  static getModelFeatures(modelId) {
    const model = OPENAI_MODELS[modelId];
    return model ? model.features : {};
  }

  static getCostInfo(modelId) {
    const model = OPENAI_MODELS[modelId];
    if (!model) return null;

    return {
      inputCost: model.inputCost,
      outputCost: model.outputCost,
      currency: model.currency,
      unit: model.unit,
    };
  }

  static getContextWindow(modelId) {
    const model = OPENAI_MODELS[modelId];
    return model ? model.contextWindow : null;
  }

  static getMaxTokens(modelId) {
    const model = OPENAI_MODELS[modelId];
    return model ? model.maxTokens : null;
  }

  static supportsFeature(modelId, feature) {
    const model = OPENAI_MODELS[modelId];
    return model && model.features && model.features[feature] === true;
  }

  static getCompletionModels() {
    return this.getModelsByType('completion');
  }

  static getEmbeddingModels() {
    return this.getModelsByType('embedding');
  }

  static getTranscriptionModels() {
    return this.getModelsByType('transcription');
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

  static getReasoningModels() {
    return Object.values(OPENAI_MODELS).filter(model => 
      model.features && model.features.reasoning === true,
    );
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

  static getModelList() {
    return Object.keys(OPENAI_MODELS).map(id => ({
      id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'openai',
      permission: [],
      root: id,
      parent: null,
    }));
  }
}

module.exports = {
  OPENAI_MODELS,
  OpenAIModels,
};