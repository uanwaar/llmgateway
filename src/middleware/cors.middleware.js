/**
 * CORS middleware
 * 
 * Configurable Cross-Origin Resource Sharing
 */

const cors = require('cors');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Create CORS middleware with configuration
 */
function createCorsMiddleware(options = {}) {
  const corsConfig = {
    // Allow origins from configuration
    origin: (origin, callback) => {
      const allowedOrigins = options.origins || 
        config.server?.cors?.origins || 
        ['http://localhost:3000', 'http://localhost:8000'];
      
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is allowed
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS: Origin not allowed', { 
          requestId: 'cors-check',
          origin,
          allowedOrigins, 
        });
        callback(new Error('Not allowed by CORS'));
      }
    },
    
    // Allowed HTTP methods
    methods: options.methods || 
      config.server?.cors?.methods || 
      ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    
    // Allowed headers
    allowedHeaders: options.allowedHeaders || 
      config.server?.cors?.allowedHeaders || [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
      'X-Correlation-ID',
    ],
    
    // Exposed headers (client can access)
    exposedHeaders: options.exposedHeaders || 
      config.server?.cors?.exposedHeaders || [
      'X-Request-ID',
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset',
      'X-Cache',
      'X-Cache-Key',
      'X-Cache-TTL',
    ],
    
    // Allow credentials (cookies, auth headers)
    credentials: options.credentials !== undefined ? 
      options.credentials : 
      config.server?.cors?.credentials || true,
    
    // Preflight cache time
    maxAge: options.maxAge || 
      config.server?.cors?.maxAge || 
      86400, // 24 hours
    
    // CORS preflight continue
    preflightContinue: false,
    
    // Success status for OPTIONS
    optionsSuccessStatus: 204,
  };
  
  return cors(corsConfig);
}

/**
 * Development CORS (allow all)
 */
const developmentCors = createCorsMiddleware({
  origins: ['*'],
  credentials: false,
});

/**
 * Production CORS (strict)
 */
const productionCors = createCorsMiddleware();

// Export appropriate CORS based on environment
const corsMiddleware = process.env.NODE_ENV === 'development' ? 
  developmentCors : 
  productionCors;

module.exports = corsMiddleware;
module.exports.development = developmentCors;
module.exports.production = productionCors;
module.exports.custom = createCorsMiddleware;