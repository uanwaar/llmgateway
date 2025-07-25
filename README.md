# LLM Gateway

An open-source, self-hosted intelligent LLM Gateway that provides a unified interface for OpenAI and Google Gemini APIs, enabling seamless switching between LLM providers without code changes.

## Purpose

The LLM Gateway acts as a unified proxy layer between your applications and multiple Large Language Model providers. It provides:

- **Provider Abstraction**: Use multiple LLM providers through a single, OpenAI-compatible API
- **Smart Routing**: Automatically route requests based on cost, performance, or availability
- **Unified Interface**: Switch between providers without changing your application code
- **Self-Hosted Control**: Deploy in your own infrastructure for complete data control and privacy

## Features

- **Unified API**: Single OpenAI-compatible endpoint for all providers
- **Smart Routing**: Cost-based optimization, performance-based routing, health-based failover
- **Flexible Authentication**: Gateway-level, client-level, or hybrid API key management
- **Response Caching**: TTL-based caching with intelligent cache key generation
- **Multimodal Support**: Text, images, audio, and video processing capabilities
- **Self-Hosted**: Deploy in your own infrastructure for complete control
- **Production Ready**: Health checks, metrics, rate limiting, and monitoring

## Installation

### Prerequisites

- Node.js 18 or higher
- Redis (optional, for caching)
- Docker and Docker Compose (for containerized deployment)

### Quick Start with Docker Compose (Recommended)

1. **Clone the repository**:
```bash
git clone https://github.com/your-org/llm-gateway.git
cd llm-gateway
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

3. **Start the services**:
```bash
docker-compose up -d
```

The gateway will be available at `http://localhost:8080`

### Manual Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start the application**:
```bash
# Development
npm run dev

# Production
npm start
```

## Supported Models

### OpenAI Models

#### GPT-4o Series
- **GPT-4o** → `gpt-4o` (128K context, 16K output, vision + audio)
- **GPT-4o Mini** → `gpt-4o-mini` (128K context, 16K output, vision, affordable)
- **GPT-4o Audio** → `gpt-4o-audio` (128K context, audio-enhanced)
- **GPT-4o Realtime** → `gpt-4o-realtime` (128K context, real-time audio)
- **GPT-4o Search Preview** → `gpt-4o-search-preview` (128K context, web search)
- **GPT-4o Transcribe** → `gpt-4o-transcribe` (128K context, audio transcription)
- **GPT-4o Mini Audio** → `gpt-4o-mini-audio` (128K context, audio-enhanced mini)
- **GPT-4o Mini Realtime** → `gpt-4o-mini-realtime` (128K context, real-time mini)
- **GPT-4o Mini Search Preview** → `gpt-4o-mini-search-preview` (128K context, web search mini)
- **GPT-4o Mini Transcribe** → `gpt-4o-mini-transcribe` (128K context, transcription mini)
- **GPT-4o Mini TTS** → `gpt-4o-mini-tts` (128K context, text-to-speech mini)

#### GPT-4 Series
- **GPT-4 Turbo** → `gpt-4-turbo` (128K context, 4K output, vision)
- **GPT-4** → `gpt-4` (8K context, 4K output)
- **GPT-4.1** → `gpt-4.1` (32K context, 4K output)

#### O-Series (Reasoning Models)
- **O3** → `o3` (200K context, 65K output, advanced reasoning)
- **O3 Pro** → `o3-pro` (200K context, 65K output, professional reasoning)
- **O3 Mini** → `o3-mini` (128K context, 65K output, efficient reasoning)
- **O3 Deep Research** → `o3-deep-research` (200K context, research-focused)
- **O4 Mini** → `o4-mini` (128K context, 65K output, next-gen reasoning)
- **O4 Mini Deep Research** → `o4-mini-deep-research` (128K context, research mini)
- **O1 Preview** → `o1-preview` (128K context, 32K output, reasoning preview)
- **O1 Mini** → `o1-mini` (128K context, 65K output, reasoning mini)

#### Embeddings & Audio
- **Text Embedding 3 Small** → `text-embedding-3-small` (1536 dimensions)
- **Text Embedding 3 Large** → `text-embedding-3-large` (3072 dimensions)
- **Whisper** → `whisper-1` (speech-to-text, 25MB file limit)

### Google Gemini Models

#### Gemini 2.x Series
- **Gemini 2.5 Pro** → `gemini-2.5-pro` (2M context, 8K output, multimodal)
- **Gemini 2.5 Flash** → `gemini-2.5-flash` (1M context, 8K output, fast)
- **Gemini 2.0 Flash** → `gemini-2.0-flash` (1M context, 8K output, optimized)
- **Gemini 2.0 Flash Experimental** → `gemini-2.0-flash-exp` (1M context, free preview)

#### Gemini 1.5 Series
- **Gemini 1.5 Pro** → `gemini-1.5-pro` (2M context, 8K output, multimodal)
- **Gemini 1.5 Flash** → `gemini-1.5-flash` (1M context, 8K output, fast)

#### Embeddings
- **Text Embedding 004** → `text-embedding-004` (768 dimensions)

For a complete list of available models, use the `/v1/models` endpoint.

## Configuration

The gateway uses YAML configuration files with environment variable overrides:

- `config/default.yaml` - Base configuration
- `config/development.yaml` - Development overrides
- `config/production.yaml` - Production overrides

### Key Environment Variables

```bash
# Core Configuration
NODE_ENV=production
GATEWAY_PORT=8080

# Provider API Keys
OPENAI_API_KEY=sk-your-openai-key
GEMINI_API_KEY=your-gemini-key

# OpenAI Configuration
OPENAI_USE_RESPONSES_API=true  # Use new Responses API (default: true)

# Feature Flags
CACHE_ENABLED=true
RATE_LIMITING_ENABLED=true
CORS_ENABLED=true

# Performance Settings
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=30000

# Cache Configuration (if enabled)
REDIS_URL=redis://localhost:6379
```

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:8080',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  }
});

// Chat completion
async function chatCompletion() {
  const response = await client.post('/v1/chat/completions', {
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'Hello, world!' }
    ]
  });
  console.log(response.data.choices[0].message.content);
}

// Streaming chat completion
async function streamingChat() {
  const response = await client.post('/v1/chat/completions', {
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'Write a story about AI' }
    ],
    stream: true
  }, {
    responseType: 'stream'
  });
  
  response.data.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) process.stdout.write(content);
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  });
}

// Embeddings
async function getEmbeddings() {
  const response = await client.post('/v1/embeddings', {
    model: 'text-embedding-3-small',
    input: 'Hello world'
  });
  console.log(response.data.data[0].embedding);
}

// Audio transcription
async function transcribeAudio() {
  const FormData = require('form-data');
  const fs = require('fs');
  
  const form = new FormData();
  form.append('file', fs.createReadStream('audio.mp3'));
  form.append('model', 'whisper-1');
  form.append('language', 'en');
  
  const response = await axios.post('http://localhost:8080/v1/audio/transcriptions', form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': 'Bearer your-api-key'
    }
  });
  console.log(response.data.text);
}
```

### Python

```python
import requests
import json
import asyncio
import aiohttp

class LLMGateway:
    def __init__(self, api_key, base_url='http://localhost:8080'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def chat_completion(self, model, messages, **kwargs):
        data = {
            'model': model,
            'messages': messages,
            **kwargs
        }
        response = requests.post(
            f'{self.base_url}/v1/chat/completions',
            headers=self.headers,
            json=data
        )
        return response.json()
    
    def streaming_chat(self, model, messages, **kwargs):
        data = {
            'model': model,
            'messages': messages,
            'stream': True,
            **kwargs
        }
        response = requests.post(
            f'{self.base_url}/v1/chat/completions',
            headers=self.headers,
            json=data,
            stream=True
        )
        
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data = line[6:]
                    if data != '[DONE]':
                        try:
                            parsed = json.loads(data)
                            content = parsed.get('choices', [{}])[0].get('delta', {}).get('content')
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
    
    def embeddings(self, model, input_text):
        data = {
            'model': model,
            'input': input_text
        }
        response = requests.post(
            f'{self.base_url}/v1/embeddings',
            headers=self.headers,
            json=data
        )
        return response.json()
    
    def transcribe_audio(self, file_path, model='whisper-1', language='en'):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'model': model, 'language': language}
            headers = {'Authorization': f'Bearer {self.api_key}'}
            
            response = requests.post(
                f'{self.base_url}/v1/audio/transcriptions',
                headers=headers,
                files=files,
                data=data
            )
            return response.json()

# Usage examples
client = LLMGateway('your-api-key')

# Chat completion
result = client.chat_completion(
    model='gpt-4o',
    messages=[{'role': 'user', 'content': 'Hello!'}]
)
print(result['choices'][0]['message']['content'])

# Streaming chat
print("Streaming response: ", end="")
for chunk in client.streaming_chat(
    model='gpt-4o',
    messages=[{'role': 'user', 'content': 'Write a short poem'}]
):
    print(chunk, end="", flush=True)
print()

# Embeddings
embeddings = client.embeddings(
    model='text-embedding-3-small',
    input_text='Hello world'
)
print(f"Embedding dimension: {len(embeddings['data'][0]['embedding'])}")

# Audio transcription
try:
    transcription = client.transcribe_audio('audio.mp3')
    print(f"Transcription: {transcription['text']}")
except FileNotFoundError:
    print("Audio file not found")

# Async version with aiohttp
async def async_chat_completion():
    async with aiohttp.ClientSession() as session:
        data = {
            'model': 'gpt-4o',
            'messages': [{'role': 'user', 'content': 'Hello async world!'}]
        }
        headers = {
            'Authorization': 'Bearer your-api-key',
            'Content-Type': 'application/json'
        }
        
        async with session.post(
            'http://localhost:8080/v1/chat/completions',
            json=data,
            headers=headers
        ) as response:
            result = await response.json()
            return result['choices'][0]['message']['content']

# Run async example
# asyncio.run(async_chat_completion())
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

type LLMClient struct {
    BaseURL string
    APIKey  string
    Client  *http.Client
}

type ChatRequest struct {
    Model    string    `json:"model"`
    Messages []Message `json:"messages"`
    Stream   bool      `json:"stream,omitempty"`
}

type Message struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

type ChatResponse struct {
    Choices []Choice `json:"choices"`
}

type Choice struct {
    Message Message `json:"message"`
}

func NewLLMClient(baseURL, apiKey string) *LLMClient {
    return &LLMClient{
        BaseURL: baseURL,
        APIKey:  apiKey,
        Client:  &http.Client{},
    }
}

func (c *LLMClient) ChatCompletion(model string, messages []Message) (*ChatResponse, error) {
    req := ChatRequest{
        Model:    model,
        Messages: messages,
    }
    
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, err
    }
    
    httpReq, err := http.NewRequest("POST", 
        c.BaseURL+"/v1/chat/completions", 
        bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }
    
    httpReq.Header.Set("Authorization", "Bearer "+c.APIKey)
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := c.Client.Do(httpReq)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var chatResp ChatResponse
    if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
        return nil, err
    }
    
    return &chatResp, nil
}

func main() {
    client := NewLLMClient("http://localhost:8080", "your-api-key")
    
    messages := []Message{
        {Role: "user", Content: "Hello, world!"},
    }
    
    response, err := client.ChatCompletion("gpt-4o", messages)
    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }
    
    fmt.Println(response.Choices[0].Message.Content)
}
```

### cURL Examples

#### Chat Completions
```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

#### Streaming Chat
```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Write a story about AI"}
    ],
    "stream": true
  }'
```

#### Embeddings
```bash
curl -X POST http://localhost:8080/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "The food was delicious and the waiter was friendly."
  }'
```

#### Audio Transcription
```bash
curl -X POST http://localhost:8080/v1/audio/transcriptions \
  -H "Authorization: Bearer your-api-key" \
  -F file="@audio.mp3" \
  -F model="whisper-1" \
  -F language="en" \
  -F response_format="json"
```

#### Text-to-Speech
```bash
curl -X POST http://localhost:8080/v1/audio/speech \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "tts-1",
    "input": "Hello! This is a text-to-speech conversion.",
    "voice": "alloy",
    "response_format": "mp3"
  }' \
  --output speech.mp3
```

## API Endpoints

📖 **For detailed API usage, validation rules, and examples, see: [API Validation Guide](docs/api-validation.md)**

### Core Endpoints
- `POST /v1/chat/completions` - Chat completions with streaming support
- `POST /v1/embeddings` - Text embeddings generation
- `GET /v1/models` - List all available models
- `GET /v1/models/{model_id}` - Get specific model details

### Audio Processing
- `POST /v1/audio/transcriptions` - Speech-to-text (Whisper)
- `POST /v1/audio/translations` - Speech-to-text with English translation
- `POST /v1/audio/speech` - Text-to-speech synthesis

### Health & Monitoring
- `GET /health` - Basic health check (no auth required)
- `GET /v1/health/detailed` - Detailed health with provider status
- `GET /v1/health/ready` - Kubernetes readiness probe
- `GET /v1/health/live` - Kubernetes liveness probe
- `GET /v1/health/metrics` - Application metrics and statistics

### Discovery
- `GET /` - API information and available endpoints
- `GET /v1/` - API v1 information and endpoint listing

## Provider-Specific Features

### OpenAI Integration
- **Full API Compatibility**: Complete OpenAI API compatibility
- **Responses API Support**: New Responses API with automatic fallback to chat completions
- **All Model Types**: GPT-4o, GPT-4, GPT-3.5, embeddings, Whisper, TTS
- **Advanced Features**: Function calling, tool use, vision capabilities
- **Audio Processing**: Whisper transcription, high-quality TTS voices

### Google Gemini Integration
- **Multimodal Excellence**: Advanced text, image, audio, and video processing
- **Large Context**: Up to 2M tokens context window (Gemini 2.5 Pro)
- **Code Generation**: Specialized code analysis and generation capabilities
- **Safety Controls**: Configurable safety filtering and content policies
- **Performance Options**: Choose between Pro (quality) and Flash (speed) variants

### Smart Routing Features
- **Cost Optimization**: Automatically route to most cost-effective provider
- **Performance Routing**: Route based on response time and quality metrics
- **Health-Based Failover**: Automatic failover when providers are unavailable
- **Load Balancing**: Distribute requests across multiple providers
- **Model Mapping**: Intelligent mapping between equivalent models across providers

## Authentication

The gateway supports flexible authentication patterns:

### API Key Authentication
All requests require an API key using either:
- **Authorization header**: `Authorization: Bearer your-api-key`
- **X-API-Key header**: `X-API-Key: your-api-key`

### Authentication Modes
- **Gateway-level**: Single API key for the gateway (simplest)
- **Client-level**: Each client has their own API key (most secure)
- **Hybrid**: Mix of gateway and client keys (most flexible)

## Error Handling

The gateway returns standard HTTP status codes with detailed error messages:

```json
{
  "error": {
    "message": "Model not found: invalid-model",
    "type": "model_not_found",
    "code": "model_not_found",
    "details": {
      "requested_model": "invalid-model",
      "available_models": ["gpt-4o", "gpt-4", "gemini-2.5-pro"]
    }
  }
}
```

### Common Error Types
- `invalid_api_key` - Authentication failed
- `model_not_found` - Requested model unavailable
- `rate_limit_exceeded` - Rate limit reached
- `provider_error` - Upstream provider error
- `validation_error` - Request validation failed

## Rate Limiting

Configurable rate limiting with headers:
- Chat completions: 60 requests/minute (default)
- Embeddings: 30 requests/minute (default)
- Audio processing: 10 requests/minute (default)

Rate limit headers in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640995200
```

## Development

### Setup Development Environment
```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

### Using Docker for Development
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Run tests in container
docker-compose -f docker-compose.dev.yml run --rm gateway npm test
```

### Testing
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
```

## Deployment

### Docker
```bash
# Build production image
docker build -f docker/Dockerfile.prod -t llm-gateway:latest .

# Run container
docker run -p 8080:8080 \
  -e OPENAI_API_KEY=your-key \
  -e GEMINI_API_KEY=your-key \
  llm-gateway:latest
```

### Kubernetes
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=llm-gateway
```

### Environment-Specific Configs
The gateway automatically loads configuration based on `NODE_ENV`:
- `development` → loads `config/development.yaml`
- `production` → loads `config/production.yaml`
- `test` → loads `config/test.yaml`

## Monitoring and Observability

### Health Checks
- Basic health: `GET /health`
- Detailed status: `GET /v1/health/detailed`
- Provider status: Individual provider health monitoring
- Kubernetes probes: Readiness and liveness endpoints

### Metrics
- Request/response metrics
- Provider performance tracking
- Cache hit/miss rates
- Error rate monitoring
- Response time histograms

### Logging
- Structured JSON logging
- Request correlation IDs
- Performance metrics
- Security event logging

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## Security

### Security Features
- API key encryption at rest
- Request validation and sanitization
- Rate limiting and DDoS protection
- Secure headers and CORS configuration
- Input validation and output encoding

### Reporting Security Issues
For security issues, please email security@llm-gateway.org instead of creating a public issue.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support and Community

- **Documentation**: [Full documentation](docs/)
  - [API Validation Guide](docs/api-validation.md) - Request formats, validation rules, and examples
- **Issues**: [GitHub Issues](https://github.com/your-org/llm-gateway/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/llm-gateway/discussions)
- **Discord**: [Join our Discord community](https://discord.gg/llm-gateway)
- **Email**: support@llm-gateway.org

## Roadmap

### Upcoming Features
- **Additional Providers**: Anthropic Claude, AWS Bedrock, Azure OpenAI
- **Advanced Caching**: Semantic caching and cache warming
- **Analytics Dashboard**: Web UI for monitoring and analytics
- **Request Transformation**: Custom request/response transformations
- **Cost Management**: Budget controls and usage alerts
- **Multi-tenant Support**: Organization-level isolation and billing

### Recent Updates
- ✅ OpenAI Responses API integration with automatic fallback
- ✅ Complete audio processing pipeline (transcription, translation, TTS)
- ✅ Enhanced multimodal support for Gemini models
- ✅ Production-ready health checks and monitoring
- ✅ Comprehensive middleware pipeline with rate limiting

---

**Built with ❤️ by Umair Anwaar**

*Transform your AI applications with unified, intelligent LLM routing*