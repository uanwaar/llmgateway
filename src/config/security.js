/**
 * Security configuration and utilities
 * 
 * This module handles:
 * - API key management and validation
 * - Encryption/decryption utilities
 * - Security policies and rules
 * - Authentication configuration
 */

const crypto = require('crypto');
// const config = require('./index'); // TODO: Use config when needed

/**
 * Security configuration
 */
const securityConfig = {
  // API Key settings
  apiKey: {
    header: process.env.API_KEY_HEADER || 'X-API-Key',
    required: process.env.REQUIRE_AUTH_HEADER === 'true',
    gateway: process.env.GATEWAY_API_KEY,
    allowClientKeys: true,
    keyMinLength: 32,
    keyMaxLength: 128,
  },

  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: '24h',
    algorithm: 'HS256',
    issuer: 'llm-gateway',
    audience: 'llm-gateway-clients',
  },

  // Encryption settings
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
  },

  // CORS settings
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-ID'],
    credentials: true,
    maxAge: 86400, // 24 hours
  },

  // Request validation
  validation: {
    maxRequestSize: '10mb',
    allowedContentTypes: ['application/json', 'multipart/form-data'],
    requireContentType: true,
    sanitizeInput: true,
  },

  // Security headers (Helmet configuration)
  headers: {
    contentSecurityPolicy: {
      enabled: false, // Disabled for API gateway
      directives: {
        defaultSrc: ['\'self\''],
        styleSrc: ['\'self\'', '\'unsafe-inline\''],
        scriptSrc: ['\'self\''],
        imgSrc: ['\'self\'', 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true,
  },
};

/**
 * Validate API key format
 */
function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key must be a non-empty string' };
  }

  if (apiKey.length < securityConfig.apiKey.keyMinLength) {
    return { 
      valid: false, 
      error: `API key must be at least ${securityConfig.apiKey.keyMinLength} characters long`, 
    };
  }

  if (apiKey.length > securityConfig.apiKey.keyMaxLength) {
    return { 
      valid: false, 
      error: `API key must be no more than ${securityConfig.apiKey.keyMaxLength} characters long`, 
    };
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validPattern = /^[a-zA-Z0-9\-_]+$/;
  if (!validPattern.test(apiKey)) {
    return { 
      valid: false, 
      error: 'API key contains invalid characters. Only alphanumeric, ' +
        'hyphens, and underscores allowed', 
    };
  }

  return { valid: true };
}

/**
 * Generate a secure API key
 */
function generateApiKey(length = 64, prefix = 'llm') {
  const randomBytes = crypto.randomBytes(Math.ceil(length / 2));
  const apiKey = `${prefix}_${randomBytes.toString('hex')
    .substring(0, length - prefix.length - 1)}`;
  return apiKey;
}

/**
 * Hash API key for secure storage
 */
function hashApiKey(apiKey) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(apiKey, salt, 100000, 64, 'sha512');
  return {
    hash: hash.toString('hex'),
    salt: salt.toString('hex'),
  };
}

/**
 * Verify API key against stored hash
 */
function verifyApiKey(apiKey, storedHash, storedSalt) {
  const salt = Buffer.from(storedSalt, 'hex');
  const hash = crypto.pbkdf2Sync(apiKey, salt, 100000, 64, 'sha512');
  return hash.toString('hex') === storedHash;
}

/**
 * Encrypt sensitive data
 */
function encrypt(text, key = null) {
  try {
    const encryptionKey = key || crypto.scryptSync(securityConfig.jwt.secret, 'salt', 32);
    const iv = crypto.randomBytes(securityConfig.encryption.ivLength);
    
    const cipher = crypto.createCipher(securityConfig.encryption.algorithm, encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt sensitive data
 */
function decrypt(encryptedData, key = null) {
  try {
    const encryptionKey = key || crypto.scryptSync(securityConfig.jwt.secret, 'salt', 32);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipher(securityConfig.encryption.algorithm, encryptionKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Sanitize user input to prevent injection attacks
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove potential script tags and dangerous patterns
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:text\/html/gi, '')
    .trim();
}

/**
 * Validate request origin
 */
function validateOrigin(origin, allowedOrigins = securityConfig.cors.origins) {
  if (!origin) {
    return true; // Allow requests without origin (e.g., server-to-server)
  }

  if (allowedOrigins.includes('*')) {
    return true;
  }

  return allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      // Support wildcard patterns like *.example.com
      const pattern = new RegExp(`^${allowed.replace(/\*/g, '.*')}$`);
      return pattern.test(origin);
    }
    return allowed === origin;
  });
}

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId() {
  return crypto.randomUUID();
}

/**
 * Mask sensitive information in logs
 */
function maskSensitiveData(data) {
  const masked = { ...data };
  const sensitiveFields = ['password', 'apiKey', 'api_key', 'token', 'secret', 'authorization'];
  
  sensitiveFields.forEach(field => {
    if (masked[field]) {
      masked[field] = '***masked***';
    }
  });
  
  return masked;
}

/**
 * Check if IP is in allowed list (basic implementation)
 */
function isIpAllowed(ip, allowedIps = []) {
  if (allowedIps.length === 0) {
    return true; // No restrictions
  }
  
  return allowedIps.includes(ip);
}

/**
 * Get security configuration
 */
function getSecurityConfig() {
  return securityConfig;
}

module.exports = {
  config: securityConfig,
  validateApiKeyFormat,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  encrypt,
  decrypt,
  sanitizeInput,
  validateOrigin,
  generateCorrelationId,
  maskSensitiveData,
  isIpAllowed,
  getSecurityConfig,
};