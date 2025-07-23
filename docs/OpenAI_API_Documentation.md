# OpenAI API Documentation
## Responses API & Audio API Implementation Guide

---

## Table of Contents
1. [Responses API](#responses-api)
2. [Audio API](#audio-api)
3. [Authentication](#authentication)
4. [Error Handling](#error-handling)
5. [Best Practices](#best-practices)

---

## Responses API

### Overview
The OpenAI Responses API, released in March 2025, is the next-generation interface that combines the simplicity of Chat Completions with the advanced capabilities of the Assistants API. It provides a unified approach to building AI applications with built-in tools, background processing, and enhanced streaming capabilities.

### Base URL
```
https://api.openai.com/v1/responses
```

### Authentication
```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

---

## 1. Create Response

### Endpoint
```http
POST /v1/responses
```

### Request Format

#### Basic Request
```json
{
  "model": "gpt-4o",
  "input": "What is the weather like today in New York?",
  "stream": false
}
```

#### Advanced Request with Tools
```json
{
  "model": "o3",
  "input": [
    {
      "type": "text",
      "text": "Analyze this data and create a visualization"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "https://example.com/data-chart.png"
      }
    }
  ],
  "tools": [
    {
      "type": "web_search_preview"
    },
    {
      "type": "code_interpreter"
    }
  ],
  "background": false,
  "stream": true,
  "max_output_tokens": 4096
}
```

#### Background Processing Request
```json
{
  "model": "o3",
  "input": "Perform a comprehensive analysis of this 100-page document",
  "tools": [
    {
      "type": "file_search",
      "file_search": {
        "vector_store_ids": ["vs_12345"]
      }
    }
  ],
  "background": true,
  "store": true,
  "max_output_tokens": 16384
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model ID (e.g., "gpt-4o", "gpt-4.1", "o3", "o4-mini") |
| `input` | string or array | Yes | Input text or multimodal content array |
| `tools` | array | No | Array of tools to enable |
| `stream` | boolean | No | Enable streaming responses (default: false) |
| `background` | boolean | No | Enable background processing (default: false) |
| `store` | boolean | No | Required when background=true |
| `max_output_tokens` | integer | No | Maximum tokens in response (default: 4096) |
| `temperature` | number | No | Sampling temperature 0-2 (default: 1) |
| `top_p` | number | No | Nucleus sampling parameter (default: 1) |

### Available Models
- **gpt-4o**: Latest GPT-4 Omni model
- **gpt-4.1**: Enhanced GPT-4 variant
- **o3**: Advanced reasoning model with chain-of-thought
- **o4-mini**: Efficient reasoning model for cost optimization

### Built-in Tools

#### 1. Web Search
```json
{
  "type": "web_search_preview"
}
```

#### 2. File Search
```json
{
  "type": "file_search",
  "file_search": {
    "vector_store_ids": ["vs_12345", "vs_67890"],
    "max_num_results": 20
  }
}
```

#### 3. Code Interpreter
```json
{
  "type": "code_interpreter"
}
```

#### 4. Image Generation
```json
{
  "type": "dalle"
}
```

### Response Format

#### Successful Response
```json
{
  "id": "resp_12345",
  "object": "response",
  "created": 1704067200,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The weather in New York today is partly cloudy with a high of 72°F.",
        "reasoning": "I searched for current weather information for New York City and found reliable meteorological data."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 20,
    "total_tokens": 35,
    "reasoning_tokens": 150
  },
  "system_fingerprint": "fp_12345"
}
```

#### Background Response (Immediate)
```json
{
  "id": "resp_bg_12345",
  "object": "response",
  "status": "in_progress",
  "created": 1704067200,
  "model": "o3",
  "background": true
}
```

#### Streaming Response Format
```
data: {"id":"resp_12345","object":"response.chunk","created":1704067200,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"The weather"},"finish_reason":null}]}

data: {"id":"resp_12345","object":"response.chunk","created":1704067200,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":" in New York"},"finish_reason":null}]}

data: {"id":"resp_12345","object":"response.chunk","created":1704067200,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

---

## 2. Retrieve Response

### Endpoint
```http
GET /v1/responses/{response_id}
```

### Response Format
```json
{
  "id": "resp_12345",
  "object": "response",
  "created": 1704067200,
  "model": "gpt-4o",
  "status": "completed",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Complete response content here...",
        "tool_calls": [
          {
            "id": "call_12345",
            "type": "web_search_preview",
            "results": {
              "query": "New York weather today",
              "sources": ["weather.com", "accuweather.com"]
            }
          }
        ]
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 150,
    "total_tokens": 175,
    "reasoning_tokens": 500
  }
}
```

---

## Audio API

### Overview
The OpenAI Audio API provides speech-to-text, text-to-speech, and real-time audio capabilities using advanced models including Whisper for transcription and new steerable TTS models.

### Base URL
```
https://api.openai.com/v1/audio
```

---

## 3. Speech-to-Text (Transcriptions)

### Endpoint
```http
POST /v1/audio/transcriptions
```

### Request Format
```json
{
  "file": "audio_file.mp3",
  "model": "whisper-1",
  "language": "en",
  "response_format": "json",
  "temperature": 0,
  "timestamp_granularities": ["word", "segment"]
}
```

### cURL Example
```bash
curl -X POST "https://api.openai.com/v1/audio/transcriptions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@audio_file.mp3" \
  -F "model=whisper-1" \
  -F "language=en" \
  -F "response_format=verbose_json" \
  -F "timestamp_granularities[]=word"
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | Yes | Audio file (max 25MB) |
| `model` | string | Yes | Model ID ("whisper-1", "gpt-4o-transcribe") |
| `language` | string | No | ISO 639-1 language code |
| `prompt` | string | No | Optional text to guide style/continue previous audio |
| `response_format` | string | No | Format: "json", "text", "srt", "verbose_json", "vtt" |
| `temperature` | number | No | Sampling temperature 0-1 (default: 0) |
| `timestamp_granularities` | array | No | ["word", "segment"] for detailed timestamps |

### Supported File Formats
- mp3, mp4, mpeg, mpga, m4a, wav, webm, flac

### Response Formats

#### JSON Response
```json
{
  "text": "Hello, this is a transcribed audio file."
}
```

#### Verbose JSON Response
```json
{
  "task": "transcribe",
  "language": "english",
  "duration": 45.2,
  "text": "Hello, this is a transcribed audio file.",
  "words": [
    {
      "word": "Hello",
      "start": 0.1,
      "end": 0.5
    },
    {
      "word": "this",
      "start": 0.6,
      "end": 0.8
    }
  ],
  "segments": [
    {
      "id": 0,
      "seek": 0,
      "start": 0.0,
      "end": 5.0,
      "text": "Hello, this is a transcribed audio file.",
      "tokens": [15496, 11, 428, 318, 257, 26815, 6588, 2393, 2393, 13],
      "temperature": 0.0,
      "avg_logprob": -0.3,
      "compression_ratio": 1.2,
      "no_speech_prob": 0.02
    }
  ]
}
```

---

## 4. Speech Translation

### Endpoint
```http
POST /v1/audio/translations
```

### Request Format
```json
{
  "file": "foreign_audio.mp3",
  "model": "whisper-1",
  "response_format": "json",
  "temperature": 0
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | Yes | Audio file in any supported language |
| `model` | string | Yes | Model ID ("whisper-1") |
| `prompt` | string | No | Optional text to guide translation style |
| `response_format` | string | No | Format: "json", "text", "srt", "verbose_json", "vtt" |
| `temperature` | number | No | Sampling temperature 0-1 (default: 0) |

### Response Format
```json
{
  "text": "This is the English translation of the foreign audio."
}
```

---

## 5. Text-to-Speech

### Endpoint
```http
POST /v1/audio/speech
```

### Request Format
```json
{
  "model": "tts-1",
  "input": "Hello world! This is a test of the text-to-speech API.",
  "voice": "alloy",
  "response_format": "mp3",
  "speed": 1.0
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | "tts-1", "tts-1-hd", "gpt-4o-mini-tts" |
| `input` | string | Yes | Text to convert to audio (max 4096 characters) |
| `voice` | string | Yes | Voice ID: "alloy", "echo", "fable", "onyx", "nova", "shimmer" |
| `response_format` | string | No | Format: "mp3", "opus", "aac", "flac", "wav", "pcm" |
| `speed` | number | No | Playback speed 0.25-4.0 (default: 1.0) |

### Advanced TTS with Instructions (2025)
```json
{
  "model": "gpt-4o-mini-tts",
  "input": "Hello, how can I help you today?",
  "voice": "nova",
  "instructions": "Speak like a friendly and professional customer service representative",
  "response_format": "mp3",
  "speed": 1.0
}
```

### Response
Returns binary audio data in the specified format.

### cURL Example
```bash
curl -X POST "https://api.openai.com/v1/audio/speech" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "input": "Hello world!",
    "voice": "alloy"
  }' \
  --output speech.mp3
```

---

## Authentication

### API Key Authentication
All requests require an API key in the Authorization header:

```http
Authorization: Bearer sk-your-api-key-here
```

### Environment Variable
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

### Python Example
```python
from openai import OpenAI

client = OpenAI(api_key="sk-your-api-key-here")
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "error": {
    "message": "Invalid parameter: 'model' must be a valid model ID",
    "type": "invalid_request_error",
    "param": "model",
    "code": "invalid_parameter"
  }
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "message": "Invalid API key provided",
    "type": "invalid_request_error",
    "param": null,
    "code": "invalid_api_key"
  }
}
```

#### 429 Rate Limited
```json
{
  "error": {
    "message": "Rate limit exceeded. Please try again later.",
    "type": "rate_limit_error",
    "param": null,
    "code": "rate_limit_exceeded"
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": {
    "message": "The server encountered an error processing your request",
    "type": "server_error",
    "param": null,
    "code": "internal_server_error"
  }
}
```

---

## Best Practices

### 1. Responses API
- Use background processing for long-running tasks
- Enable streaming for real-time user experiences
- Leverage built-in tools instead of custom implementations
- Monitor reasoning token usage for cost optimization
- Use appropriate models based on task complexity

### 2. Audio API
- Keep audio files under 25MB limit
- Use appropriate response formats for your use case
- Set temperature to 0 for consistent transcriptions
- Use verbose JSON format when you need detailed metadata
- Consider file compression for large audio uploads

### 3. General
- Implement exponential backoff for rate limiting
- Store API keys securely (never in code)
- Monitor token usage and costs
- Use appropriate error handling for production applications
- Test with different model variants to optimize performance/cost

### 4. Performance Optimization
- Cache responses when appropriate
- Use streaming for better user experience
- Batch requests when possible
- Choose the right model for your specific use case
- Monitor response times and adjust accordingly

---

## Rate Limits

### Responses API
- Requests per minute: 500
- Tokens per minute: 200,000
- Requests per day: 10,000

### Audio API
- Requests per minute: 50
- Audio processing: 25MB file size limit

*Note: Rate limits may vary based on your usage tier and account status.*

---

## Pricing (2025)

### Responses API
- Input tokens: $2.50 per 1M tokens
- Output tokens: $10.00 per 1M tokens
- Reasoning tokens: $10.00 per 1M tokens
- Image input: $10.00 per 1M tokens
- Image generation: $40.00 per 1M tokens
- Cached inputs: 75% discount

### Audio API
- Whisper transcription: $0.006 per minute
- TTS (standard): $15.00 per 1M characters
- TTS HD: $30.00 per 1M characters

*Prices subject to change. Check OpenAI pricing page for current rates.*