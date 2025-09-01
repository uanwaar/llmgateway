/**
 * Custom error classes for the LLM Gateway
 * 
 * This module defines standardized error types that provide:
 * - Consistent error structure and codes
 * - HTTP status code mapping
 * - Detailed error information for debugging
 * - Provider-specific error handling
 */

/**
 * Base error class for all gateway errors
 */
class GatewayError extends Error {
  constructor(message, statusCode = 500, errorCode = 'GATEWAY_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.errorCode,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp,
        ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
      },
    };
  }
}

/**
 * Validation error for invalid requests
 */
class ValidationError extends GatewayError {
  constructor(message, field = null, value = null, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', {
      field,
      value,
      ...details,
    });
  }
}

/**
 * Authentication error for invalid credentials
 */
class AuthenticationError extends GatewayError {
  constructor(message = 'Authentication failed', details = {}) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Authorization error for insufficient permissions
 */
class AuthorizationError extends GatewayError {
  constructor(message = 'Insufficient permissions', details = {}) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * Resource not found error
 */
class NotFoundError extends GatewayError {
  constructor(resource = 'Resource', id = null, details = {}) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND_ERROR', {
      resource,
      id,
      ...details,
    });
  }
}

/**
 * Rate limiting error
 */
class RateLimitError extends GatewayError {
  constructor(limit, windowMs, retryAfter = null, details = {}) {
    super(`Rate limit exceeded: ${limit} requests per ${windowMs}ms`, 429, 'RATE_LIMIT_ERROR', {
      limit,
      windowMs,
      retryAfter,
      ...details,
    });
    
    this.retryAfter = retryAfter;
  }
}

/**
 * Configuration error
 */
class ConfigurationError extends GatewayError {
  constructor(message, configKey = null, details = {}) {
    super(message, 500, 'CONFIGURATION_ERROR', {
      configKey,
      ...details,
    });
  }
}

/**
 * Provider error for external API issues
 */
class ProviderError extends GatewayError {
  constructor(provider, message, originalError = null, statusCode = 502, details = {}) {
    super(`Provider '${provider}' error: ${message}`, statusCode, 'PROVIDER_ERROR', {
      provider,
      originalError: originalError ? {
        message: originalError.message,
        code: originalError.code,
        status: originalError.status,
      } : null,
      ...details,
    });
    
    this.provider = provider;
    this.originalError = originalError;
  }
}

/**
 * Network error for transport-level failures
 */
class NetworkError extends ProviderError {
  constructor(message = 'Network error', errorCode = 'NETWORK_ERROR', provider = 'unknown', details = {}) {
    super(provider, message, null, 502, { ...details });
    this.errorCode = errorCode;
  }
}

/**
 * Provider timeout error
 */
class ProviderTimeoutError extends ProviderError {
  constructor(provider, timeout, details = {}) {
    super(
      provider,
      `Request timeout after ${timeout}ms`,
      null,
      504,
      { timeout, ...details },
    );
    this.errorCode = 'PROVIDER_TIMEOUT_ERROR';
  }
}

/**
 * Provider rate limit error
 */
class ProviderRateLimitError extends ProviderError {
  constructor(provider, retryAfter = null, details = {}) {
    super(
      provider,
      'Provider rate limit exceeded',
      null,
      429,
      { retryAfter, ...details },
    );
    this.errorCode = 'PROVIDER_RATE_LIMIT_ERROR';
    this.retryAfter = retryAfter;
  }
}

/**
 * Provider authentication error
 */
class ProviderAuthError extends ProviderError {
  constructor(provider, details = {}) {
    super(
      provider,
      'Provider authentication failed',
      null,
      401,
      details,
    );
    this.errorCode = 'PROVIDER_AUTH_ERROR';
  }
}

/**
 * Model not found error
 */
class ModelNotFoundError extends GatewayError {
  constructor(model, provider = null, details = {}) {
    const message = provider 
      ? `Model '${model}' not found for provider '${provider}'`
      : `Model '${model}' not found`;
    
    super(message, 404, 'MODEL_NOT_FOUND_ERROR', {
      model,
      provider,
      ...details,
    });
  }
}

/**
 * Cache error
 */
class CacheError extends GatewayError {
  constructor(operation, message, details = {}) {
    super(`Cache ${operation} error: ${message}`, 500, 'CACHE_ERROR', {
      operation,
      ...details,
    });
  }
}

/**
 * Service unavailable error
 */
class ServiceUnavailableError extends GatewayError {
  constructor(service = 'Service', retryAfter = null, details = {}) {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE_ERROR', {
      service,
      retryAfter,
      ...details,
    });
    
    this.retryAfter = retryAfter;
  }
}

/**
 * Request timeout error
 */
class RequestTimeoutError extends GatewayError {
  constructor(timeout, details = {}) {
    super(`Request timeout after ${timeout}ms`, 408, 'REQUEST_TIMEOUT_ERROR', {
      timeout,
      ...details,
    });
  }
}

/**
 * Payload too large error
 */
class PayloadTooLargeError extends GatewayError {
  constructor(maxSize, actualSize = null, details = {}) {
    super(`Payload too large. Maximum size: ${maxSize}`, 413, 'PAYLOAD_TOO_LARGE_ERROR', {
      maxSize,
      actualSize,
      ...details,
    });
  }
}

/**
 * Circuit breaker error
 */
class CircuitBreakerError extends GatewayError {
  constructor(provider, details = {}) {
    super(
      `Circuit breaker is open for provider '${provider}'`, 
      503, 
      'CIRCUIT_BREAKER_ERROR', 
      { provider, ...details },
    );
  }
}

/**
 * Utility function to check if error is a gateway error
 */
function isGatewayError(error) {
  return error instanceof GatewayError;
}

/**
 * Utility function to convert any error to a gateway error
 */
function toGatewayError(error, defaultMessage = 'Internal server error') {
  if (isGatewayError(error)) {
    return error;
  }

  // Handle common Node.js errors
  if (error.code === 'ECONNREFUSED') {
    return new ServiceUnavailableError('External service', null, { originalError: error.message });
  }

  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    return new RequestTimeoutError(30000, { originalError: error.message });
  }

  if (error.name === 'ValidationError') {
    return new ValidationError(error.message, null, null, { originalError: error.message });
  }

  // Default to generic gateway error
  return new GatewayError(
    error.message || defaultMessage,
    500,
    'INTERNAL_ERROR',
    { originalError: error.message, stack: error.stack },
  );
}

/**
 * Create error from HTTP response
 */
function createErrorFromResponse(provider, response, originalError = null) {
  const status = response?.status || 500;
  const data = response?.data || {};
  
  switch (status) {
  case 400:
    return new ValidationError(
      data.message || 'Invalid request',
      null,
      null,
      { provider, response: data },
    );
    
  case 401:
    return new ProviderAuthError(provider, { response: data });
    
  case 403:
    return new AuthorizationError(
      data.message || 'Access denied',
      { provider, response: data },
    );
    
  case 404:
    return new NotFoundError('Resource', null, { provider, response: data });
    
  case 429: {
    const retryAfter = response.headers?.['retry-after'];
    return new ProviderRateLimitError(provider, retryAfter, { response: data });
  }
    
  case 500:
  case 502:
  case 503:
  case 504:
    return new ProviderError(
      provider,
      data.message || 'External service error',
      originalError,
      status,
      { response: data },
    );
    
  default:
    return new ProviderError(
      provider,
      data.message || 'Unknown provider error',
      originalError,
      status,
      { response: data },
    );
  }
}

/**
 * Error codes for programmatic handling
 */
const ERROR_CODES = {
  GATEWAY_ERROR: 'GATEWAY_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  PROVIDER_TIMEOUT_ERROR: 'PROVIDER_TIMEOUT_ERROR',
  PROVIDER_RATE_LIMIT_ERROR: 'PROVIDER_RATE_LIMIT_ERROR',
  PROVIDER_AUTH_ERROR: 'PROVIDER_AUTH_ERROR',
  MODEL_NOT_FOUND_ERROR: 'MODEL_NOT_FOUND_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  SERVICE_UNAVAILABLE_ERROR: 'SERVICE_UNAVAILABLE_ERROR',
  REQUEST_TIMEOUT_ERROR: 'REQUEST_TIMEOUT_ERROR',
  PAYLOAD_TOO_LARGE_ERROR: 'PAYLOAD_TOO_LARGE_ERROR',
  CIRCUIT_BREAKER_ERROR: 'CIRCUIT_BREAKER_ERROR',
};

module.exports = {
  // Base classes
  GatewayError,
  
  // Specific error types
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ConfigurationError,
  ProviderError,
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderAuthError,
  NetworkError,
  ModelNotFoundError,
  CacheError,
  ServiceUnavailableError,
  RequestTimeoutError,
  PayloadTooLargeError,
  CircuitBreakerError,
  
  // Utility functions
  isGatewayError,
  toGatewayError,
  createErrorFromResponse,
  
  // Constants
  ERROR_CODES,
};