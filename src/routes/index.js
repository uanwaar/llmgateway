/**
 * Main routes configuration
 * 
 * Responsibilities:
 * - Mount API version routes
 * - Handle route organization
 * - Provide route discovery
 */

const express = require('express');
const v1Routes = require('./v1');

const router = express.Router();

// Mount API version routes
router.use('/v1', v1Routes);

// API discovery endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'LLM Gateway API',
    version: '1.0.0',
    description: 'Unified interface for OpenAI and Google Gemini APIs',
    endpoints: {
      v1: '/v1',
      health: '/health',
      docs: '/docs',
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;