/**
 * Authentication service
 * 
 * Handles:
 * - API key validation and storage
 * - Client vs gateway key handling logic
 * - Usage tracking and quota management
 */

const config = require('../config');
const logger = require('../utils/logger');
const { generateId } = require('../utils/helpers');
const crypto = require('../utils/crypto');
const { 
  AuthenticationError, 
  RateLimitError,
  QuotaExceededError,
} = require('../utils/errors');

class AuthService {
  constructor() {
    this.initialized = false;
    this.apiKeys = new Map(); // API key storage
    this.usageStats = new Map(); // Usage tracking
    this.quotas = new Map(); // Quota management
    this.rateLimits = new Map(); // Rate limiting
  }

  /**
   * Initialize authentication service
   */
  async initialize() {
    try {
      logger.info('Initializing Authentication Service');

      // Load authentication configuration
      const authConfig = config.auth || {};
      this.authMode = authConfig.mode || 'hybrid';
      this.allowClientKeys = authConfig.allowClientKeys !== false;
      this.requireAuthHeader = authConfig.requireAuthHeader === true;

      // Initialize API keys from configuration
      await this.loadApiKeysFromConfig();

      logger.info('Authentication Service initialized', {
        mode: this.authMode,
        allowClientKeys: this.allowClientKeys,
        requireAuthHeader: this.requireAuthHeader,
        loadedKeys: this.apiKeys.size,
      });

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize Authentication Service', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Load API keys from configuration
   */
  async loadApiKeysFromConfig() {
    // Load gateway-level provider API keys
    const providers = config.providers || {};

    // OpenAI API key
    if (providers.openai?.apiKey) {
      const keyInfo = {
        id: generateId(),
        name: 'OpenAI Gateway Key',
        type: 'gateway',
        provider: 'openai',
        key: providers.openai.apiKey,
        enabled: true,
        quotas: {
          requestsPerHour: 1000,
          requestsPerDay: 10000,
          tokensPerHour: 100000,
          tokensPerDay: 1000000,
        },
        createdAt: new Date(),
      };
      
      this.apiKeys.set(`gateway_openai_${keyInfo.id}`, keyInfo);
    }

    // Gemini API key
    if (providers.gemini?.apiKey) {
      const keyInfo = {
        id: generateId(),
        name: 'Gemini Gateway Key',
        type: 'gateway',
        provider: 'gemini',
        key: providers.gemini.apiKey,
        enabled: true,
        quotas: {
          requestsPerHour: 1000,
          requestsPerDay: 10000,
          tokensPerHour: 100000,
          tokensPerDay: 1000000,
        },
        createdAt: new Date(),
      };
      
      this.apiKeys.set(`gateway_gemini_${keyInfo.id}`, keyInfo);
    }

    // Load client API keys from environment or database
    // This would typically come from a database in production
    const clientKeys = process.env.CLIENT_API_KEYS;
    if (clientKeys) {
      try {
        const keys = JSON.parse(clientKeys);
        for (const keyData of keys) {
          this.addApiKey(keyData);
        }
      } catch (error) {
        logger.warn('Failed to parse CLIENT_API_KEYS', {
          error: error.message,
        });
      }
    }
  }

  /**
   * Validate API key and return key information
   */
  async validateApiKey(apiKey, context = {}) {
    if (!this.initialized) {
      throw new AuthenticationError('Authentication service not initialized');
    }

    if (!apiKey) {
      if (this.requireAuthHeader) {
        throw new AuthenticationError('API key is required');
      }
      return null; // Allow anonymous access if not required
    }

    // Check if it's a client-provided provider key (starts with sk-, AIza, etc.)
    const isProviderKey = this.isProviderApiKey(apiKey);
    
    if (isProviderKey && this.allowClientKeys) {
      return this.handleClientProviderKey(apiKey, context);
    }

    // Look up key in our storage
    const keyInfo = this.findApiKeyInfo(apiKey);
    if (!keyInfo) {
      throw new AuthenticationError('Invalid API key');
    }

    if (!keyInfo.enabled) {
      throw new AuthenticationError('API key is disabled');
    }

    // Check rate limits
    await this.checkRateLimit(keyInfo, context);

    // Check quotas
    await this.checkQuotas(keyInfo, context);

    // Update usage statistics
    this.recordUsage(keyInfo, context);

    logger.debug('API key validated successfully', {
      keyId: keyInfo.id,
      type: keyInfo.type,
      provider: keyInfo.provider,
      requestId: context.requestId,
    });

    return keyInfo;
  }

  /**
   * Check if API key looks like a provider key
   */
  isProviderApiKey(apiKey) {
    // OpenAI keys start with 'sk-'
    if (apiKey.startsWith('sk-')) {
      return true;
    }

    // Google API keys typically start with 'AIza'
    if (apiKey.startsWith('AIza')) {
      return true;
    }

    // Add other provider key patterns as needed
    return false;
  }

  /**
   * Handle client-provided provider API key
   */
  async handleClientProviderKey(apiKey, context) {
    const provider = this.detectProviderFromKey(apiKey);
    
    const keyInfo = {
      id: crypto.hashString(apiKey, 'sha256').substring(0, 16),
      name: `Client ${provider} Key`,
      type: 'client',
      provider,
      key: apiKey,
      enabled: true,
      quotas: {
        requestsPerHour: 100, // Lower limits for client keys
        requestsPerDay: 1000,
        tokensPerHour: 10000,
        tokensPerDay: 100000,
      },
      createdAt: new Date(),
    };

    // Check rate limits and quotas for client keys
    await this.checkRateLimit(keyInfo, context);
    await this.checkQuotas(keyInfo, context);
    
    // Record usage
    this.recordUsage(keyInfo, context);

    logger.debug('Client provider key validated', {
      provider,
      keyId: keyInfo.id,
      requestId: context.requestId,
    });

    return keyInfo;
  }

  /**
   * Detect provider from API key format
   */
  detectProviderFromKey(apiKey) {
    if (apiKey.startsWith('sk-')) {
      return 'openai';
    }
    if (apiKey.startsWith('AIza')) {
      return 'gemini';
    }
    return 'unknown';
  }

  /**
   * Find API key information in storage
   */
  findApiKeyInfo(apiKey) {
    // Direct lookup
    for (const [, keyInfo] of this.apiKeys) {
      if (keyInfo.key === apiKey) {
        return keyInfo;
      }
    }

    // Hash-based lookup for security
    const hashedKey = crypto.hashString(apiKey, 'sha256');
    for (const [, keyInfo] of this.apiKeys) {
      if (keyInfo.hashedKey === hashedKey) {
        return keyInfo;
      }
    }

    return null;
  }

  /**
   * Check rate limits for API key
   */
  async checkRateLimit(keyInfo, context) {
    const rateLimitKey = `${keyInfo.type}_${keyInfo.id}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    const rateLimit = this.rateLimits.get(rateLimitKey) || {
      requests: [],
      windowStart: now,
    };

    // Clean old requests outside the window
    rateLimit.requests = rateLimit.requests.filter(
      timestamp => now - timestamp < windowMs,
    );

    // Get rate limit configuration
    const maxRequests = keyInfo.rateLimits?.requestsPerMinute || 
                       (keyInfo.type === 'client' ? 10 : 60);

    if (rateLimit.requests.length >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        keyId: keyInfo.id,
        type: keyInfo.type,
        requests: rateLimit.requests.length,
        maxRequests,
        requestId: context.requestId,
      });

      throw new RateLimitError(
        `Rate limit exceeded: ${rateLimit.requests.length}/${maxRequests} requests per minute`,
        {
          limit: maxRequests,
          current: rateLimit.requests.length,
          resetTime: Math.ceil((windowMs - (now - rateLimit.windowStart)) / 1000),
        },
      );
    }

    // Record this request
    rateLimit.requests.push(now);
    this.rateLimits.set(rateLimitKey, rateLimit);
  }

  /**
   * Check quotas for API key
   */
  async checkQuotas(keyInfo, _context) {
    const quotaKey = `${keyInfo.type}_${keyInfo.id}`;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();

    const usage = this.usageStats.get(quotaKey) || {
      daily: {},
      hourly: {},
    };

    // Initialize today's usage if needed
    if (!usage.daily[today]) {
      usage.daily[today] = { requests: 0, tokens: 0 };
    }

    // Initialize current hour's usage if needed
    const hourKey = `${today}_${currentHour}`;
    if (!usage.hourly[hourKey]) {
      usage.hourly[hourKey] = { requests: 0, tokens: 0 };
    }

    const dailyUsage = usage.daily[today];
    const hourlyUsage = usage.hourly[hourKey];
    const quotas = keyInfo.quotas || {};

    // Check hourly quotas
    if (quotas.requestsPerHour && hourlyUsage.requests >= quotas.requestsPerHour) {
      throw new QuotaExceededError(
        `Hourly request quota exceeded: ${hourlyUsage.requests}/${quotas.requestsPerHour}`,
        {
          quota: quotas.requestsPerHour,
          used: hourlyUsage.requests,
          resetTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1),
        },
      );
    }

    if (quotas.tokensPerHour && hourlyUsage.tokens >= quotas.tokensPerHour) {
      throw new QuotaExceededError(
        `Hourly token quota exceeded: ${hourlyUsage.tokens}/${quotas.tokensPerHour}`,
        {
          quota: quotas.tokensPerHour,
          used: hourlyUsage.tokens,
          resetTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1),
        },
      );
    }

    // Check daily quotas
    if (quotas.requestsPerDay && dailyUsage.requests >= quotas.requestsPerDay) {
      throw new QuotaExceededError(
        `Daily request quota exceeded: ${dailyUsage.requests}/${quotas.requestsPerDay}`,
        {
          quota: quotas.requestsPerDay,
          used: dailyUsage.requests,
          resetTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      );
    }

    if (quotas.tokensPerDay && dailyUsage.tokens >= quotas.tokensPerDay) {
      throw new QuotaExceededError(
        `Daily token quota exceeded: ${dailyUsage.tokens}/${quotas.tokensPerDay}`,
        {
          quota: quotas.tokensPerDay,
          used: dailyUsage.tokens,
          resetTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      );
    }
  }

  /**
   * Record usage for API key
   */
  recordUsage(keyInfo, _context, tokens = 0) {
    const quotaKey = `${keyInfo.type}_${keyInfo.id}`;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const hourKey = `${today}_${currentHour}`;

    const usage = this.usageStats.get(quotaKey) || {
      daily: {},
      hourly: {},
    };

    // Initialize if needed
    if (!usage.daily[today]) {
      usage.daily[today] = { requests: 0, tokens: 0 };
    }
    if (!usage.hourly[hourKey]) {
      usage.hourly[hourKey] = { requests: 0, tokens: 0 };
    }

    // Increment counters
    usage.daily[today].requests++;
    usage.hourly[hourKey].requests++;

    if (tokens > 0) {
      usage.daily[today].tokens += tokens;
      usage.hourly[hourKey].tokens += tokens;
    }

    // Clean old usage data (keep last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
    
    for (const date in usage.daily) {
      if (date < cutoffDate) {
        delete usage.daily[date];
      }
    }

    for (const hourKey in usage.hourly) {
      const [date] = hourKey.split('_');
      if (date < cutoffDate) {
        delete usage.hourly[hourKey];
      }
    }

    this.usageStats.set(quotaKey, usage);

    logger.debug('Usage recorded', {
      keyId: keyInfo.id,
      tokens,
      dailyRequests: usage.daily[today].requests,
      hourlyRequests: usage.hourly[hourKey].requests,
      requestId: _context?.requestId,
    });
  }

  /**
   * Add new API key
   */
  addApiKey(keyData) {
    const keyInfo = {
      id: keyData.id || generateId(),
      name: keyData.name || 'Unnamed Key',
      type: keyData.type || 'client',
      provider: keyData.provider,
      key: keyData.key,
      hashedKey: crypto.hashString(keyData.key, 'sha256'),
      enabled: keyData.enabled !== false,
      quotas: keyData.quotas || {
        requestsPerHour: 100,
        requestsPerDay: 1000,
        tokensPerHour: 10000,
        tokensPerDay: 100000,
      },
      rateLimits: keyData.rateLimits || {
        requestsPerMinute: 10,
      },
      createdAt: new Date(),
      metadata: keyData.metadata || {},
    };

    const keyId = `${keyInfo.type}_${keyInfo.provider || 'generic'}_${keyInfo.id}`;
    this.apiKeys.set(keyId, keyInfo);

    logger.info('API key added', {
      keyId: keyInfo.id,
      name: keyInfo.name,
      type: keyInfo.type,
      provider: keyInfo.provider,
    });

    return keyInfo;
  }

  /**
   * Remove API key
   */
  removeApiKey(keyId) {
    const keyInfo = this.apiKeys.get(keyId);
    if (!keyInfo) {
      throw new Error(`API key not found: ${keyId}`);
    }

    this.apiKeys.delete(keyId);
    
    // Clean up usage stats
    const quotaKey = `${keyInfo.type}_${keyInfo.id}`;
    this.usageStats.delete(quotaKey);
    this.rateLimits.delete(quotaKey);

    logger.info('API key removed', {
      keyId: keyInfo.id,
      name: keyInfo.name,
    });

    return keyInfo;
  }

  /**
   * Get usage statistics for API key
   */
  getUsageStats(keyId) {
    const keyInfo = this.apiKeys.get(keyId);
    if (!keyInfo) {
      throw new Error(`API key not found: ${keyId}`);
    }

    const quotaKey = `${keyInfo.type}_${keyInfo.id}`;
    return this.usageStats.get(quotaKey) || { daily: {}, hourly: {} };
  }

  /**
   * Get all API keys (excluding sensitive data)
   */
  listApiKeys() {
    const keys = [];
    for (const [, keyInfo] of this.apiKeys) {
      keys.push({
        id: keyInfo.id,
        name: keyInfo.name,
        type: keyInfo.type,
        provider: keyInfo.provider,
        enabled: keyInfo.enabled,
        createdAt: keyInfo.createdAt,
        quotas: keyInfo.quotas,
        rateLimits: keyInfo.rateLimits,
        // Exclude actual key for security
      });
    }
    return keys;
  }

  /**
   * Get authentication service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      authMode: this.authMode,
      allowClientKeys: this.allowClientKeys,
      requireAuthHeader: this.requireAuthHeader,
      totalKeys: this.apiKeys.size,
      activeUsage: this.usageStats.size,
    };
  }

  /**
   * Shutdown authentication service
   */
  async shutdown() {
    logger.info('Shutting down Authentication Service');
    
    this.initialized = false;
    this.apiKeys.clear();
    this.usageStats.clear();
    this.quotas.clear();
    this.rateLimits.clear();
    
    logger.info('Authentication Service shutdown completed');
  }
}

// Export singleton instance
module.exports = new AuthService();