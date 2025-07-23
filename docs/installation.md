# LLM Gateway - Installation Guide

## Overview

This guide provides step-by-step instructions for installing and setting up the LLM Gateway in different environments.

## Prerequisites

### System Requirements
- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher (or yarn/pnpm equivalent)
- **Memory**: Minimum 512MB RAM, recommended 1GB+
- **Storage**: At least 100MB free space
- **Network**: Outbound HTTPS access to OpenAI and Google APIs

### API Keys Required
- **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Google Gemini API Key**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Quick Start

### Option 1: Docker (Recommended)

1. **Clone the repository**:
```bash
git clone https://github.com/your-org/llm-gateway.git
cd llm-gateway
```

2. **Set up environment variables**:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env file with your API keys
nano .env
```

3. **Start with Docker Compose**:
```bash
docker-compose up -d
```

4. **Verify installation**:
```bash
curl http://localhost:8080/health
```

### Option 2: Manual Installation

1. **Clone and install dependencies**:
```bash
git clone https://github.com/your-org/llm-gateway.git
cd llm-gateway
npm install
```

2. **Configure environment**:
```bash
# Copy configuration template
cp config/config.example.yaml config/config.yaml

# Set environment variables
export OPENAI_API_KEY=sk-your-openai-key
export GEMINI_API_KEY=your-gemini-key
export GATEWAY_PORT=8080
```

3. **Build and start**:
```bash
npm run build
npm start
```

## Detailed Installation Instructions

### Docker Installation

#### Prerequisites
- Docker Engine 20.x or higher
- Docker Compose 2.x or higher

#### Step-by-Step Setup

1. **Install Docker** (if not already installed):
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# macOS (using Homebrew)
brew install docker docker-compose

# Windows: Download Docker Desktop from docker.com
```

2. **Clone the repository**:
```bash
git clone https://github.com/your-org/llm-gateway.git
cd llm-gateway
```

3. **Configure environment variables**:
```bash
# Create .env file
cat > .env << EOF
OPENAI_API_KEY=sk-your-openai-key-here
GEMINI_API_KEY=your-gemini-key-here
GATEWAY_PORT=8080
NODE_ENV=production
CACHE_ENABLED=true
RATE_LIMITING_ENABLED=true
EOF
```

4. **Review Docker Compose configuration**:
```yaml
# docker-compose.yml (example)
version: '3.8'
services:
  llm-gateway:
    build: .
    ports:
      - "${GATEWAY_PORT:-8080}:8080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - NODE_ENV=${NODE_ENV:-production}
      - CACHE_ENABLED=${CACHE_ENABLED:-true}
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

5. **Start the services**:
```bash
# Start in background
docker-compose up -d

# View logs
docker-compose logs -f llm-gateway

# Check status
docker-compose ps
```

6. **Test the installation**:
```bash
# Health check
curl http://localhost:8080/health

# Test API endpoint
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 50
  }'
```

### Manual Installation

#### Prerequisites
- Node.js 18+ and npm
- Git
- Text editor

#### Step-by-Step Setup

1. **Install Node.js** (if not already installed):
```bash
# Using Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Or download from nodejs.org
```

2. **Clone and setup**:
```bash
# Clone repository
git clone https://github.com/your-org/llm-gateway.git
cd llm-gateway

# Install dependencies
npm ci --only=production

# Or for development
npm install
```

3. **Configuration setup**:

Create configuration file:
```bash
mkdir -p config
cp config/config.example.yaml config/config.yaml
```

Edit `config/config.yaml`:
```yaml
auth:
  mode: "hybrid"
  allow_client_keys: true

providers:
  openai:
    enabled: true
    api_key: "${OPENAI_API_KEY}"
    base_url: "https://api.openai.com/v1"
    
  gemini:
    enabled: true
    api_key: "${GEMINI_API_KEY}"
    base_url: "https://generativelanguage.googleapis.com/v1"

server:
  port: 8080
  cors_enabled: true
```

4. **Environment variables**:
```bash
# Create .env file
cat > .env << EOF
OPENAI_API_KEY=sk-your-openai-key-here
GEMINI_API_KEY=your-gemini-key-here
NODE_ENV=production
GATEWAY_PORT=8080
EOF

# Source environment variables
source .env

# Or export individually
export OPENAI_API_KEY=sk-your-openai-key-here
export GEMINI_API_KEY=your-gemini-key-here
```

5. **Build and start**:
```bash
# Build the application
npm run build

# Start in production mode
npm run start

# Or start in development mode
npm run dev
```

6. **Verify installation**:
```bash
# Check if service is running
curl http://localhost:8080/health

# Test with a simple request
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Test message"}]
  }'
```

### Kubernetes Installation

#### Prerequisites
- Kubernetes cluster (local or cloud)
- kubectl configured
- Helm (optional, for chart-based installation)

#### Using kubectl

1. **Create namespace**:
```bash
kubectl create namespace llm-gateway
```

2. **Create secrets**:
```bash
kubectl create secret generic api-keys \
  --from-literal=openai-key=sk-your-openai-key \
  --from-literal=gemini-key=your-gemini-key \
  -n llm-gateway
```

3. **Apply manifests**:
```bash
# Download Kubernetes manifests
curl -O https://raw.githubusercontent.com/your-org/llm-gateway/main/k8s/deployment.yaml
curl -O https://raw.githubusercontent.com/your-org/llm-gateway/main/k8s/service.yaml

# Apply to cluster
kubectl apply -f deployment.yaml -n llm-gateway
kubectl apply -f service.yaml -n llm-gateway
```

4. **Check deployment**:
```bash
# Check pods
kubectl get pods -n llm-gateway

# Check logs
kubectl logs -f deployment/llm-gateway -n llm-gateway

# Port forward for testing
kubectl port-forward service/llm-gateway-service 8080:80 -n llm-gateway
```

#### Using Helm

1. **Add Helm repository**:
```bash
helm repo add llm-gateway https://your-org.github.io/llm-gateway
helm repo update
```

2. **Install with Helm**:
```bash
helm install llm-gateway llm-gateway/llm-gateway \
  --namespace llm-gateway \
  --create-namespace \
  --set secrets.openaiKey=sk-your-openai-key \
  --set secrets.geminiKey=your-gemini-key
```

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_PORT` | `8080` | Port for the HTTP server |
| `NODE_ENV` | `development` | Environment mode |
| `OPENAI_API_KEY` | - | OpenAI API key (optional if client-provided) |
| `GEMINI_API_KEY` | - | Google Gemini API key (optional if client-provided) |
| `CACHE_ENABLED` | `true` | Enable response caching |
| `RATE_LIMITING_ENABLED` | `true` | Enable rate limiting |
| `CORS_ENABLED` | `true` | Enable CORS support |
| `MAX_CONCURRENT_REQUESTS` | `100` | Maximum concurrent requests |
| `REQUEST_TIMEOUT` | `30000` | Request timeout in milliseconds |

### Configuration File

Example `config/config.yaml`:
```yaml
server:
  port: ${GATEWAY_PORT:-8080}
  host: '0.0.0.0'
  cors:
    enabled: true
    origins: ['*']

auth:
  mode: 'hybrid'  # gateway, client, hybrid
  allow_client_keys: true
  require_auth_header: false

providers:
  openai:
    enabled: true
    api_key: '${OPENAI_API_KEY}'
    base_url: 'https://api.openai.com/v1'
    timeout: 30000
    retry_count: 3
    
  gemini:
    enabled: true
    api_key: '${GEMINI_API_KEY}'
    base_url: 'https://generativelanguage.googleapis.com/v1'
    timeout: 30000
    retry_count: 3

routing:
  strategy: 'cost_optimized'
  failover_enabled: true

cache:
  enabled: ${CACHE_ENABLED:-true}
  ttl: 3600
  max_size: 1000

security:
  rate_limit:
    enabled: ${RATE_LIMITING_ENABLED:-true}
    requests_per_minute: 1000
    burst_limit: 100

logging:
  level: 'info'
  format: 'json'
```

## Post-Installation Steps

### 1. Verify Installation
```bash
# Health check
curl http://localhost:8080/health

# Check configuration
curl http://localhost:8080/config
```

### 2. Test API Endpoints
```bash
# Test OpenAI model
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello world!"}],
    "max_tokens": 50
  }'

# Test Gemini model
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-pro",
    "messages": [{"role": "user", "content": "Hello world!"}],
    "max_tokens": 50
  }'
```

### 3. Monitor Logs
```bash
# Docker logs
docker-compose logs -f llm-gateway

# Manual installation logs
tail -f logs/app.log

# Kubernetes logs
kubectl logs -f deployment/llm-gateway -n llm-gateway
```

### 4. Set Up Monitoring (Optional)
```bash
# Enable metrics endpoint
curl http://localhost:8080/metrics

# Set up log rotation
sudo logrotate -f /etc/logrotate.d/llm-gateway
```

## Troubleshooting

### Common Issues

1. **"Connection refused" error**:
   - Check if the service is running: `docker-compose ps` or `ps aux | grep node`
   - Verify port is not in use: `netstat -tulpn | grep 8080`

2. **"Invalid API key" error**:
   - Verify API keys are correctly set in environment variables
   - Check API key format and permissions

3. **High memory usage**:
   - Disable caching if not needed: `CACHE_ENABLED=false`
   - Reduce cache size in configuration

4. **Slow responses**:
   - Check network connectivity to provider APIs
   - Monitor provider API status pages
   - Consider increasing timeout values

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start

# Or with Docker
docker-compose run --rm -e DEBUG=* llm-gateway npm start
```

### Getting Help

- Check the [GitHub Issues](https://github.com/your-org/llm-gateway/issues)
- Join our [Discord community](https://discord.gg/llm-gateway)
- Read the [documentation](https://docs.llm-gateway.org)

## Next Steps

After successful installation:

1. Read the [API Documentation](./OpenAI_API_Documentation.md) and [Gemini Documentation](./Google_Gemini_API_Documentation.md)
2. Check the [Deployment Guide](./deployment.md) for production deployment
3. Review [Contributing Guidelines](./contributing.md) to contribute to the project
4. Explore [examples](./examples/) for integration patterns