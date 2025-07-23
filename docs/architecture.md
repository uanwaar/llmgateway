# LLM Gateway - Architecture Documentation

## Overview

The LLM Gateway is an open-source, self-hosted intelligent proxy service that provides a unified interface for OpenAI and Google Gemini APIs, enabling seamless switching between LLM providers without code changes. Users can install and deploy the gateway from GitHub in their own infrastructure.

## System Architecture

### Core Components

Based on the PRD, the system will implement these key architectural components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Client Apps   │    │   Client Apps   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    LLM Gateway API        │
                    │  (Unified Interface)      │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │     Router Service        │
                    │ (Intelligent Routing)     │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────▼─────────┐    ┌─────────▼─────────┐    ┌─────────▼─────────┐
│  OpenAI Adapter   │    │  Gemini Adapter   │    │ Future Providers  │
└─────────┬─────────┘    └─────────┬─────────┘    └─────────┬─────────┘
          │                        │                        │
┌─────────▼─────────┐    ┌─────────▼─────────┐    ┌─────────▼─────────┐
│    OpenAI API     │    │   Gemini API      │    │   Other APIs      │
└───────────────────┘    └───────────────────┘    └───────────────────┘
```

### Data Flow

1. **Request Flow**:
   - Client sends unified request to Gateway API
   - Router Service analyzes request and selects appropriate provider
   - Provider Adapter translates request to provider-specific format
   - Request is sent to the selected LLM provider

2. **Response Flow**:
   - Provider returns response in native format
   - Provider Adapter translates response to unified format
   - Gateway adds metadata (cost, timing, provider info)
   - Unified response returned to client

### Supported Models

#### OpenAI Models
- GPT-4o → `gpt-4o`
- GPT-4o Audio → `gpt-4o-audio`
- GPT-4o Realtime → `gpt-4o-realtime`
- GPT-4o Search Preview → `gpt-4o-search-preview`
- GPT-4o Transcribe → `gpt-4o-transcribe`
- GPT-4o mini → `gpt-4o-mini`
- GPT-4o mini Audio → `gpt-4o-mini-audio`
- GPT-4o mini Realtime → `gpt-4o-mini-realtime`
- GPT-4o mini Search Preview → `gpt-4o-mini-search-preview`
- GPT-4o mini Transcribe → `gpt-4o-mini-transcribe`
- GPT-4o mini TTS → `gpt-4o-mini-tts`
- GPT-4 Turbo → `gpt-4-turbo`
- GPT-4.1 → `gpt-4.1`
- GPT-4 → `gpt-4`
- o3 → `o3`
- o3-pro → `o3-pro`
- o3-mini → `o3-mini`
- o3-deep-research → `o3-deep-research`
- o4-mini → `o4-mini`
- o4-mini-deep-research → `o4-mini-deep-research`
- o1-preview → `o1-preview`
- o1-mini → `o1-mini`
- Whisper → `whisper-1`

#### Google Gemini Models
- Gemini 2.5 Pro → `gemini-2.5-pro`
- Gemini 2.5 Flash → `gemini-2.5-flash`
- Gemini 2.0 Flash → `gemini-2.0-flash`

### Key Features

#### Unified API
- Single endpoint for all providers
- Standardized request/response format
- Automatic provider translation

#### Smart Routing
- Cost-based optimization
- Performance-based routing
- Health-based failover
- Round-robin load balancing

#### Advanced Capabilities
- Response caching with TTL
- Multimodal support (text, images, audio)
- Streaming responses
- Usage analytics and cost tracking

## Configuration Architecture

### Configuration Management
The gateway uses a layered configuration approach:
- Environment variables for deployment-specific settings
- YAML configuration files for feature settings
- Runtime configuration for dynamic provider management

### API Key Management Architecture
Supports flexible authentication patterns:
- **Gateway-level**: Centralized credential storage
- **Client-level**: Per-request authentication headers
- **Hybrid**: Default gateway keys with client override capability

## Implementation Architecture

### Development Phases
1. **Core Gateway**: Basic HTTP server with unified API
2. **Provider Integration**: OpenAI and Gemini adapters
3. **Smart Routing**: Intelligent request distribution
4. **Advanced Features**: Caching, monitoring, multimodal support

### Extension Points
- **Provider Adapters**: Pluggable interface for new LLM providers
- **Routing Strategies**: Configurable algorithms for request distribution
- **Middleware Pipeline**: Extensible request/response processing
- **Configuration Providers**: Support for different config sources

## Related Documentation

- **[Project Structure](./project-structure.md)**: Detailed file structure and core application files
- **[Installation Guide](./installation.md)**: Step-by-step setup instructions
- **[Deployment Guide](./deployment.md)**: Production deployment strategies
- **[Contributing Guide](./contributing.md)**: Development and contribution guidelines
- **[API Documentation](./OpenAI_API_Documentation.md)**: OpenAI integration details
- **[API Documentation](./Google_Gemini_API_Documentation.md)**: Gemini integration details