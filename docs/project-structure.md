# LLM Gateway - Project Structure

## Overview

This document provides a comprehensive overview of the LLM Gateway project structure, including detailed descriptions of core application files and their purposes.

## Complete Project Structure

```
llm-gateway/
├── README.md                           # Project overview and quick start
├── LICENSE                             # MIT/Apache open source license
├── package.json                        # Node.js dependencies and scripts
├── package-lock.json                   # Locked dependency versions
├── .gitignore                          # Git ignore rules
├── .env.example                        # Environment variable template
├── .dockerignore                       # Docker ignore rules
├── Dockerfile                          # Container build instructions
├── docker-compose.yml                  # Multi-container orchestration
├── docker-compose.dev.yml              # Development environment setup
│
├── docs/                               # Documentation files
│   ├── architecture.md                 # System architecture overview
│   ├── installation.md                 # Installation instructions
│   ├── deployment.md                   # Deployment strategies
│   ├── contributing.md                 # Contribution guidelines
│   ├── project-structure.md            # This file
│   ├── LLM_Gateway_PRD.md             # Product requirements document
│   ├── OpenAI_API_Documentation.md    # OpenAI API integration guide
│   └── Google_Gemini_API_Documentation.md # Gemini API integration guide
│
├── src/                                # Source code directory
│   ├── index.js                        # Application entry point
│   ├── app.js                          # Express application setup
│   ├── server.js                       # HTTP server configuration
│   │
│   ├── config/                         # Configuration management
│   │   ├── index.js                    # Configuration loader
│   │   ├── database.js                 # Database configuration
│   │   ├── providers.js                # Provider settings
│   │   ├── cache.js                    # Cache configuration
│   │   └── security.js                 # Security settings
│   │
│   ├── controllers/                    # Request handlers
│   │   ├── chat.controller.js          # Chat completions endpoint
│   │   ├── embeddings.controller.js    # Embeddings endpoint
│   │   ├── audio.controller.js         # Audio transcription and TTS endpoint
│   │   ├── health.controller.js        # Health check endpoints
│   │   ├── config.controller.js        # Configuration endpoints
│   │   └── metrics.controller.js       # Metrics and monitoring
│   │
│   ├── services/                       # Business logic layer
│   │   ├── gateway.service.js          # Main gateway orchestration
│   │   ├── router.service.js           # Request routing logic
│   │   ├── cache.service.js            # Caching implementation
│   │   ├── metrics.service.js          # Metrics collection
│   │   ├── auth.service.js             # Authentication handling
│   │   └── validation.service.js       # Request validation
│   │
│   ├── providers/                      # Provider-specific adapters
│   │   ├── base/                       # Base provider interface
│   │   │   ├── provider.interface.js   # Provider contract definition
│   │   │   ├── adapter.base.js         # Base adapter implementation
│   │   │   ├── registry.js             # Provider registry and management
│   │   │   └── response.transformer.js # Response transformation utilities
│   │   │
│   │   ├── openai/                     # OpenAI provider implementation
│   │   │   ├── openai.adapter.js       # OpenAI API adapter
│   │   │   ├── openai.transformer.js   # Request/response transformation
│   │   │   ├── openai.models.js        # Model definitions and mappings
│   │   │   ├── openai.audio.js         # Whisper and TTS integration
│   │   │   └── openai.client.js        # HTTP client for OpenAI API
│   │   │
│   │   └── gemini/                     # Google Gemini provider
│   │       ├── gemini.adapter.js       # Gemini API adapter
│   │       ├── gemini.transformer.js   # Request/response transformation
│   │       ├── gemini.models.js        # Model definitions and mappings
│   │       ├── gemini.audio.js         # Speech-to-Text integration
│   │       └── gemini.client.js        # HTTP client for Gemini API
│   │
│   ├── middleware/                     # Express middleware
│   │   ├── auth.middleware.js          # Authentication middleware
│   │   ├── validation.middleware.js    # Request validation
│   │   ├── cors.middleware.js          # CORS handling
│   │   ├── ratelimit.middleware.js     # Rate limiting
│   │   ├── logging.middleware.js       # Request logging
│   │   ├── error.middleware.js         # Error handling
│   │   └── metrics.middleware.js       # Metrics collection
│   │
│   ├── routes/                         # API route definitions
│   │   ├── index.js                    # Route aggregator
│   │   ├── v1/                         # API version 1
│   │   │   ├── index.js                # V1 route aggregator
│   │   │   ├── chat.routes.js          # Chat completions routes
│   │   │   ├── embeddings.routes.js    # Embeddings routes
│   │   │   ├── audio.routes.js         # Audio transcription and TTS routes
│   │   │   ├── models.routes.js        # Model listing routes
│   │   │   └── streaming.routes.js     # Streaming endpoints
│   │   │
│   │   ├── health.routes.js            # Health check routes
│   │   ├── metrics.routes.js           # Metrics endpoints
│   │   └── admin.routes.js             # Administrative endpoints
│   │
│   ├── utils/                          # Utility functions
│   │   ├── logger.js                   # Logging utility
│   │   ├── errors.js                   # Custom error classes
│   │   ├── constants.js                # Application constants
│   │   ├── helpers.js                  # General helper functions
│   │   ├── validator.js                # Validation utilities
│   │   └── crypto.js                   # Cryptographic utilities
│   │
│   └── types/                          # TypeScript type definitions
│       ├── index.d.ts                  # Main type exports
│       ├── providers.d.ts              # Provider interface types
│       ├── requests.d.ts               # Request/response types
│       ├── config.d.ts                 # Configuration types
│       └── errors.d.ts                 # Error types
│
├── tests/                              # Test suites
│   ├── unit/                           # Unit tests
│   │   ├── services/                   # Service layer tests
│   │   ├── providers/                  # Provider adapter tests
│   │   ├── middleware/                 # Middleware tests
│   │   └── utils/                      # Utility function tests
│   │
│   ├── integration/                    # Integration tests
│   │   ├── api/                        # API endpoint tests
│   │   ├── providers/                  # Provider integration tests
│   │   └── cache/                      # Cache integration tests
│   │
│   ├── e2e/                           # End-to-end tests
│   │   ├── scenarios/                  # Test scenarios
│   │   └── fixtures/                   # Test data
│   │
│   ├── mocks/                          # Mock implementations
│   │   ├── providers.mock.js           # Provider mocks
│   │   ├── cache.mock.js               # Cache mocks
│   │   └── http.mock.js                # HTTP client mocks
│   │
│   └── fixtures/                       # Test data and fixtures
│       ├── requests/                   # Sample request data
│       ├── responses/                  # Sample response data
│       └── configs/                    # Test configurations
│
├── config/                             # Configuration files
│   ├── default.yaml                    # Default configuration
│   ├── development.yaml                # Development environment
│   ├── production.yaml                 # Production environment
│   ├── test.yaml                       # Test environment
│   └── docker.yaml                     # Docker configuration
│
├── scripts/                            # Build and utility scripts
│   ├── build.js                        # Build script
│   ├── start.js                        # Start script
│   ├── test.js                         # Test runner
│   ├── docker-build.sh                 # Docker build script
│   ├── deploy.sh                       # Deployment script
│   └── migrate.js                      # Database migration
│
├── docker/                             # Docker configurations
│   ├── Dockerfile.dev                  # Development Dockerfile
│   ├── Dockerfile.prod                 # Production Dockerfile
│   ├── nginx.conf                      # Nginx configuration
│   └── docker-compose.override.yml     # Local overrides
│
├── k8s/                                # Kubernetes manifests
│   ├── namespace.yaml                  # Namespace definition
│   ├── deployment.yaml                 # Application deployment
│   ├── service.yaml                    # Service definition
│   ├── configmap.yaml                  # Configuration map
│   ├── secret.yaml                     # Secrets template
│   ├── ingress.yaml                    # Ingress configuration
│   └── hpa.yaml                        # Horizontal Pod Autoscaler
│
├── examples/                           # Usage examples
│   ├── javascript/                     # JavaScript examples
│   │   ├── basic-usage.js              # Basic API usage
│   │   ├── streaming.js                # Streaming responses
│   │   ├── audio-transcription.js      # Audio transcription examples
│   │   └── error-handling.js           # Error handling patterns
│   │
│   ├── python/                         # Python examples
│   │   ├── basic_usage.py              # Basic API usage
│   │   ├── async_usage.py              # Asyncio examples
│   │   └── client_keys.py              # Client-side API keys
│   │
│   ├── curl/                           # cURL examples
│   │   ├── chat_completion.sh          # Chat completions
│   │   ├── streaming.sh                # Streaming requests
│   │   ├── audio_transcription.sh      # Audio transcription requests
│   │   ├── text_to_speech.sh           # Text-to-speech requests
│   │   └── embeddings.sh               # Embeddings requests
│   │
│   └── docker/                         # Docker usage examples
│       ├── basic-setup/                # Basic Docker setup
│       └── advanced-config/            # Advanced configuration
│
├── logs/                               # Log files (gitignored)
│   ├── app.log                         # Application logs
│   ├── error.log                       # Error logs
│   └── access.log                      # Access logs
│
└── .github/                            # GitHub specific files
    ├── workflows/                      # GitHub Actions
    │   ├── ci.yml                      # Continuous integration
    │   ├── cd.yml                      # Continuous deployment
    │   ├── security.yml                # Security scanning
    │   └── release.yml                 # Release automation
    │
    ├── ISSUE_TEMPLATE/                 # Issue templates
    │   ├── bug_report.md               # Bug report template
    │   ├── feature_request.md          # Feature request template
    │   └── question.md                 # Question template
    │
    ├── PULL_REQUEST_TEMPLATE.md        # PR template
    ├── CODEOWNERS                      # Code ownership
    └── SECURITY.md                     # Security policy
```

## Core Application Files

### Entry Points

#### `src/index.js`
```javascript
// Application bootstrap and initialization
// Responsibilities:
// - Environment setup and validation
// - Configuration loading
// - Gateway service initialization
// - Provider registration and health monitoring startup
// - Graceful shutdown handling
// - Process signal handling
```

#### `src/app.js`
```javascript
// Express application configuration
// Responsibilities:
// - Middleware registration
// - Route mounting
// - Error handling setup
// - Security headers configuration
```

#### `src/server.js`
```javascript
// HTTP server setup and management
// Responsibilities:
// - Server startup and shutdown
// - Port binding and listening
// - SSL/TLS configuration
// - Health check endpoints
```

### Configuration Management

#### `src/config/index.js`
```javascript
// Central configuration management
// Features:
// - Environment-based config loading
// - Configuration validation
// - Dynamic config updates
// - Secret management integration
```

#### `src/config/providers.js`
```javascript
// Provider-specific configurations
// Contains:
// - API endpoints and credentials
// - Model mappings and capabilities
// - Timeout and retry settings
// - Cost per token configurations
```

### Core Services

#### `src/services/gateway.service.js`
```javascript
// Main gateway orchestration service (650+ lines)
// Responsibilities:
// - Provider initialization and direct management via internal Maps
// - Model-to-provider mapping for fast lookups
// - Request routing and delegation to providers
// - Provider failover handling with circuit breakers
// - Response aggregation and formatting
// - Cross-cutting concerns coordination
// - Health status management with registry callbacks
// - Exponential backoff retry mechanisms
// Features:
// - createChatCompletion() - Chat completion orchestration
// - createEmbeddings() - Embeddings request processing  
// - createTranscription() - Audio transcription handling
// - executeWithFailover() - Automatic failover support
// - getAvailableModels() - Model discovery from providers
// - getModelInfo() - Model metadata retrieval
// - getProviderForModel() - Direct provider lookup
// - Circuit breaker pattern implementation
// Internal Maps:
// - providers Map - Direct provider storage
// - modelToProvider Map - Fast model-to-provider mapping
// - providerHealthStatus Map - Health status tracking
```

#### `src/services/router.service.js`
```javascript
// Intelligent request routing logic (426 lines)
// Features:
// - 5 routing strategies: cost_optimized, performance, round_robin, health_based, weighted
// - Provider selection algorithms with sophisticated criteria
// - Load balancing strategies with health monitoring
// - Cost optimization routing based on token pricing
// - Performance-based routing with response time metrics
// - Health-based routing with provider status monitoring
```

#### `src/services/cache.service.js`
```javascript
// Response caching implementation
// Features:
// - TTL-based cache management
// - Cache key generation strategies
// - Cache invalidation policies
// - Memory and Redis backends
```

### Provider Management

#### `src/providers/base/registry.js`
```javascript
// Provider registry focused on health monitoring (480+ lines)
// REFACTORED: No longer involved in API request flows
// Core functionality:
// - Provider registration for health monitoring only
// - Health monitoring with 30-second interval checks
// - Health status callbacks to Gateway Service
// - Provider lifecycle management for cleanup
// Key methods:
// - register() - Register providers for health monitoring
// - performHealthChecks() - Monitor provider health
// - setHealthStatusCallback() - Set callback for health updates
// - getRegistryStatus() - Health status reporting
// Removed methods (moved to Gateway Service):
// - getProviderForModel() - Now in Gateway Service
// - getEligibleProviders() - Logic moved to Gateway Service  
// - getAvailableModels() - Now in Gateway Service
// - getModelInfo() - Now in Gateway Service
```

#### `src/providers/base/provider.interface.js`
```javascript
// Abstract provider interface definition
// Defines contract for:
// - Request transformation methods
// - Response normalization
// - Error handling patterns
// - Streaming support
// - Health check implementations
```

#### `src/providers/openai/openai.adapter.js`
```javascript
// OpenAI API adapter implementation
// Features:
// - OpenAI-specific request formatting
// - Response transformation to unified format
// - Streaming response handling
// - Error code mapping
// - Audio transcription and TTS support
```

#### `src/providers/openai/openai.audio.js`
```javascript
// OpenAI audio services implementation
// Features:
// - Whisper API integration for transcription
// - Text-to-speech API integration
// - Audio file format validation
// - Streaming audio response handling
```

#### `src/providers/gemini/gemini.adapter.js`
```javascript
// Google Gemini API adapter implementation
// Features:
// - Gemini-specific request formatting
// - Multimodal content handling
// - Response transformation to unified format
// - Context caching support
// - Audio transcription support
```

#### `src/providers/gemini/gemini.audio.js`
```javascript
// Google Gemini audio services implementation
// Features:
// - Speech-to-Text API integration
// - Audio content processing for multimodal requests
// - Audio format validation and conversion
// - Streaming audio response handling
```

### Controllers

#### `src/controllers/chat.controller.js`
```javascript
// Chat completions endpoint handler
// Responsibilities:
// - Request validation and sanitization
// - Delegates to gatewayService.createChatCompletion()
// - Model listing via gatewayService.getAvailableModels()
// - Streaming response handling with SSE
// - Error handling and unified response formatting
// Architecture: Uses Gateway Service for all operations (no direct registry access)
```

#### `src/controllers/audio.controller.js`
```javascript
// Audio processing endpoint handler
// Responsibilities:
// - Audio transcription via gatewayService.createTranscription()
// - Text-to-speech via gatewayService.getProviderForModel() + direct provider call
// - Model validation via gatewayService.getModelInfo()
// - File upload validation and processing
// - Audio format conversion and validation
// Architecture: Uses Gateway Service for provider lookup (no direct registry access)
```

#### `src/controllers/health.controller.js`
```javascript
// Health check endpoint implementations
// Endpoints:
// - /health - Basic health status
// - /health/ready - Readiness probe
// - /health/live - Liveness probe
// - /health/providers - Provider status
```

### Middleware

#### `src/middleware/auth.middleware.js`
```javascript
// Authentication and authorization middleware
// Features:
// - API key validation
// - Client vs gateway key handling
// - Rate limiting per key
// - Usage tracking and quotas
```

#### `src/middleware/validation.middleware.js`
```javascript
// Request validation middleware
// Features:
// - JSON schema validation
// - Parameter sanitization
// - Content-type verification
// - Size limit enforcement
```

#### `src/middleware/error.middleware.js`
```javascript
// Global error handling middleware
// Features:
// - Structured error responses
// - Error logging and monitoring
// - Provider error translation
// - Security error sanitization
```

### Utilities

#### `src/utils/logger.js`
```javascript
// Centralized logging utility
// Features:
// - Structured JSON logging
// - Multiple log levels and formats
// - Request correlation IDs
// - Performance metrics logging
```

#### `src/utils/errors.js`
```javascript
// Custom error class definitions
// Error types:
// - ProviderError - Provider-specific errors
// - ValidationError - Request validation errors
// - AuthenticationError - Auth failures
// - RateLimitError - Rate limiting violations
```

## Architecture Summary

### Refactoring Summary

The project has been refactored to eliminate the registry from API call flows while maintaining health monitoring:

1. **Controllers Layer**: Handle HTTP requests and responses
2. **Gateway Service Layer**: Direct provider management, orchestration, failover and circuit breakers
3. **Router Service Layer**: Intelligent provider selection with 5 routing strategies
4. **Provider Registry Layer**: Background health monitoring only (no API involvement)
5. **Provider Adapters**: Interface with external LLM APIs

### Key Improvements
- ✅ **Registry Eliminated from API Flows**: Direct provider access via Gateway Service Maps
- ✅ **Improved Performance**: Direct Map lookups instead of method calls through registry
- ✅ **Service Layer Architecture**: Controllers use gateway service exclusively
- ✅ **Circuit Breaker Pattern**: Automatic provider failure detection and recovery
- ✅ **Intelligent Routing**: 5 routing strategies (cost, performance, health, round-robin, weighted)
- ✅ **Background Health Monitoring**: Registry runs health checks and notifies Gateway Service
- ✅ **Clear Separation of Concerns**: Registry focused solely on health monitoring
- ✅ **Failover Support**: Exponential backoff retry with circuit breaker protection

### Architecture Changes
- **Provider Registry**: Refactored to health monitoring only, no longer in request path
- **Gateway Service**: Now manages providers directly with internal Maps for fast access
- **Controllers**: All registry dependencies removed, use Gateway Service methods only
- **Health Monitoring**: Asynchronous callback system from registry to Gateway Service

## Development Workflow Files

### Package Management

#### `package.json`
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "build": "npm run build:clean && npm run build:compile",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  }
}
```

### Environment Configuration

#### `.env.example`
```bash
# Core Configuration
NODE_ENV=development
GATEWAY_PORT=8080

# Provider API Keys
OPENAI_API_KEY=sk-your-openai-key
GEMINI_API_KEY=your-gemini-key

# Feature Flags
CACHE_ENABLED=true
RATE_LIMITING_ENABLED=true
CORS_ENABLED=true

# Performance Settings
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=30000
```

## Testing Structure

### Test Organization

- **Unit Tests**: Focus on individual functions and classes
- **Integration Tests**: Test API endpoints and provider interactions
- **End-to-End Tests**: Full workflow testing with real providers
- **Mock Tests**: Test with mocked provider responses

### Key Test Files

#### `tests/unit/services/gateway.service.test.js`
```javascript
// Tests for gateway service orchestration
// Covers:
// - Request routing logic
// - Provider failover scenarios
// - Response transformation
// - Error handling patterns
```

#### `tests/integration/api/chat.test.js`
```javascript
// Integration tests for chat endpoints
// Covers:
// - End-to-end request flows
// - Provider switching scenarios
// - Streaming response handling
// - Authentication flows
```

## Configuration Files

### Environment-Specific Configs

#### `config/production.yaml`
```yaml
# Production environment configuration
server:
  port: 8080
  cors_enabled: true

providers:
  openai:
    timeout: 30000
    retry_count: 3
  gemini:
    timeout: 30000
    retry_count: 3

cache:
  enabled: true
  ttl: 3600
  backend: redis

logging:
  level: info
  format: json
```

This structure provides a comprehensive foundation for the LLM Gateway application, with clear separation of concerns and extensibility for future enhancements.