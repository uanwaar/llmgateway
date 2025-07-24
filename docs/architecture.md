# LLM Gateway - Architecture Documentation

## Overview

The LLM Gateway is an open-source, self-hosted intelligent proxy service that provides a unified interface for OpenAI and Google Gemini APIs, enabling seamless switching between LLM providers without code changes. Users can install and deploy the gateway from GitHub in their own infrastructure.

## System Architecture

### Core Components

The system implements a sophisticated four-layer architecture with proper separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Client Apps   │    │   Client Apps   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      Controllers          │
                    │  (Request Handlers)       │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Gateway Service         │
                    │ (Orchestration & Provider │
                    │     Management)           │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Router Service          │
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

                    ┌─────────────────────────────┐
                    │   Provider Registry         │
                    │ (Health Monitoring Only)    │
                    │                             │
                    │ Runs background health      │
                    │ checks and notifies         │
                    │ Gateway Service             │
                    └─────────────────────────────┘
```

### Data Flow

1. **Request Flow**:
   - Client sends unified request to Gateway API
   - Controllers receive and validate the request
   - Gateway Service orchestrates the request processing
   - Gateway Service uses internal model-to-provider mapping for direct provider lookup
   - Router Service applies intelligent routing strategy to select best provider
   - Provider Adapter translates request to provider-specific format
   - Request is sent to the selected LLM provider

2. **Response Flow**:
   - Provider returns response in native format
   - Provider Adapter translates response to unified format
   - Gateway Service adds metadata (cost, timing, provider info)
   - Controllers format and return unified response to client

3. **Health Monitoring Flow**:
   - Provider Registry runs background health checks every 30 seconds
   - Health status changes are immediately reported to Gateway Service via callback
   - Gateway Service updates internal provider health status
   - Circuit breakers prevent requests to unhealthy providers

4. **Failover Flow**:
   - Gateway Service monitors provider health via circuit breakers
   - On provider failure, automatic retry with exponential backoff
   - Circuit breaker opens after threshold failures, preventing further requests
   - Health monitoring enables automatic recovery when provider becomes healthy

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
- Cost-based optimization routing
- Performance-based routing with metrics
- Health-based failover with circuit breakers
- Round-robin and weighted load balancing
- Automatic provider failure detection and recovery

#### Advanced Capabilities
- Response caching with TTL
- Multimodal support (text, images, audio)
- Streaming responses with real-time processing
- Usage analytics and cost tracking
- Circuit breaker pattern for resilience
- Exponential backoff retry mechanisms
- Provider health monitoring and automatic failover

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