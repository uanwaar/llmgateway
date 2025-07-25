/**
 * Health check controller
 * 
 * Monitoring and health check endpoints
 */

const { registry } = require('../providers/base/registry');
const { getMetrics } = require('../middleware/metrics.middleware');
const cacheMiddleware = require('../middleware/cache.middleware');
const config = require('../config');
const logger = require('../utils/logger');
const { version } = require('../../package.json');

class HealthController {
  /**
   * Basic health check
   */
  static async getHealth(req, res) {
    try {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      };
      
      res.json(health);
      
    } catch (error) {
      logger.error('Health check error', {
        requestId: req.id,
        error: error.message,
      });
      
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }
  
  /**
   * Detailed health check with provider status
   */
  static async getDetailedHealth(req, res) {
    try {
      const startTime = Date.now();
      
      // Test provider connectivity
      const providerStatuses = await HealthController._checkProviders();
      
      // System metrics
      const systemMetrics = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        pid: process.pid,
      };
      
      // Application metrics
      const appMetrics = getMetrics();
      
      // Cache metrics
      const cacheStats = cacheMiddleware.getStats();
      const cacheHealth = await cacheMiddleware.healthCheck();
      
      const overallStatus = providerStatuses.every(p => p.status === 'healthy') 
        && cacheHealth.healthy ? 'healthy' : 'degraded';
      
      const detailedHealth = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: Math.floor(process.uptime()),
        response_time_ms: Date.now() - startTime,
        providers: providerStatuses,
        system: systemMetrics,
        metrics: appMetrics,
        cache: {
          health: cacheHealth,
          stats: cacheStats,
        },
        configuration: {
          auth_enabled: config.auth?.requireAuthHeader || false,
          rate_limiting_enabled: config.server?.rateLimitingEnabled || false,
          cors_enabled: config.server?.corsEnabled || false,
          ssl_enabled: config.server?.ssl?.enabled || false,
        },
      };
      
      const statusCode = overallStatus === 'healthy' ? 200 : 503;
      res.status(statusCode).json(detailedHealth);
      
    } catch (error) {
      logger.error('Detailed health check error', {
        requestId: req.id,
        error: error.message,
      });
      
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }
  
  /**
   * Readiness probe (Kubernetes)
   */
  static async getReadiness(req, res) {
    try {
      // Check if providers are ready
      const providerStatuses = await HealthController._checkProviders();
      const allReady = providerStatuses.every(p => p.status === 'healthy');
      
      if (allReady) {
        res.json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          providers: providerStatuses.length,
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          reason: 'One or more providers are unhealthy',
          providers: providerStatuses,
        });
      }
      
    } catch (error) {
      logger.error('Readiness check error', {
        requestId: req.id,
        error: error.message,
      });
      
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }
  
  /**
   * Liveness probe (Kubernetes)
   */
  static async getLiveness(req, res) {
    try {
      // Basic liveness check - if this endpoint responds, the service is alive
      res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
      });
      
    } catch (error) {
      logger.error('Liveness check error', {
        requestId: req.id,
        error: error.message,
      });
      
      res.status(503).json({
        status: 'dead',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }
  
  /**
   * Metrics endpoint
   */
  static async getMetrics(req, res) {
    try {
      const metrics = getMetrics();
      
      // Add system metrics
      const systemMetrics = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        pid: process.pid,
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
      };
      
      // Add cache metrics
      const cacheStats = cacheMiddleware.getStats();
      
      const response = {
        ...metrics,
        system: systemMetrics,
        cache: cacheStats,
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
      
    } catch (error) {
      logger.error('Metrics error', {
        requestId: req.id,
        error: error.message,
      });
      
      res.status(500).json({
        error: {
          message: 'Failed to retrieve metrics',
          type: 'metrics_error',
          code: 'metrics_error',
        },
      });
    }
  }
  
  /**
   * Check provider health status
   */
  static async _checkProviders() {
    const providers = Object.values(registry.getAll());
    const providerStatuses = [];
    
    for (const provider of providers) {
      try {
        const startTime = Date.now();
        
        // Try to check provider health (if supported)
        const status = 'healthy';
        const error = null;
        let responseTime = null;
        
        if (typeof provider.checkHealth === 'function') {
          await provider.checkHealth();
          responseTime = Date.now() - startTime;
        } else {
          // If no health check method, assume healthy if provider exists
          responseTime = Date.now() - startTime;
        }
        
        providerStatuses.push({
          name: provider.name,
          status,
          response_time_ms: responseTime,
          models_count: provider.getAvailableModels?.()?.length || 0,
          last_checked: new Date().toISOString(),
          error,
        });
        
      } catch (providerError) {
        providerStatuses.push({
          name: provider.name,
          status: 'unhealthy',
          response_time_ms: null,
          models_count: 0,
          last_checked: new Date().toISOString(),
          error: providerError.message,
        });
      }
    }
    
    return providerStatuses;
  }
}

module.exports = HealthController;