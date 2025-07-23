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
  validationMiddleware(validationMiddleware.schemas.chatCompletion),
  asyncCatch(ChatController.createCompletion),
);

module.exports = router;