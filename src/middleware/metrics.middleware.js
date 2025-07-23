/**
 * Metrics middleware
 * 
 * Request metrics collection for monitoring
 */

const logger = require('../utils/logger');

// In-memory metrics store (in production, use Redis or similar)
const metrics = {
  requests: {
    total: 0,
    success: 0,
    error: 0,
    byStatus: {},
    byEndpoint: {},
    byProvider: {},
  },
  response_times: [],
  active_requests: 0,
};

/**
 * Metrics collection middleware
 */
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Increment active requests
  metrics.active_requests++;
  metrics.requests.total++;
  
  // Track by endpoint
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;
  
  // Log response metrics when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Update metrics
    metrics.active_requests--;
    metrics.response_times.push(duration);
    
    // Keep only last 1000 response times
    if (metrics.response_times.length > 1000) {
      metrics.response_times = metrics.response_times.slice(-1000);
    }
    
    // Track by status code
    metrics.requests.byStatus[statusCode] = (metrics.requests.byStatus[statusCode] || 0) + 1;
    
    // Track success/error
    if (statusCode >= 200 && statusCode < 400) {
      metrics.requests.success++;
    } else {
      metrics.requests.error++;
    }
    
    // Track by provider if available
    if (req.provider) {
      metrics.requests.byProvider[req.provider] = (metrics.requests.byProvider[req.provider] || 0) + 1;
    }
    
    // Log performance metrics for slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        requestId: req.id,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        provider: req.provider,
      });
    }
  });
  
  next();
}

/**
 * Get current metrics
 */
function getMetrics() {
  const responseTimesArray = metrics.response_times;
  const avgResponseTime = responseTimesArray.length > 0 
    ? responseTimesArray.reduce((a, b) => a + b, 0) / responseTimesArray.length 
    : 0;
  
  return {
    ...metrics,
    statistics: {
      average_response_time: Math.round(avgResponseTime),
      min_response_time: responseTimesArray.length > 0 ? Math.min(...responseTimesArray) : 0,
      max_response_time: responseTimesArray.length > 0 ? Math.max(...responseTimesArray) : 0,
      success_rate: metrics.requests.total > 0 
        ? Math.round((metrics.requests.success / metrics.requests.total) * 100) 
        : 0,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reset metrics
 */
function resetMetrics() {
  metrics.requests = {
    total: 0,
    success: 0,
    error: 0,
    byStatus: {},
    byEndpoint: {},
    byProvider: {},
  };
  metrics.response_times = [];
  // Don't reset active_requests as it's a live counter
}

module.exports = metricsMiddleware;
module.exports.getMetrics = getMetrics;
module.exports.resetMetrics = resetMetrics;