/**
 * Models routes
 * 
 * OpenAI-compatible models listing endpoint
 */

const express = require('express');
const ModelsController = require('../../controllers/models.controller');
const { asyncCatch } = require('../../middleware/error.middleware');

const router = express.Router();

// List models with optional query filters
// Supported query params: capability, type, provider, realtime, search
router.get('/', asyncCatch(ModelsController.listModels));

// Get models by capability (case-insensitive, includes synonyms like chat, stt, tts, realtime)
router.get('/capability/:capability', asyncCatch(ModelsController.getModelsByCapability));

// Get specific model details
router.get('/:model', asyncCatch(ModelsController.getModel));

module.exports = router;