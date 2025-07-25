/**
 * Validator utilities
 * 
 * Collection of validation helper functions
 */

const validator = require('validator');
const Joi = require('joi');

/**
 * Common validation patterns
 */
const PATTERNS = {
  // API key patterns
  OPENAI_API_KEY: /^sk-[a-zA-Z0-9]{48}$/,
  GOOGLE_API_KEY: /^[a-zA-Z0-9_-]{39}$/,
  GENERIC_API_KEY: /^[a-zA-Z0-9_-]{20,100}$/,
  
  // Model name patterns
  OPENAI_MODEL: /^(gpt-3\.5-turbo|gpt-4|gpt-4-turbo|davinci|curie|babbage|ada)(-[a-zA-Z0-9-]+)?$/,
  GEMINI_MODEL: /^(gemini-(pro|flash|ultra))(-[a-zA-Z0-9-]+)?$/,
  
  // File patterns
  AUDIO_FILE: /\.(mp3|wav|m4a|flac|ogg|opus|webm)$/i,
  IMAGE_FILE: /\.(jpg|jpeg|png|gif|webp|bmp)$/i,
  
  // URL patterns
  HTTP_URL: /^https?:\/\/.+/,
  WEBSOCKET_URL: /^wss?:\/\/.+/,
  
  // Content patterns
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  CORRELATION_ID: /^[a-zA-Z0-9_-]{8,32}$/,
};

/**
 * Validation helper functions
 */
const validators = {
  /**
   * Validate API key format
   */
  apiKey: (key, provider = null) => {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'API key must be a non-empty string' };
    }
    
    let pattern = PATTERNS.GENERIC_API_KEY;
    
    if (provider) {
      switch (provider.toLowerCase()) {
      case 'openai':
        pattern = PATTERNS.OPENAI_API_KEY;
        break;
      case 'google':
      case 'gemini':
        pattern = PATTERNS.GOOGLE_API_KEY;
        break;
      }
    }
    
    if (!pattern.test(key)) {
      return { 
        valid: false, 
        error: `Invalid API key format${provider ? ` for ${provider}` : ''}`, 
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate model name
   */
  modelName: (model, provider = null) => {
    if (!model || typeof model !== 'string') {
      return { valid: false, error: 'Model name must be a non-empty string' };
    }
    
    if (provider) {
      let pattern;
      switch (provider.toLowerCase()) {
      case 'openai':
        pattern = PATTERNS.OPENAI_MODEL;
        break;
      case 'google':
      case 'gemini':
        pattern = PATTERNS.GEMINI_MODEL;
        break;
      default:
        // Allow any model name for unknown providers
        return { valid: true };
      }
      
      if (!pattern.test(model)) {
        return { 
          valid: false, 
          error: `Invalid model name '${model}' for provider '${provider}'`, 
        };
      }
    }
    
    return { valid: true };
  },
  
  /**
   * Validate URL
   */
  url: (url, options = {}) => {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'URL must be a non-empty string' };
    }
    
    const validatorOptions = {
      protocols: options.protocols || ['http', 'https'],
      require_protocol: options.requireProtocol !== false,
      require_host: options.requireHost !== false,
      require_valid_protocol: options.requireValidProtocol !== false,
      allow_underscores: options.allowUnderscores || false,
      allow_trailing_dot: options.allowTrailingDot || false,
    };
    
    if (!validator.isURL(url, validatorOptions)) {
      return { valid: false, error: 'Invalid URL format' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate email
   */
  email: (email) => {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email must be a non-empty string' };
    }
    
    if (!validator.isEmail(email)) {
      return { valid: false, error: 'Invalid email format' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate file type
   */
  fileType: (filename, allowedTypes = []) => {
    if (!filename || typeof filename !== 'string') {
      return { valid: false, error: 'Filename must be a non-empty string' };
    }
    
    if (!allowedTypes.length) {
      return { valid: true };
    }
    
    const extension = filename.toLowerCase().split('.').pop();
    
    if (!allowedTypes.includes(extension)) {
      return { 
        valid: false, 
        error: `File type '${extension}' not allowed. Allowed types: ${allowedTypes.join(', ')}`, 
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate audio file
   */
  audioFile: (filename) => {
    return validators.fileType(filename, ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus', 'webm']);
  },
  
  /**
   * Validate image file
   */
  imageFile: (filename) => {
    return validators.fileType(filename, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
  },
  
  /**
   * Validate UUID
   */
  uuid: (uuid) => {
    if (!uuid || typeof uuid !== 'string') {
      return { valid: false, error: 'UUID must be a non-empty string' };
    }
    
    if (!PATTERNS.UUID.test(uuid)) {
      return { valid: false, error: 'Invalid UUID format' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate correlation ID
   */
  correlationId: (id) => {
    if (!id || typeof id !== 'string') {
      return { valid: false, error: 'Correlation ID must be a non-empty string' };
    }
    
    if (!PATTERNS.CORRELATION_ID.test(id)) {
      return { valid: false, error: 'Invalid correlation ID format' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate IP address
   */
  ip: (ip, version = null) => {
    if (!ip || typeof ip !== 'string') {
      return { valid: false, error: 'IP address must be a non-empty string' };
    }
    
    let isValid = false;
    
    if (version === 4 || !version) {
      isValid = validator.isIP(ip, 4);
    }
    
    if (!isValid && (version === 6 || !version)) {
      isValid = validator.isIP(ip, 6);
    }
    
    if (!isValid) {
      return { valid: false, error: `Invalid IP${version ? `v${version}` : ''} address` };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate JSON string
   */
  json: (jsonString) => {
    if (!jsonString || typeof jsonString !== 'string') {
      return { valid: false, error: 'JSON must be a non-empty string' };
    }
    
    try {
      JSON.parse(jsonString);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Invalid JSON: ${error.message}` };
    }
  },
  
  /**
   * Validate string length
   */
  length: (str, min = 0, max = Infinity) => {
    if (typeof str !== 'string') {
      return { valid: false, error: 'Value must be a string' };
    }
    
    if (str.length < min) {
      return { valid: false, error: `String too short (min: ${min}, actual: ${str.length})` };
    }
    
    if (str.length > max) {
      return { valid: false, error: `String too long (max: ${max}, actual: ${str.length})` };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate number range
   */
  range: (num, min = -Infinity, max = Infinity) => {
    if (typeof num !== 'number' || isNaN(num)) {
      return { valid: false, error: 'Value must be a valid number' };
    }
    
    if (num < min) {
      return { valid: false, error: `Number too small (min: ${min}, actual: ${num})` };
    }
    
    if (num > max) {
      return { valid: false, error: `Number too large (max: ${max}, actual: ${num})` };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate array
   */
  array: (arr, minLength = 0, maxLength = Infinity) => {
    if (!Array.isArray(arr)) {
      return { valid: false, error: 'Value must be an array' };
    }
    
    if (arr.length < minLength) {
      return { 
        valid: false, 
        error: `Array too short (min: ${minLength}, actual: ${arr.length})`, 
      };
    }
    
    if (arr.length > maxLength) {
      return { 
        valid: false, 
        error: `Array too long (max: ${maxLength}, actual: ${arr.length})`, 
      };
    }
    
    return { valid: true };
  },
};

/**
 * Validate multiple fields
 */
function validateFields(data, validations) {
  const errors = [];
  
  for (const [field, validation] of Object.entries(validations)) {
    const value = data[field];
    let result;
    
    if (typeof validation === 'function') {
      result = validation(value);
    } else if (typeof validation === 'object' && validation.validator) {
      result = validation.validator(value, validation.options);
    } else {
      continue;
    }
    
    if (!result.valid) {
      errors.push({
        field,
        message: result.error,
        value,
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create Joi schema from validation rules
 */
function createJoiSchema(rules) {
  const schemaObject = {};
  
  for (const [field, rule] of Object.entries(rules)) {
    if (typeof rule === 'string') {
      // Simple type validation
      schemaObject[field] = Joi[rule]();
    } else if (typeof rule === 'object') {
      // Complex validation rule
      let fieldSchema = Joi[rule.type || 'any']();
      
      if (rule.required) {
        fieldSchema = fieldSchema.required();
      }
      
      if (rule.min !== undefined) {
        fieldSchema = fieldSchema.min(rule.min);
      }
      
      if (rule.max !== undefined) {
        fieldSchema = fieldSchema.max(rule.max);
      }
      
      if (rule.pattern) {
        fieldSchema = fieldSchema.pattern(rule.pattern);
      }
      
      if (rule.valid) {
        fieldSchema = fieldSchema.valid(...rule.valid);
      }
      
      schemaObject[field] = fieldSchema;
    }
  }
  
  return Joi.object(schemaObject);
}

module.exports = {
  validators,
  validateFields,
  createJoiSchema,
  PATTERNS,
};