/**
 * Authentication and authorization middleware
 * 
 * Features:
 * - API key validation
 * - Client vs gateway key handling
 * - Rate limiting per key
 * - Usage tracking and quotas
 */

const authService = require('../services/auth.service');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Authentication middleware with advanced features
 */
async function authMiddleware(req, res, next) {
  try {
    // Skip auth for health check endpoints
    if (req.path.startsWith('/health')) {
      return next();
    }
    
    // Extract API key from various headers
    const apiKey = extractApiKey(req);
    
    // Create authentication context
    const authContext = {
      requestId: req.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method,
    };
    
    // Validate API key using auth service
    const keyInfo = await authService.validateApiKey(apiKey, authContext);
    
    // Add comprehensive auth info to request
    req.auth = {
      authenticated: !!keyInfo,
      keyInfo,
      apiKey: keyInfo ? undefined : apiKey, // Don't expose validated keys
      keyId: keyInfo?.id,
      keyType: keyInfo?.type,
      provider: keyInfo?.provider,
      quotas: keyInfo?.quotas,
      metadata: keyInfo?.metadata,
    };
    
    // Record token usage for analytics
    if (keyInfo) {
      recordTokenUsage(req, keyInfo);
    }
    
    logger.debug('Request authenticated', {
      requestId: req.id,
      authenticated: req.auth.authenticated,
      keyId: req.auth.keyId,
      keyType: req.auth.keyType,
      provider: req.auth.provider,
    });
    
    next();
  } catch (error) {
    // Log authentication failures
    logger.warn('Authentication failed', {
      requestId: req.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      error: error.message,
    });
    
    next(error);
  }
}

/**
 * Optional auth middleware - doesn't throw if no auth provided
 */
async function optionalAuthMiddleware(req, res, next) {
  try {
    const apiKey = extractApiKey(req);
    
    if (apiKey) {
      const authContext = {
        requestId: req.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method,
      };
      
      try {
        const keyInfo = await authService.validateApiKey(apiKey, authContext);
        
        req.auth = {
          authenticated: !!keyInfo,
          keyInfo,
          keyId: keyInfo?.id,
          keyType: keyInfo?.type,
          provider: keyInfo?.provider,
          quotas: keyInfo?.quotas,
        };
        
        if (keyInfo) {
          recordTokenUsage(req, keyInfo);
        }
      } catch (error) {
        // For optional auth, don't throw errors, just mark as unauthenticated
        req.auth = { 
          authenticated: false, 
          reason: error.message,
          error: error.code,
        };
      }
    } else {
      req.auth = { authenticated: false, reason: 'no_key' };
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Extract API key from request headers
 */
function extractApiKey(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.get('Authorization');
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    // Also support "Authorization: sk-..." for OpenAI compatibility
    if (authHeader.startsWith('sk-') || authHeader.startsWith('AIza')) {
      return authHeader;
    }
  }
  
  // Check X-API-Key header
  const apiKeyHeader = req.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  // Check OpenAI-specific header
  const openaiHeader = req.get('OpenAI-API-Key');
  if (openaiHeader) {
    return openaiHeader;
  }
  
  return null;
}

/**
 * Record token usage for analytics and billing
 */
function recordTokenUsage(req, keyInfo) {
  // This will be enhanced when we process the response
  // For now, just record the request
  req.tokenUsage = {
    keyId: keyInfo.id,
    keyType: keyInfo.type,
    provider: keyInfo.provider,
    startTime: Date.now(),
    endpoint: req.path,
    method: req.method,
  };
}

/**
 * Middleware to record response token usage
 */
function recordResponseUsage(tokens = 0) {
  return (req, res, next) => {
    if (req.tokenUsage && req.auth?.keyInfo) {
      const context = {
        requestId: req.id,
        endpoint: req.path,
        method: req.method,
      };
      
      // Record the actual token usage
      authService.recordUsage(req.auth.keyInfo, context, tokens);
      
      logger.debug('Token usage recorded', {
        requestId: req.id,
        keyId: req.auth.keyInfo.id,
        tokens,
        responseTime: Date.now() - req.tokenUsage.startTime,
      });
    }
    
    next();
  };
}

/**
 * Rate limiting middleware per API key
 */
async function rateLimitByKey(req, res, next) {
  try {
    if (!req.auth?.keyInfo) {
      return next(); // Skip rate limiting if no valid key
    }
    
    // Rate limiting is already handled in authService.validateApiKey
    
    // Rate limiting is already handled in authService.validateApiKey
    // This middleware is for additional per-endpoint rate limiting
    const keyInfo = req.auth.keyInfo;
    const endpointLimits = keyInfo.rateLimits?.endpoints;
    
    if (endpointLimits && endpointLimits[req.path]) {
      // Custom rate limiting logic for specific endpoints
      // This would be implemented based on specific requirements
      logger.debug('Applying endpoint-specific rate limiting', {
        requestId: req.id,
        keyId: keyInfo.id,
        endpoint: req.path,
        limits: endpointLimits[req.path],
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require specific key types
 */
function requireKeyType(allowedTypes) {
  return (req, res, next) => {
    if (!req.auth?.authenticated) {
      return next(new UnauthorizedError('Authentication required'));
    }
    
    const keyType = req.auth.keyType;
    if (!allowedTypes.includes(keyType)) {
      return next(new ForbiddenError(
        `This endpoint requires ${allowedTypes.join(' or ')} key type, got ${keyType}`,
        { allowedTypes, providedType: keyType },
      ));
    }
    
    next();
  };
}

/**
 * Middleware to require specific provider keys
 */
function requireProvider(allowedProviders) {
  return (req, res, next) => {
    if (!req.auth?.authenticated) {
      return next(new UnauthorizedError('Authentication required'));
    }
    
    const provider = req.auth.provider;
    if (!allowedProviders.includes(provider)) {
      return next(new ForbiddenError(
        `This endpoint requires ${allowedProviders.join(' or ')} provider, got ${provider}`,
        { allowedProviders, providedProvider: provider },
      ));
    }
    
    next();
  };
}

module.exports = authMiddleware;
module.exports.optional = optionalAuthMiddleware;
module.exports.extractApiKey = extractApiKey;
module.exports.recordResponseUsage = recordResponseUsage;
module.exports.rateLimitByKey = rateLimitByKey;
module.exports.requireKeyType = requireKeyType;
module.exports.requireProvider = requireProvider;