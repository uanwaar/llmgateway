/**
 * Request ID middleware
 * 
 * Adds unique request ID to each request for tracing
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Add unique request ID to each request
 */
function requestIdMiddleware(req, res, next) {
  // Use existing correlation ID or generate new one
  req.id = req.get('x-correlation-id') || req.get('x-request-id') || uuidv4();
  
  // Set response header
  res.set('x-correlation-id', req.id);
  
  next();
}

module.exports = requestIdMiddleware;