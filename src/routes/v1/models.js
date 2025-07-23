/**
 * Models routes
 * 
 * OpenAI-compatible models listing endpoint
 */

const express = require('express');
const ModelsController = require('../../controllers/models.controller');
const { asyncCatch } = require('../../middleware/error.middleware');

const router = express.Router();

// List all available models
router.get('/', asyncCatch(ModelsController.listModels));

// Get specific model details
router.get('/:model', asyncCatch(ModelsController.getModel));

module.exports = router;