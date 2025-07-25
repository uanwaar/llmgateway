/**
 * Chat completions routes
 * 
 * OpenAI-compatible chat completions endpoint
 * Supports streaming and non-streaming responses
 */

const express = require('express');
const ChatController = require('../../controllers/chat.controller');
const validationMiddleware = require('../../middleware/validation.middleware');
const rateLimitMiddleware = require('../../middleware/rateLimit.middleware');
const { asyncCatch } = require('../../middleware/error.middleware');

const router = express.Router();

// Chat completions endpoint with validation and rate limiting
router.post('/completions',
  rateLimitMiddleware.chat,
  validationMiddleware(validationMiddleware.schemas.chatCompletion, {
    allowUnknown: true,    // Allow unknown properties
    stripUnknown: false,   // Don't strip unknown properties
    validateSize: false,   // Skip size validation for flexibility
    validateContentType: false, // Skip content type validation
    sanitization: {
      html: false,         // Don't sanitize HTML in chat content
      sql: false,          // Don't sanitize SQL in chat content  
      xss: false,          // Don't sanitize XSS in chat content
      trim: false,         // Don't trim content
    },
  }),
  asyncCatch(ChatController.createCompletion),
);

module.exports = router;