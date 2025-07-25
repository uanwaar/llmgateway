/**
 * Request validation middleware
 * 
 * Joi-based request validation with sanitization
 */

const Joi = require('joi');
const { ValidationError } = require('../utils/errors');
const validationService = require('../services/validation.service');
const { validators } = require('../utils/validator');

/**
 * Create validation middleware
 */
function createValidationMiddleware(schema, options = {}) {
  return (req, res, next) => {
    try {
      const validationOptions = {
        abortEarly: false, // Include all errors
        allowUnknown: options.allowUnknown || false,
        stripUnknown: options.stripUnknown || true,
        ...options,
      };
      
      // Validate request body, params, and query
      const toValidate = {};
      
      if (schema.body) {
        toValidate.body = req.body;
      }
      
      if (schema.params) {
        toValidate.params = req.params;
      }
      
      if (schema.query) {
        toValidate.query = req.query;
      }
      
      if (schema.headers) {
        toValidate.headers = req.headers;
      }
      
      const { error, value } = schema.validate ? 
        schema.validate(toValidate, validationOptions) :
        Joi.object(schema).validate(toValidate, validationOptions);
      
      if (error) {
        const validationError = new ValidationError(
          'Request validation failed',
          error.details[0]?.path?.join('.'),
          error.details[0]?.context?.value,
          {
            validationErrors: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value,
            })),
          },
        );
        
        return next(validationError);
      }
      
      // Sanitize validated values
      const sanitizationOptions = options.sanitization || {
        html: true,
        sql: true,
        xss: true,
        trim: true,
        normalize: true,
      };
      
      // Update request with validated/sanitized values
      if (value.body) {
        req.body = validationService.sanitizeObject(value.body, sanitizationOptions);
      }
      if (value.params) {
        req.params = validationService.sanitizeObject(value.params, sanitizationOptions);
      }
      if (value.query) {
        req.query = validationService.sanitizeObject(value.query, sanitizationOptions);
      }
      
      // Validate request size
      if (options.validateSize !== false) {
        try {
          validationService.validateRequestSize(req, options.maxSize);
        } catch (error) {
          return next(error);
        }
      }
      
      // Validate content type for POST/PUT requests
      if (options.validateContentType !== false && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          validationService.validateContentType(req, options.allowedContentTypes);
        } catch (error) {
          return next(error);
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
const schemas = {
  // Chat completion request schema - FLEXIBLE VERSION
  chatCompletion: {
    body: Joi.object({
      // Required fields
      model: Joi.string().required().description('Model to use for completion'),
      messages: Joi.array().items(
        Joi.object({
          role: Joi.string().required(), // Allow any role string for flexibility
          content: Joi.alternatives().try(
            Joi.string().allow(''),
            Joi.array(),
            Joi.object(),
            null,
          ).allow(null), // Very flexible content
        }).unknown(true), // Allow additional message properties
      ).min(1).required(),
      
      // Optional parameters - all very flexible with minimal constraints
      temperature: Joi.number().min(0).max(5).optional(), // Extended range
      top_p: Joi.number().min(0).max(1).optional(),
      n: Joi.number().integer().min(1).max(20).optional(), // Higher limit
      stream: Joi.boolean().optional(),
      stop: Joi.alternatives().try(
        Joi.string(), 
        Joi.array().items(Joi.string()),
        null,
      ).optional(),
      max_tokens: Joi.number().integer().min(1).optional(), // No upper limit
      presence_penalty: Joi.number().min(-2).max(2).optional(),
      frequency_penalty: Joi.number().min(-2).max(2).optional(),
      logit_bias: Joi.object().optional(),
      user: Joi.string().optional(),
      
      // Response format - flexible
      response_format: Joi.alternatives().try(
        Joi.object(),
        Joi.string(),
      ).optional(),
      
      // Additional OpenAI parameters
      seed: Joi.number().integer().optional(),
      tools: Joi.array().optional(),
      tool_choice: Joi.alternatives().try(
        Joi.string(),
        Joi.object(),
      ).optional(),
      
      // Function calling (legacy)
      functions: Joi.array().optional(),
      function_call: Joi.alternatives().try(
        Joi.string(),
        Joi.object(),
      ).optional(),
      
      // Gemini-specific parameters
      safety_settings: Joi.array().optional(),
      generation_config: Joi.object().optional(),
      
    }).unknown(true), // Allow any additional properties for maximum flexibility
  },
  
  // Embeddings request schema - FLEXIBLE VERSION
  embeddings: {
    body: Joi.object({
      // Required fields
      input: Joi.alternatives().try(
        Joi.string().allow(''),
        Joi.array(),
        Joi.number(),
        Joi.object(),
      ).required(),
      model: Joi.string().required(),
      
      // Optional parameters - flexible
      encoding_format: Joi.string().optional(), // Allow any encoding format
      dimensions: Joi.number().integer().min(1).optional(),
      user: Joi.string().optional(),
      
    }).unknown(true), // Allow additional properties
  },
  
  // Audio transcription schema
  audioTranscription: {
    body: Joi.object({
      file: Joi.any().required(), // File will be handled by multer
      model: Joi.string().default('whisper-1'),
      language: Joi.string().length(2), // ISO-639-1 language code
      prompt: Joi.string(),
      response_format: Joi.string()
        .valid('json', 'text', 'srt', 'verbose_json', 'vtt').default('json'),
      temperature: Joi.number().min(0).max(1).default(0),
    }),
  },
  
  // Audio speech synthesis schema
  audioSpeech: {
    body: Joi.object({
      model: Joi.string().valid('tts-1', 'tts-1-hd').required(),
      input: Joi.string().max(4096).required(),
      voice: Joi.string()
        .valid('alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer').required(),
      response_format: Joi.string()
        .valid('mp3', 'opus', 'aac', 'flac', 'wav', 'pcm').default('mp3'),
      speed: Joi.number().min(0.25).max(4.0).default(1.0),
    }),
  },
  
  // File upload validation
  fileUpload: {
    body: Joi.object({
      purpose: Joi.string().valid('transcription', 'translation', 'fine-tune').required(),
      file: Joi.any().required(),
    }),
  },
  
  // Models listing validation
  models: {
    query: Joi.object({
      provider: Joi.string().valid('openai', 'gemini', 'all').default('all'),
      capability: Joi.string().valid('chat', 'embeddings', 'audio', 'vision'),
      limit: Joi.number().integer().min(1).max(100).default(50),
      offset: Joi.number().integer().min(0).default(0),
    }),
  },
  
  // Health check validation
  health: {
    query: Joi.object({
      detailed: Joi.boolean().default(false),
      provider: Joi.string().valid('openai', 'gemini'),
    }),
  },
  
  // Metrics validation
  metrics: {
    query: Joi.object({
      period: Joi.string().valid('hour', 'day', 'week', 'month').default('hour'),
      provider: Joi.string().valid('openai', 'gemini'),
      metric: Joi.string().valid('requests', 'latency', 'errors', 'cache'),
      format: Joi.string().valid('json', 'prometheus').default('json'),
    }),
  },
};

/**
 * Security validation middleware
 */
function createSecurityValidationMiddleware(options = {}) {
  return (req, res, next) => {
    try {
      // Rate limit validation
      if (options.checkRateLimit !== false) {
        const rateLimitHeaders = ['x-ratelimit-limit', 'x-ratelimit-remaining'];
        rateLimitHeaders.forEach(header => {
          if (req.headers[header] && !validators.range(parseInt(req.headers[header]), 0).valid) {
            return next(new ValidationError(`Invalid ${header} header`));
          }
        });
      }
      
      // API key validation
      if (options.validateApiKey !== false && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          const apiKey = authHeader.substring(7);
          const validation = validators.apiKey(apiKey);
          if (!validation.valid) {
            return next(new ValidationError('Invalid API key format'));
          }
        }
      }
      
      // User agent validation
      if (options.requireUserAgent && !req.headers['user-agent']) {
        return next(new ValidationError('User-Agent header required'));
      }
      
      // Origin validation for CORS preflight
      if (req.method === 'OPTIONS' && req.headers.origin) {
        const originValid = validators.url(req.headers.origin);
        if (!originValid.valid) {
          return next(new ValidationError('Invalid Origin header'));
        }
      }
      
      // Content encoding validation
      if (req.headers['content-encoding']) {
        const allowedEncodings = ['gzip', 'deflate', 'br'];
        if (!allowedEncodings.includes(req.headers['content-encoding'])) {
          return next(new ValidationError('Unsupported content encoding'));
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Parameter sanitization middleware
 */
function createSanitizationMiddleware(options = {}) {
  return (req, res, next) => {
    try {
      const sanitizationOptions = {
        html: options.html !== false,
        sql: options.sql !== false,
        xss: options.xss !== false,
        trim: options.trim !== false,
        normalize: options.normalize !== false,
        ...options,
      };
      
      // Sanitize all request data
      if (req.body) {
        req.body = validationService.sanitizeObject(req.body, sanitizationOptions);
      }
      
      if (req.query) {
        req.query = validationService.sanitizeObject(req.query, sanitizationOptions);
      }
      
      if (req.params) {
        req.params = validationService.sanitizeObject(req.params, sanitizationOptions);
      }
      
      // Sanitize specific headers
      const headersToSanitize = ['user-agent', 'referer'];
      headersToSanitize.forEach(header => {
        if (req.headers[header]) {
          req.headers[header] = validationService.sanitize(
            req.headers[header], 
            sanitizationOptions,
          );
        }
      });
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = createValidationMiddleware;
module.exports.schemas = schemas;
module.exports.security = createSecurityValidationMiddleware;
module.exports.sanitization = createSanitizationMiddleware;