/**
 * Validation service
 * 
 * Centralized request validation and sanitization
 */

const Joi = require('joi');
const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class ValidationService {
  constructor() {
    this.schemas = new Map();
    this.customValidators = new Map();
    
    // Initialize default schemas
    this.initializeDefaultSchemas();
  }
  
  /**
   * Initialize default validation schemas
   */
  initializeDefaultSchemas() {
    // Common field schemas
    const commonSchemas = {
      apiKey: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).min(20).max(100),
      email: Joi.string().email(),
      url: Joi.string().uri(),
      uuid: Joi.string().uuid(),
      timestamp: Joi.date().iso(),
      modelName: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/),
    };
    
    // Register common schemas
    Object.entries(commonSchemas).forEach(([name, schema]) => {
      this.schemas.set(name, schema);
    });
  }
  
  /**
   * Register a validation schema
   */
  registerSchema(name, schema) {
    if (typeof name !== 'string') {
      throw new Error('Schema name must be a string');
    }
    
    if (!Joi.isSchema(schema)) {
      throw new Error('Schema must be a valid Joi schema');
    }
    
    this.schemas.set(name, schema);
    logger.debug('Validation schema registered', { schemaName: name });
  }
  
  /**
   * Get a registered schema
   */
  getSchema(name) {
    return this.schemas.get(name);
  }
  
  /**
   * Validate data against a schema
   */
  async validate(data, schemaName, options = {}) {
    const schema = this.getSchema(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }
    
    const validationOptions = {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
      convert: true,
      ...options,
    };
    
    try {
      const { error, value } = schema.validate(data, validationOptions);
      
      if (error) {
        const validationError = new ValidationError(
          'Validation failed',
          error.details[0]?.path?.join('.'),
          error.details[0]?.context?.value,
          {
            validationErrors: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value,
              type: detail.type,
            })),
          },
        );
        
        throw validationError;
      }
      
      return value;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new Error(`Validation error: ${error.message}`);
    }
  }
  
  /**
   * Sanitize user input
   */
  sanitize(input, options = {}) {
    if (typeof input !== 'string') {
      return input;
    }
    
    let sanitized = input;
    
    // HTML sanitization
    if (options.html !== false) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: options.allowedTags || [],
        ALLOWED_ATTR: options.allowedAttributes || [],
      });
    }
    
    // SQL injection prevention
    if (options.sql !== false) {
      sanitized = validator.escape(sanitized);
    }
    
    // XSS prevention
    if (options.xss !== false) {
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    
    // Trim whitespace
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }
    
    // Normalize unicode
    if (options.normalize !== false) {
      sanitized = sanitized.normalize('NFKC');
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize object recursively
   */
  sanitizeObject(obj, options = {}) {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'string') {
      return this.sanitize(obj, options);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, options));
    }
    
    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitize(key, { html: false, sql: false });
        sanitized[sanitizedKey] = this.sanitizeObject(value, options);
      }
      return sanitized;
    }
    
    return obj;
  }
  
  /**
   * Validate API key format
   */
  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    // Basic format validation
    if (apiKey.length < 20 || apiKey.length > 100) {
      return false;
    }
    
    // Character validation
    if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate model name
   */
  validateModelName(modelName) {
    if (!modelName || typeof modelName !== 'string') {
      return false;
    }
    
    // Model name pattern
    return /^[a-zA-Z0-9._-]+$/.test(modelName);
  }
  
  /**
   * Validate request size
   */
  validateRequestSize(req, maxSize = 10 * 1024 * 1024) { // 10MB default
    const contentLength = parseInt(req.headers['content-length'], 10);
    
    if (contentLength && contentLength > maxSize) {
      throw new ValidationError(
        'Request payload too large',
        'content-length',
        contentLength,
        { maxSize, actualSize: contentLength },
      );
    }
    
    return true;
  }
  
  /**
   * Validate content type
   */
  validateContentType(req, allowedTypes = ['application/json']) {
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      throw new ValidationError(
        'Content-Type header required',
        'content-type',
        null,
        { allowedTypes },
      );
    }
    
    const baseType = contentType.split(';')[0].trim();
    
    if (!allowedTypes.includes(baseType)) {
      throw new ValidationError(
        'Invalid Content-Type',
        'content-type',
        baseType,
        { allowedTypes },
      );
    }
    
    return true;
  }
  
  /**
   * Register custom validator
   */
  registerCustomValidator(name, validator) {
    if (typeof name !== 'string') {
      throw new Error('Validator name must be a string');
    }
    
    if (typeof validator !== 'function') {
      throw new Error('Validator must be a function');
    }
    
    this.customValidators.set(name, validator);
    logger.debug('Custom validator registered', { validatorName: name });
  }
  
  /**
   * Run custom validator
   */
  async runCustomValidator(name, data, options = {}) {
    const validator = this.customValidators.get(name);
    if (!validator) {
      throw new Error(`Custom validator '${name}' not found`);
    }
    
    try {
      return await validator(data, options);
    } catch (error) {
      throw new ValidationError(
        `Custom validation failed: ${error.message}`,
        name,
        data,
        { validatorName: name },
      );
    }
  }
}

// Singleton instance
const validationService = new ValidationService();

module.exports = validationService;