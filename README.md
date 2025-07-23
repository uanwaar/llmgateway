# LLM Gateway

An open-source, self-hosted intelligent LLM Gateway that provides a unified interface for OpenAI and Google Gemini APIs, enabling seamless switching between LLM providers without code changes.

## Features

- **Unified API**: Single endpoint for all providers with standardized request/response format
- **Smart Routing**: Cost-based optimization, performance-based routing, health-based failover
- **Flexible Authentication**: Gateway-level, client-level, or hybrid API key management
- **Response Caching**: TTL-based caching with intelligent cache key generation
- **Multimodal Support**: Text, images, and audio processing capabilities
- **Self-Hosted**: Deploy in your own infrastructure for complete control

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository**:
```bash
git clone https://github.com/your-org/llm-gateway.git
cd llm-gateway
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Start the services**:
```bash
docker-compose up -d
```

The gateway will be available at `http://localhost:8080`

### Manual Installation

1. **Prerequisites**:
   - Node.js 18+
   - Redis (optional, for caching)

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start the application**:
```bash
# Development
npm run dev

# Production
npm start
```

## Usage

### Basic Chat Completion

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Provider-Specific Routing

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "model": "gemini-2.5-pro",
    "provider": "gemini",
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ]
  }'
```

## Supported Models

### OpenAI Models
- GPT-4o → `gpt-4o`
- GPT-4o Mini → `gpt-4o-mini`
- GPT-4 Turbo → `gpt-4-turbo`
- And more...

### Google Gemini Models
- Gemini 2.5 Pro → `gemini-2.5-pro`
- Gemini 2.5 Flash → `gemini-2.5-flash`
- Gemini 2.0 Flash → `gemini-2.0-flash`

## Configuration

The gateway uses YAML configuration files with environment variable overrides:

- `config/default.yaml` - Base configuration
- `config/development.yaml` - Development overrides
- `config/production.yaml` - Production overrides

Key environment variables:
- `OPENAI_API_KEY` - OpenAI API key
- `GEMINI_API_KEY` - Google Gemini API key
- `GATEWAY_PORT` - Server port (default: 8080)
- `CACHE_ENABLED` - Enable response caching
- `REDIS_URL` - Redis connection URL

## Development

### Setup Development Environment

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

### Using Docker for Development

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Run tests in container
docker-compose -f docker-compose.dev.yml run --rm gateway npm test
```

## Deployment

### Docker

```bash
# Build production image
docker build -f docker/Dockerfile.prod -t llm-gateway:latest .

# Run container
docker run -p 8080:8080 -e OPENAI_API_KEY=your-key llm-gateway:latest
```

### Kubernetes

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

## API Documentation

The gateway provides a unified OpenAI-compatible API:

- `POST /v1/chat/completions` - Chat completions
- `POST /v1/embeddings` - Text embeddings
- `GET /v1/models` - List available models
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

## Contributing

We welcome contributions! Please see our [Contributing Guide](contributing.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

For security issues, please email security@llm-gateway.org instead of creating a public issue.

## Support

- **Documentation**: [Full documentation](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/llm-gateway/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/llm-gateway/discussions)