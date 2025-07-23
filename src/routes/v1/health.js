/**
 * Health check routes
 * 
 * Monitoring and health check endpoints
 */

const express = require('express');
const HealthController = require('../../controllers/health.controller');
const { asyncCatch } = require('../../middleware/error.middleware');

const router = express.Router();

// Basic health check
router.get('/', asyncCatch(HealthController.getHealth));

// Detailed health check with provider status
router.get('/detailed', asyncCatch(HealthController.getDetailedHealth));

// Readiness probe (for K8s)
router.get('/ready', asyncCatch(HealthController.getReadiness));

// Liveness probe (for K8s)
router.get('/live', asyncCatch(HealthController.getLiveness));

// Metrics endpoint
router.get('/metrics', asyncCatch(HealthController.getMetrics));

module.exports = router;