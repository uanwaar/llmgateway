const { registry } = require('./base/registry');
const { OpenAIAdapter } = require('./openai');
const { GeminiAdapter } = require('./gemini');

// Export all provider components
module.exports = {
  // Registry
  registry,
  
  // Adapters
  OpenAIAdapter,
  GeminiAdapter,
  
  // Helper function to initialize providers
  async initializeProviders(config) {
    const initialized = [];
    
    if (config.openai && config.openai.enabled !== false) {
      const openaiAdapter = new OpenAIAdapter(config.openai);
      registry.register('openai', openaiAdapter);
      initialized.push('openai');
    }
    
    if (config.gemini && config.gemini.enabled !== false) {
      const geminiAdapter = new GeminiAdapter(config.gemini);
      registry.register('gemini', geminiAdapter);
      initialized.push('gemini');
    }
    
    // Initialize all registered providers
    const result = await registry.initializeAll();
    
    return {
      initialized,
      ...result,
    };
  },
  
  // Helper function to get a provider
  getProvider(name) {
    return registry.get(name);
  },
  
  // Helper function to list all providers
  listProviders() {
    return registry.list();
  },
  
  // Helper function to get the best provider for a request
  getBestProvider(criteria) {
    return registry.getBest(criteria);
  },
};