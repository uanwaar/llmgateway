/**
 * Authentication middleware
 * 
 * Validates API keys and authorization headers
 */

const config = require('../config');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 */
function authMiddleware(req, res, next) {
  try {
    // Skip auth for health check endpoints
    if (req.path.startsWith('/health')) {
      return next();
    }
    
    // Get auth header
    const authHeader = req.get('Authorization');
    const apiKey = req.get('X-API-Key');
    
    let token;
    
    // Extract token from Authorization header (Bearer token)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (apiKey) {
      token = apiKey;
    }
    
    // Check if token is provided
    if (!token) {
      throw new UnauthorizedError('Missing API key or authorization token', {
        provided: { authHeader: !!authHeader, apiKey: !!apiKey },
        expected: 'Bearer token in Authorization header or X-API-Key header',
      });
    }
    
    // Validate token against configured API keys
    const validApiKeys = config.auth.apiKeys || [];
    const isValidKey = validApiKeys.includes(token);
    
    if (!isValidKey) {
      logger.warn('Invalid API key attempt', {
        requestId: req.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        keyPrefix: `${token.substring(0, 8)}...`,
      });
      
      throw new ForbiddenError('Invalid API key', {
        keyPrefix: `${token.substring(0, 8)}...`,
      });
    }
    
    // Add auth info to request
    req.auth = {
      apiKey: token,
      keyPrefix: `${token.substring(0, 8)}...`,
      authenticated: true,
    };
    
    logger.debug('Request authenticated', {
      requestId: req.id,
      keyPrefix: req.auth.keyPrefix,
    });
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional auth middleware - doesn't throw if no auth provided
 */
function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.get('Authorization');
    const apiKey = req.get('X-API-Key');
    
    let token;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (apiKey) {
      token = apiKey;
    }
    
    if (token) {
      const validApiKeys = config.auth.apiKeys || [];
      const isValidKey = validApiKeys.includes(token);
      
      if (isValidKey) {
        req.auth = {
          apiKey: token,
          keyPrefix: `${token.substring(0, 8)}...`,
          authenticated: true,
        };
      } else {
        req.auth = { authenticated: false, reason: 'invalid_key' };
      }
    } else {
      req.auth = { authenticated: false, reason: 'no_key' };
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authMiddleware;
module.exports.optional = optionalAuthMiddleware;