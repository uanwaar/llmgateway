/**
 * Application-wide constants
 * 
 * This module contains all constant values used throughout the application
 * including HTTP status codes, error messages, timeouts, and configuration defaults.
 */

/**
 * HTTP Status Codes
 */
const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,
  
  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  IM_A_TEAPOT: 418,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NETWORK_AUTHENTICATION_REQUIRED: 511,
};

/**
 * Default timeout values (in milliseconds)
 */
const TIMEOUTS = {
  REQUEST: 30000,          // 30 seconds
  PROVIDER: 30000,         // 30 seconds
  HEALTH_CHECK: 5000,      // 5 seconds
  CACHE: 3600000,          // 1 hour
  CIRCUIT_BREAKER: 60000,  // 1 minute
  RETRY_DELAY: 1000,       // 1 second
  GRACEFUL_SHUTDOWN: 30000, // 30 seconds
};

/**
 * Rate limiting constants
 */
const RATE_LIMITS = {
  WINDOW_MS: 900000,       // 15 minutes
  MAX_REQUESTS: 100,       // per window
  BURST_LIMIT: 10,         // immediate burst allowance
  SLOW_DOWN_DELAY: 1000,    // delay after rate limit hit
};

/**
 * Cache configuration
 */
const CACHE = {
  DEFAULT_TTL: 3600,       // 1 hour in seconds
  MAX_SIZE: 1000,          // maximum number of items
  KEY_PREFIX: 'llm_gateway:',
  COMPRESSION_THRESHOLD: 1024, // bytes
};

/**
 * Provider constants
 */
const PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  BACKOFF_MULTIPLIER: 2,
  
  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_TIMEOUT: 60000,
};

/**
 * Model types
 */
const MODEL_TYPES = {
  CHAT: 'chat',
  EMBEDDING: 'embedding',
  IMAGE: 'image',
  AUDIO: 'audio',
  MULTIMODAL: 'multimodal',
};

/**
 * Routing strategies
 */
const ROUTING_STRATEGIES = {
  ROUND_ROBIN: 'round_robin',
  PERFORMANCE: 'performance',
  COST_OPTIMIZED: 'cost_optimized',
  HEALTH_BASED: 'health_based',
  WEIGHTED: 'weighted',
};

/**
 * Authentication modes
 */
const AUTH_MODES = {
  GATEWAY: 'gateway',      // Use gateway API keys only
  CLIENT: 'client',        // Use client-provided API keys only
  HYBRID: 'hybrid',         // Support both gateway and client keys
};

/**
 * Log levels
 */
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  VERBOSE: 'verbose',
  SILLY: 'silly',
};

/**
 * Content types
 */
const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  TEXT: 'text/plain',
  HTML: 'text/html',
  STREAM: 'text/event-stream',
};

/**
 * Request headers
 */
const HEADERS = {
  AUTHORIZATION: 'Authorization',
  API_KEY: 'X-API-Key',
  CORRELATION_ID: 'X-Correlation-ID',
  CONTENT_TYPE: 'Content-Type',
  USER_AGENT: 'User-Agent',
  FORWARDED_FOR: 'X-Forwarded-For',
  RATE_LIMIT_REMAINING: 'X-RateLimit-Remaining',
  RATE_LIMIT_RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
};

/**
 * Events for internal messaging
 */
const EVENTS = {
  REQUEST_START: 'request:start',
  REQUEST_END: 'request:end',
  PROVIDER_REQUEST: 'provider:request',
  PROVIDER_RESPONSE: 'provider:response',
  PROVIDER_ERROR: 'provider:error',
  CACHE_HIT: 'cache:hit',
  CACHE_MISS: 'cache:miss',
  RATE_LIMIT_HIT: 'rateLimit:hit',
  HEALTH_CHECK: 'health:check',
  CIRCUIT_BREAKER_OPEN: 'circuitBreaker:open',
  CIRCUIT_BREAKER_CLOSE: 'circuitBreaker:close',
};

/**
 * Validation constants
 */
const VALIDATION = {
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_PROMPT_LENGTH: 100000,          // characters
  MAX_COMPLETION_TOKENS: 4096,
  MIN_API_KEY_LENGTH: 32,
  MAX_API_KEY_LENGTH: 128,
  
  // Regex patterns
  API_KEY_PATTERN: /^[a-zA-Z0-9\-_]+$/,
  MODEL_NAME_PATTERN: /^[a-zA-Z0-9\-_.]+$/,
  CORRELATION_ID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
};

/**
 * Error messages
 */
const ERROR_MESSAGES = {
  INVALID_API_KEY: 'Invalid or missing API key',
  INVALID_MODEL: 'Invalid or unsupported model',
  INVALID_REQUEST: 'Invalid request format',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  PROVIDER_UNAVAILABLE: 'Provider is currently unavailable',
  REQUEST_TIMEOUT: 'Request timeout',
  INTERNAL_ERROR: 'Internal server error',
  CONFIGURATION_ERROR: 'Configuration error',
  VALIDATION_ERROR: 'Request validation failed',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
};

/**
 * Success messages
 */
const SUCCESS_MESSAGES = {
  REQUEST_PROCESSED: 'Request processed successfully',
  HEALTH_CHECK_PASSED: 'Health check passed',
  CACHE_CLEARED: 'Cache cleared successfully',
  CONFIGURATION_UPDATED: 'Configuration updated successfully',
};

/**
 * Default configuration values
 */
const DEFAULTS = {
  PORT: 8080,
  HOST: '0.0.0.0',
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
  CACHE_BACKEND: 'memory',
  ROUTING_STRATEGY: 'cost_optimized',
  AUTH_MODE: 'hybrid',
  MAX_CONCURRENT_REQUESTS: 100,
  HEALTH_CHECK_INTERVAL: 30000,
};

/**
 * Metrics constants
 */
const METRICS = {
  REQUEST_DURATION: 'gateway_request_duration_seconds',
  REQUEST_COUNT: 'gateway_requests_total',
  PROVIDER_REQUEST_DURATION: 'provider_request_duration_seconds',
  PROVIDER_REQUEST_COUNT: 'provider_requests_total',
  CACHE_OPERATIONS: 'cache_operations_total',
  RATE_LIMIT_HITS: 'rate_limit_hits_total',
  ERROR_COUNT: 'errors_total',
  ACTIVE_CONNECTIONS: 'active_connections',
  CIRCUIT_BREAKER_STATE: 'circuit_breaker_state',
};

/**
 * Environment names
 */
const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
  STAGING: 'staging',
};

module.exports = {
  HTTP_STATUS,
  TIMEOUTS,
  RATE_LIMITS,
  CACHE,
  PROVIDERS,
  MODEL_TYPES,
  ROUTING_STRATEGIES,
  AUTH_MODES,
  LOG_LEVELS,
  CONTENT_TYPES,
  HEADERS,
  EVENTS,
  VALIDATION,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  DEFAULTS,
  METRICS,
  ENVIRONMENTS,
};