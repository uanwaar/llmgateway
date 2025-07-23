/**
 * Central configuration management
 * 
 * Features:
 * - Environment-based config loading
 * - Configuration validation
 * - Dynamic config updates
 * - Secret management integration
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const Joi = require('joi');

/**
 * Configuration schema for validation
 */
const configSchema = Joi.object({
  server: Joi.object({
    port: Joi.number().port().default(8080),
    host: Joi.string().default('0.0.0.0'),
    timeout: Joi.number().positive().default(30000),
    corsEnabled: Joi.boolean().default(true),
    rateLimitingEnabled: Joi.boolean().default(true),
  }).required(),
  
  auth: Joi.object({
    mode: Joi.string().valid('gateway', 'client', 'hybrid').default('hybrid'),
    allowClientKeys: Joi.boolean().default(true),
    requireAuthHeader: Joi.boolean().default(false),
  }).required(),
  
  providers: Joi.object({
    openai: Joi.object({
      enabled: Joi.boolean().default(true),
      baseUrl: Joi.string().uri().required(),
      timeout: Joi.number().positive().default(30000),
      retryCount: Joi.number().min(0).default(3),
      useResponsesAPI: Joi.boolean().default(true),
    }),
    gemini: Joi.object({
      enabled: Joi.boolean().default(true),
      baseUrl: Joi.string().uri().required(),
      timeout: Joi.number().positive().default(30000),
      retryCount: Joi.number().min(0).default(3),
    }),
  }).required(),
  
  cache: Joi.object({
    enabled: Joi.boolean().default(true),
    backend: Joi.string().valid('memory', 'redis').default('memory'),
    ttl: Joi.number().positive().default(3600),
  }).required(),
  
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    format: Joi.string().valid('json', 'text').default('json'),
  }).required(),
});

class ConfigManager {
  constructor() {
    this.config = null;
    this.configPath = path.join(__dirname, '../../config');
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Load configuration from files
   */
  load() {
    try {
      // Load default configuration
      const defaultConfig = this.loadConfigFile('default.yaml');
      
      // Load environment-specific configuration
      const envConfig = this.loadConfigFile(`${this.environment}.yaml`);
      
      // Merge configurations (env overrides default)
      this.config = this.mergeConfig(defaultConfig, envConfig);
      
      // Override with environment variables
      this.applyEnvironmentVariables();
      
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Load a specific configuration file
   */
  loadConfigFile(filename) {
    const filePath = path.join(this.configPath, filename);
    
    if (!fs.existsSync(filePath)) {
      if (filename === 'default.yaml') {
        throw new Error(`Default configuration file not found: ${filePath}`);
      }
      return {}; // Return empty object for missing env-specific configs
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    return yaml.parse(fileContent);
  }

  /**
   * Merge two configuration objects
   */
  mergeConfig(defaultConfig, envConfig) {
    return this.deepMerge(defaultConfig, envConfig);
  }

  /**
   * Deep merge utility function
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Apply environment variable overrides
   */
  applyEnvironmentVariables() {
    // Server configuration
    if (process.env.GATEWAY_PORT) {
      this.config.server.port = parseInt(process.env.GATEWAY_PORT, 10);
    }
    if (process.env.HOST) {
      this.config.server.host = process.env.HOST;
    }

    // Provider API keys
    if (process.env.OPENAI_API_KEY) {
      this.config.providers.openai.apiKey = process.env.OPENAI_API_KEY;
    }
    if (process.env.OPENAI_USE_RESPONSES_API !== undefined) {
      this.config.providers.openai.useResponsesAPI = process.env.OPENAI_USE_RESPONSES_API === 'true';
    }
    if (process.env.GEMINI_API_KEY) {
      this.config.providers.gemini.apiKey = process.env.GEMINI_API_KEY;
    }

    // Feature flags
    if (process.env.CACHE_ENABLED !== undefined) {
      this.config.cache.enabled = process.env.CACHE_ENABLED === 'true';
    }
    if (process.env.RATE_LIMITING_ENABLED !== undefined) {
      this.config.server.rateLimitingEnabled = process.env.RATE_LIMITING_ENABLED === 'true';
    }

    // Cache configuration
    if (process.env.CACHE_TTL) {
      this.config.cache.ttl = parseInt(process.env.CACHE_TTL, 10);
    }
    if (process.env.REDIS_URL) {
      this.config.cache.redis = { url: process.env.REDIS_URL };
    }

    // Logging
    if (process.env.LOG_LEVEL) {
      this.config.logging.level = process.env.LOG_LEVEL;
    }
  }

  /**
   * Validate configuration against schema
   */
  async validate() {
    if (!this.config) {
      this.load();
    }

    const { error, value } = configSchema.validate(this.config, {
      allowUnknown: true,
      abortEarly: false,
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      throw new Error(`Configuration validation failed: ${errorMessages.join(', ')}`);
    }

    this.config = value;
    return this.config;
  }

  /**
   * Get configuration value by path
   */
  get(path) {
    if (!this.config) {
      this.load();
    }

    const keys = path.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get all configuration
   */
  getAll() {
    if (!this.config) {
      this.load();
    }
    return this.config;
  }

  /**
   * Reload configuration (for dynamic updates)
   */
  reload() {
    this.config = null;
    return this.load();
  }
}

// Create singleton instance
const configManager = new ConfigManager();

// Export the configuration
module.exports = configManager.getAll();
module.exports.manager = configManager;