/**
 * API v1 routes configuration
 * 
 * Responsibilities:
 * - OpenAI-compatible endpoints
 * - Provider routing
 * - Request validation
 */

const express = require('express');
const chatRoutes = require('./chat');
const embeddingsRoutes = require('./embeddings');
const modelsRoutes = require('./models');
const audioRoutes = require('./audio');
const healthRoutes = require('./health');

const router = express.Router();

// Mount endpoint routes
router.use('/chat', chatRoutes);
router.use('/embeddings', embeddingsRoutes);
router.use('/models', modelsRoutes);
router.use('/audio', audioRoutes);
router.use('/health', healthRoutes);

// API v1 info endpoint
router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: {
      chat: '/v1/chat',
      embeddings: '/v1/embeddings',
      models: '/v1/models',
      audio: '/v1/audio',
      health: '/v1/health',
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;