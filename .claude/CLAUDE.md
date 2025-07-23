# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The LLM Gateway is an open-source, self-hosted intelligent proxy service that provides a unified interface for OpenAI and Google Gemini APIs, enabling seamless switching between LLM providers without code changes.

## Development Commands

Based on the contributing guidelines, use these commands for development:

```bash
# Development
npm run dev                    # Start development server with hot reload
DEBUG=* npm run dev           # Run with debug logging
DEBUG=gateway:* npm run dev   # Run with specific debug namespace

# Testing
npm test                      # Run all tests
npm run test:unit            # Run unit tests only
npm run test:integration     # Run integration tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Generate coverage report
npm run test:providers       # Test with different providers

# Code Quality
npm run lint                 # Check code style
npm run lint:fix            # Fix auto-fixable linting issues
npm run format              # Format code with Prettier
npm run type-check          # Run TypeScript type checking

# Docker Development
docker-compose -f docker-compose.dev.yml build  # Build dev image
docker-compose -f docker-compose.dev.yml up     # Start dev environment
```

## Core Architecture

The system uses a layered architecture with these key components:

### Provider Adapters (`src/providers/`)
- **OpenAI Adapter** (`src/providers/openai/openai.adapter.js`): Handles OpenAI API translation
- **Gemini Adapter** (`src/providers/gemini/gemini.adapter.js`): Handles Google Gemini API translation  
- **Base Interface** (`src/providers/base/provider.interface.js`): Defines provider contract

### Core Services (`src/services/`)
- **Gateway Service** (`src/services/gateway.service.js`): Main orchestration logic
- **Router Service** (`src/services/router.service.js`): Intelligent request routing
- **Cache Service** (`src/services/cache.service.js`): Response caching with TTL
- **Auth Service** (`src/services/auth.service.js`): Authentication handling

### API Layer (`src/controllers/` and `src/routes/`)
- **Chat Controller** (`src/controllers/chat.controller.js`): Chat completions endpoint
- **Health Controller** (`src/controllers/health.controller.js`): Health check endpoints
- **Routes** (`src/routes/v1/`): API version 1 route definitions

### Middleware (`src/middleware/`)
- **Auth Middleware** (`src/middleware/auth.middleware.js`): API key validation
- **Validation Middleware** (`src/middleware/validation.middleware.js`): Request validation
- **Error Middleware** (`src/middleware/error.middleware.js`): Global error handling

## Configuration

The gateway uses environment variables and YAML configuration files:

- **Environment Setup**: Copy `.env.example` to `.env` and configure API keys
- **Configuration Files**: Located in `config/` directory (default.yaml, development.yaml, production.yaml)
- **Provider Settings**: Configured in `src/config/providers.js`

## Model Support

### OpenAI Models
- GPT-4o → `gpt-4o`
- GPT-4o Audio → `gpt-4o-audio`
- GPT-4 Turbo → `gpt-4-turbo`
- o3, o3-pro, o3-mini → `o3`, `o3-pro`, `o3-mini`
- And many more (see architecture.md:58-80)

### Google Gemini Models  
- Gemini 2.5 Pro → `gemini-2.5-pro`
- Gemini 2.5 Flash → `gemini-2.5-flash`
- Gemini 2.0 Flash → `gemini-2.0-flash`

## Key Features

- **Unified API**: Single endpoint for all providers with standardized request/response format
- **Smart Routing**: Cost-based optimization, performance-based routing, health-based failover
- **Flexible Authentication**: Gateway-level, client-level, or hybrid API key management
- **Response Caching**: TTL-based caching with intelligent cache key generation
- **Multimodal Support**: Text, images, and audio processing capabilities

## Testing Guidelines

- Follow Arrange-Act-Assert pattern in tests
- Use descriptive test names and keep tests focused
- Mock external dependencies using files in `tests/mocks/`
- Test fixtures are located in `tests/fixtures/`
- Ensure both success and error cases are covered

## Code Standards

- Use ESLint and Prettier for code formatting
- Follow kebab-case for files, PascalCase for classes, camelCase for functions
- Use explicit error handling with try-catch blocks
- Implement structured logging with context objects
- Prefer TypeScript interfaces over types for object shapes

## Important Files

- `src/index.js`: Application entry point and bootstrap
- `src/app.js`: Express application configuration
- `src/server.js`: HTTP server setup
- `config/default.yaml`: Default configuration settings
- `docker-compose.yml`: Container orchestration
- `contributing.md`: Detailed contribution guidelines