/**
 * Embeddings routes
 * 
 * OpenAI-compatible embeddings endpoint
 */

const express = require('express');
const EmbeddingsController = require('../../controllers/embeddings.controller');
const validationMiddleware = require('../../middleware/validation.middleware');
const { asyncCatch } = require('../../middleware/error.middleware');

const router = express.Router();

// Embeddings endpoint with validation
router.post('/', 
  validationMiddleware(validationMiddleware.schemas.embeddings),
  asyncCatch(EmbeddingsController.createEmbeddings),
);

module.exports = router;