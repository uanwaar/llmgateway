/**
 * Request validation middleware
 * 
 * Joi-based request validation
 */

const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

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
      
      // Update request with validated/sanitized values
      if (value.body) req.body = value.body;
      if (value.params) req.params = value.params;
      if (value.query) req.query = value.query;
      
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
  // Chat completion request schema
  chatCompletion: {
    body: Joi.object({
      model: Joi.string().required().description('Model to use for completion'),
      messages: Joi.array().items(
        Joi.object({
          role: Joi.string().valid('system', 'user', 'assistant', 'function', 'tool').required(),
          content: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(
              Joi.object({
                type: Joi.string().valid('text', 'image_url').required(),
                text: Joi.string().when('type', { is: 'text', then: Joi.required() }),
                image_url: Joi.object({
                  url: Joi.string().uri().required(),
                  detail: Joi.string().valid('low', 'high', 'auto').default('auto'),
                }).when('type', { is: 'image_url', then: Joi.required() }),
              }),
            ),
          ).required(),
          name: Joi.string().optional(),
          function_call: Joi.object().optional(),
          tool_calls: Joi.array().optional(),
          tool_call_id: Joi.string().optional(),
        }),
      ).min(1).required(),
      temperature: Joi.number().min(0).max(2).default(1),
      top_p: Joi.number().min(0).max(1).default(1),
      n: Joi.number().integer().min(1).max(10).default(1),
      stream: Joi.boolean().default(false),
      stop: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string()).max(4)),
      max_tokens: Joi.number().integer().min(1).max(8192),
      presence_penalty: Joi.number().min(-2).max(2).default(0),
      frequency_penalty: Joi.number().min(-2).max(2).default(0),
      logit_bias: Joi.object().pattern(Joi.string(), Joi.number().min(-100).max(100)),
      user: Joi.string().optional(),
      response_format: Joi.object({
        type: Joi.string().valid('text', 'json_object').default('text'),
      }),
      seed: Joi.number().integer(),
      tools: Joi.array().items(
        Joi.object({
          type: Joi.string().valid('function').required(),
          function: Joi.object({
            name: Joi.string().required(),
            description: Joi.string(),
            parameters: Joi.object(),
          }).required(),
        }),
      ),
      tool_choice: Joi.alternatives().try(
        Joi.string().valid('none', 'auto'),
        Joi.object({
          type: Joi.string().valid('function').required(),
          function: Joi.object({
            name: Joi.string().required(),
          }).required(),
        }),
      ),
    }),
  },
  
  // Embeddings request schema
  embeddings: {
    body: Joi.object({
      input: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string()),
        Joi.array().items(Joi.number().integer()),
        Joi.array().items(Joi.array().items(Joi.number().integer())),
      ).required(),
      model: Joi.string().required(),
      encoding_format: Joi.string().valid('float', 'base64').default('float'),
      dimensions: Joi.number().integer().min(1),
      user: Joi.string().optional(),
    }),
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
};

module.exports = createValidationMiddleware;
module.exports.schemas = schemas;