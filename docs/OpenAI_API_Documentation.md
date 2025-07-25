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

## OpenAI Models
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
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "What is the weather like today in New York?"
        }
      ]
    }
  ],
  "stream": false
}
```

#### Advanced Request with Tools and Streaming
```json
{
  "model": "gpt-4o",
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "Analyze this data and create a visualization"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "https://example.com/data-chart.png"
          }
        }
      ]
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
  "stream": true,
  "stream_options": {
    "include_usage": true
  },
  "max_completion_tokens": 4096,
  "temperature": 0.7
}
```

#### Background Processing Request
```json
{
  "model": "gpt-4o",
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "Perform a comprehensive analysis of this 100-page document"
        }
      ]
    }
  ],
  "tools": [
    {
      "type": "file_search",
      "file_search": {
        "vector_store_ids": ["vs_12345"]
      }
    }
  ],
  "background": true,
  "max_completion_tokens": 16384
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model ID (e.g., "gpt-4o", "gpt-4o-mini", "o1", "o1-mini") |
| `input` | array | Yes | List of input items comprising the conversation |
| `tools` | array | No | Array of tools the model may call |
| `tool_choice` | string/object | No | Controls which tools are called ("none", "auto", "required", or specific tool) |
| `stream` | boolean | No | Enable streaming responses (default: false) |
| `stream_options` | object | No | Options for streaming response (only when stream=true) |
| `background` | boolean | No | Run the response in the background (default: false) |
| `max_completion_tokens` | integer | No | Maximum tokens in response completion |
| `temperature` | number | No | Sampling temperature 0-2 (default: 1) |
| `top_p` | number | No | Nucleus sampling parameter (default: 1) |
| `frequency_penalty` | number | No | Penalty for frequency of tokens (-2.0 to 2.0) |
| `presence_penalty` | number | No | Penalty for presence of tokens (-2.0 to 2.0) |

### Available Models
- **gpt-4o**: Latest GPT-4 Omni model with multimodal capabilities
- **gpt-4o-mini**: Efficient GPT-4 Omni model for cost optimization
- **o3**: Advanced reasoning model with enhanced chain-of-thought
- **o3-mini**: Efficient reasoning model with focused capabilities

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
  "created_at": 1704067200,
  "model": "gpt-4o",
  "status": "completed",
  "output": [
    {
      "id": "msg_12345",
      "type": "message",
      "status": "completed",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "The weather in New York today is partly cloudy with a high of 72°F."
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 15,
    "output_tokens": 20,
    "total_tokens": 35,
    "output_tokens_details": {
      "reasoning_tokens": 150
    }
  },
  "reasoning": {
    "effort": null,
    "summary": "I searched for current weather information for New York City and found reliable meteorological data."
  }
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
            "web_search_preview": {
              "query": "New York weather today",
              "results": [
                {
                  "title": "Current Weather in New York",
                  "url": "https://weather.com/weather/today/l/New+York+NY",
                  "snippet": "Current conditions and forecast"
                }
              ]
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
    "total_tokens": 175
  }
}
```

---

## 3. Cancel Response

### Endpoint
```http
POST /v1/responses/{response_id}/cancel
```

### Purpose
Cancels a Response that is currently in progress. Useful for stopping long-running background responses or streaming responses that are no longer needed.

### Response Format
```json
{
  "id": "resp_12345",
  "object": "response",
  "status": "cancelled",
  "cancelled_at": 1704067200
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

## 4. Speech-to-Text (Transcriptions)

### Endpoint
```http
POST /v1/audio/transcriptions
```

### Request Format

#### Basic Transcription
```json
{
  "file": "audio_file.mp3",
  "model": "whisper-1",
  "language": "en",
  "response_format": "json",
  "temperature": 0
}
```

#### Advanced Transcription with New Models
```json
{
  "file": "audio_file.mp3",
  "model": "gpt-4o-transcribe",
  "language": "en",
  "response_format": "json",
  "temperature": 0,
  "stream": true,
  "chunking_strategy": "auto",
  "include": ["logprobs"],
  "timestamp_granularities": ["word", "segment"]
}
```

#### Server VAD Chunking Strategy
```json
{
  "file": "audio_file.mp3",
  "model": "gpt-4o-mini-transcribe",
  "chunking_strategy": {
    "type": "server_vad",
    "server_vad": {
      "threshold": 0.5,
      "prefix_padding_ms": 300,
      "silence_timeout_ms": 500
    }
  }
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
| `file` | file | Yes | Audio file (max 25MB). Formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm |
| `model` | string | Yes | Available models: "whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe" |
| `language` | string | No | ISO 639-1 language code for input audio |
| `prompt` | string | No | Optional text to guide model's style or continue previous audio segment |
| `response_format` | string | No | "json", "text", "srt", "verbose_json", "vtt" (gpt-4o models only support "json") |
| `temperature` | number | No | Sampling temperature 0-1 (default: 0) |
| `timestamp_granularities` | array | No | ["word", "segment"] - requires verbose_json format |
| `stream` | boolean | No | Enable streaming (only for gpt-4o-transcribe/gpt-4o-mini-transcribe) |
| `chunking_strategy` | string/object | No | "auto" or custom server_vad object for audio chunking |
| `include` | array | No | ["logprobs"] for confidence scores (gpt-4o models only) |

### Supported File Formats
- **Audio**: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
- **Size Limit**: 25MB maximum
- **Duration**: No explicit limit, but longer files may have higher latency

### Model Capabilities

#### whisper-1
- Based on open source Whisper V2
- Supports all response formats
- No streaming support
- No logprobs support

#### gpt-4o-transcribe
- Enhanced transcription accuracy
- Streaming support with server-sent events
- Logprobs support for confidence scoring
- Only supports JSON response format
- Advanced chunking strategies

#### gpt-4o-mini-transcribe
- Cost-optimized version of gpt-4o-transcribe
- Same features as gpt-4o-transcribe
- Faster processing for shorter audio files

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

#### JSON Response with Logprobs (gpt-4o models)
```json
{
  "text": "Hello, this is a transcribed audio file.",
  "logprobs": [
    {
      "token": "Hello",
      "logprob": -0.1,
      "start": 0.1,
      "end": 0.5
    },
    {
      "token": ",",
      "logprob": -0.05,
      "start": 0.5,
      "end": 0.6
    }
  ]
}
```

#### Streaming Response Format
```
data: {"text": "Hello", "x_start": 0.1, "x_end": 0.5}

data: {"text": ", this is a", "x_start": 0.5, "x_end": 1.2}

data: {"text": " transcribed audio file.", "x_start": 1.2, "x_end": 2.8}

data: [DONE]
```

---

## 5. Speech Translation

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
| `file` | file | Yes | Audio file in any supported language (max 25MB) |
| `model` | string | Yes | Currently only "whisper-1" available |
| `prompt` | string | No | Optional text to guide translation style |
| `response_format` | string | No | Format: "json", "text", "srt", "verbose_json", "vtt" |
| `temperature` | number | No | Sampling temperature 0-1 (default: 0) |

### Response Format
```json
{
  "text": "This is the English translation of the foreign audio."
}
```

**Note**: Translation automatically converts any supported language to English. No streaming support currently available.

---

## 6. Text-to-Speech

### Endpoint
```http
POST /v1/audio/speech
```

### Request Format

#### Basic TTS Request
```json
{
  "model": "tts-1",
  "input": "Hello world! This is a test of the text-to-speech API.",
  "voice": "alloy",
  "response_format": "mp3",
  "speed": 1.0
}
```

#### Advanced TTS with Voice Instructions
```json
{
  "model": "gpt-4o-mini-tts",
  "input": "Hello, how can I help you today?",
  "voice": "nova",
  "instructions": "Speak like a friendly and professional customer service representative with a warm, welcoming tone",
  "response_format": "mp3",
  "speed": 1.0
}
```

#### Streaming TTS Request
```json
{
  "model": "gpt-4o-mini-tts",
  "input": "This is a streaming text-to-speech example that will be delivered in real-time chunks.",
  "voice": "alloy",
  "stream_format": "sse",
  "response_format": "mp3"
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | "tts-1", "tts-1-hd", "gpt-4o-mini-tts" |
| `input` | string | Yes | Text to convert to audio (max 4096 characters) |
| `voice` | string | Yes | Available voices (see Voice Options below) |
| `instructions` | string | No | Voice control instructions (gpt-4o-mini-tts only) |
| `response_format` | string | No | "mp3", "opus", "aac", "flac", "wav", "pcm" (default: mp3) |
| `speed` | number | No | Playback speed 0.25-4.0 (default: 1.0) |
| `stream_format` | string | No | "sse" for server-sent events, "audio" for direct stream |

### Voice Options
**Standard Voices**: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
**Extended Voices**: `ash`, `ballad`, `coral`, `sage`, `verse`

### Model Capabilities

#### tts-1
- Standard quality text-to-speech
- All voice options supported
- No streaming support
- No voice instructions

#### tts-1-hd
- High-definition audio quality
- All voice options supported
- No streaming support
- No voice instructions

#### gpt-4o-mini-tts
- Advanced voice synthesis
- Voice instruction support
- Server-sent events streaming
- Enhanced voice control and expressiveness

### Response Formats

#### Standard Response
Returns binary audio data in the specified format.

#### Streaming Response (SSE Format)
```
event: audio.delta
data: {"delta": "<base64_audio_chunk>"}

event: audio.delta
data: {"delta": "<base64_audio_chunk>"}

event: audio.done
data: {"done": true}
```

### cURL Examples

#### Basic TTS
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

#### Advanced TTS with Instructions
```bash
curl -X POST "https://api.openai.com/v1/audio/speech" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini-tts",
    "input": "Welcome to our service!",
    "voice": "nova",
    "instructions": "Sound enthusiastic and welcoming"
  }' \
  --output speech.mp3
```

#### Streaming TTS
```bash
curl -X POST "https://api.openai.com/v1/audio/speech" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini-tts",
    "input": "This will stream in real-time",
    "voice": "alloy",
    "stream_format": "sse"
  }'
```

---

## Streaming Implementation Guide

### Overview
OpenAI APIs support comprehensive streaming capabilities using Server-Sent Events (SSE) format, enabling real-time processing for responses, audio transcription, and text-to-speech.

---

## 7. Responses API Streaming

### Enabling Streaming
```json
{
  "model": "gpt-4o",
  "input": [
    {
      "role": "user", 
      "content": [
        {
          "type": "input_text",
          "text": "Tell me a story"
        }
      ]
    }
  ],
  "stream": true,
  "stream_options": {
    "include_usage": true
  }
}
```

### Stream Event Types

#### Core Response Events
- `response.created`: Response object created
- `response.in_progress`: Response generation started
- `response.completed`: Response finished successfully
- `response.failed`: Response failed with error
- `response.incomplete`: Response stopped before completion

#### Content Events
- `response.output_item.added`: New output item added
- `response.content_part.added`: Content part added to output
- `response.output_text.delta`: Text content delta
- `response.output_text.done`: Text output completed

#### Tool Call Events
- `response.function_call_arguments.delta`: Function call arguments streaming
- `response.function_call_arguments.done`: Function call arguments complete
- `response.web_search_call.added`: Web search initiated
- `response.code_interpreter_call.added`: Code interpreter execution started
- `response.file_search_call.added`: File search operation started
- `response.image_generation_call.added`: Image generation started

#### Advanced Events
- `response.reasoning_summary_part.added`: Reasoning summary part added
- `response.reasoning_summary_text.delta`: Reasoning summary text delta
- `response.mcp_call_arguments.delta`: MCP tool arguments streaming
- `response.mcp_list_tools.added`: MCP tools list operation

### Example Streaming Response
```
event: response.created
data: {"id":"resp_12345","object":"response","status":"in_progress","created":1704067200}

event: response.output_item.added
data: {"response_id":"resp_12345","output_index":0,"item":{"id":"item_1","type":"message"}}

event: response.content_part.added
data: {"response_id":"resp_12345","item_id":"item_1","part":{"type":"text"}}

event: response.output_text.delta
data: {"response_id":"resp_12345","item_id":"item_1","part_index":0,"delta":"Once upon"}

event: response.output_text.delta
data: {"response_id":"resp_12345","item_id":"item_1","part_index":0,"delta":" a time"}

event: response.output_text.done
data: {"response_id":"resp_12345","item_id":"item_1","part_index":0}

event: response.completed
data: {"response_id":"resp_12345","usage":{"prompt_tokens":10,"completion_tokens":25,"total_tokens":35}}
```

---

## 8. Audio Transcription Streaming

### Supported Models
- ✅ `gpt-4o-transcribe` - Full streaming support
- ✅ `gpt-4o-mini-transcribe` - Full streaming support
- ❌ `whisper-1` - No streaming support

### Streaming Request
```json
{
  "file": "audio_file.mp3",
  "model": "gpt-4o-transcribe",
  "stream": true,
  "chunking_strategy": "auto"
}
```

### Streaming Response Format
```
data: {"text": "Hello", "x_start": 0.1, "x_end": 0.5}

data: {"text": ", welcome to", "x_start": 0.5, "x_end": 1.2}

data: {"text": " our service", "x_start": 1.2, "x_end": 2.0}

data: [DONE]
```

### Chunking Strategies for Streaming

#### Auto Chunking
```json
{"chunking_strategy": "auto"}
```
- Server automatically normalizes audio loudness
- Uses Voice Activity Detection (VAD) for optimal chunk boundaries
- Recommended for most use cases

#### Server VAD Chunking
```json
{
  "chunking_strategy": {
    "type": "server_vad",
    "server_vad": {
      "threshold": 0.5,
      "prefix_padding_ms": 300,
      "silence_timeout_ms": 500
    }
  }
}
```

---

## 9. Text-to-Speech Streaming

### Supported Models
- ✅ `gpt-4o-mini-tts` - Server-sent events streaming
- ❌ `tts-1` - No streaming support
- ❌ `tts-1-hd` - No streaming support

### Streaming Request
```json
{
  "model": "gpt-4o-mini-tts",
  "input": "This text will be converted to streaming audio",
  "voice": "alloy",
  "stream_format": "sse"
}
```

### Stream Format Options
- `"sse"`: Server-sent events with base64 encoded audio chunks
- `"audio"`: Direct audio streaming (binary data)

### SSE Streaming Response
```
event: audio.delta
data: {"delta": "<base64_encoded_audio_chunk>"}

event: audio.delta
data: {"delta": "<base64_encoded_audio_chunk>"}

event: audio.done
data: {"done": true}
```

---

## 10. Client Implementation Best Practices

### JavaScript/TypeScript Example
```javascript
const eventSource = new EventSource('/api/stream-endpoint');

eventSource.addEventListener('response.output_text.delta', (event) => {
  const data = JSON.parse(event.data);
  appendToUI(data.delta);
});

eventSource.addEventListener('response.completed', (event) => {
  const data = JSON.parse(event.data);
  console.log('Usage:', data.usage);
  eventSource.close();
});

eventSource.addEventListener('error', (event) => {
  console.error('Stream error:', event);
  eventSource.close();
});
```

### Python Example
```python
import requests
import json

def stream_response(payload):
    response = requests.post(
        'https://api.openai.com/v1/responses',
        headers={'Authorization': 'Bearer YOUR_API_KEY'},
        json=payload,
        stream=True
    )
    
    for line in response.iter_lines():
        if line.startswith(b'data: '):
            data = line[6:].decode('utf-8')
            if data == '[DONE]':
                break
            try:
                event_data = json.loads(data)
                yield event_data
            except json.JSONDecodeError:
                continue
```

### Error Handling for Streams
```javascript
eventSource.addEventListener('response.failed', (event) => {
  const error = JSON.parse(event.data);
  console.error('Response failed:', error.error);
  // Implement retry logic or user notification
});

eventSource.addEventListener('error', (event) => {
  // Network error or connection lost
  console.error('Connection error');
  // Implement reconnection logic
});
```

### Performance Optimization
1. **Buffer Management**: Implement proper buffering for audio streams
2. **Chunk Processing**: Process text deltas incrementally for better UX
3. **Connection Monitoring**: Monitor connection health and implement reconnection
4. **Resource Cleanup**: Always close EventSource connections when done

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
- Enable streaming for real-time transcription with gpt-4o models
- Use auto chunking strategy for optimal streaming performance

### 3. Streaming Implementation
- Always implement proper error handling for stream connections
- Use EventSource for browser-based streaming implementations
- Implement connection monitoring and automatic reconnection
- Buffer audio streams appropriately to prevent playback issues
- Close streaming connections when no longer needed
- Handle network interruptions gracefully with retry logic

### 4. General
- Implement exponential backoff for rate limiting
- Store API keys securely (never in code)
- Monitor token usage and costs
- Use appropriate error handling for production applications
- Test with different model variants to optimize performance/cost

### 5. Performance Optimization
- Cache non-streaming responses when appropriate
- Use streaming for better user experience in real-time applications
- Batch non-streaming requests when possible
- Choose the right model for your specific use case
- Monitor response times and adjust accordingly
- Optimize chunking strategies for audio processing
- Implement client-side buffering for smooth audio playback

---

## Rate Limits

### Responses API
- Requests per minute: 500 (non-streaming)
- Streaming requests per minute: 100
- Tokens per minute: 200,000
- Requests per day: 10,000

### Audio API
- Transcription requests per minute: 50
- Streaming transcription requests per minute: 25
- TTS requests per minute: 50
- Streaming TTS requests per minute: 25
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
- Streaming: No additional cost

### Audio API
#### Transcription
- Whisper-1: $0.006 per minute
- GPT-4o-transcribe: $0.012 per minute
- GPT-4o-mini-transcribe: $0.008 per minute
- Streaming: No additional cost

#### Text-to-Speech
- TTS-1: $15.00 per 1M characters
- TTS-1-HD: $30.00 per 1M characters
- GPT-4o-mini-TTS: $25.00 per 1M characters
- Streaming: No additional cost

*Prices subject to change. Check OpenAI pricing page for current rates.*