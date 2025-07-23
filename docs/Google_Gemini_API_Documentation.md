# Google Gemini API Documentation
## Comprehensive Implementation Guide for Text/Chat and Audio APIs

---

## Table of Contents
1. [Text/Chat API](#textchat-api)
2. [Audio API](#audio-api) 
3. [Embeddings API](#embeddings-api)
4. [File API](#file-api)
5. [Authentication](#authentication)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)

---

## Text/Chat API

### Overview
The Gemini API provides powerful text generation and multimodal capabilities through the `generateContent` and `streamGenerateContent` methods, supporting text, images, audio, and video inputs.

### Base URL
```
https://generativelanguage.googleapis.com/v1beta
```

### Authentication
```http
x-goog-api-key: YOUR_API_KEY
Content-Type: application/json
```

---

## 1. Generate Content (Non-Streaming)

### Endpoint
```http
POST /v1beta/models/{model}:generateContent
```

### Available Models (2025)
- **gemini-2.5-pro**: State-of-the-art reasoning model with 1M token context
- **gemini-2.5-flash**: Optimized for speed and cost efficiency
- **gemini-2.5-flash-lite**: Lightweight model for simple tasks
- **gemini-2.0-flash**: Next-gen model with improved capabilities
- **gemini-1.5-pro**: Legacy model (limited availability for new projects)
- **gemini-1.5-flash**: Legacy model (limited availability for new projects)

### Request Format

#### Basic Text Request
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "What is the capital of France?"
        }
      ],
      "role": "user"
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 1024,
    "stopSequences": []
  },
  "safetySettings": [
    {
      "category": "HARM_CATEGORY_HARASSMENT",
      "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    }
  ]
}
```

#### Multimodal Request (Text + Image)
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Describe this image"
        },
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "base64_encoded_image_data"
          }
        }
      ],
      "role": "user"
    }
  ],
  "generationConfig": {
    "temperature": 0.4,
    "maxOutputTokens": 2048
  }
}
```

#### Chat Conversation Request
```json
{
  "contents": [
    {
      "parts": [{"text": "Hello, how are you?"}],
      "role": "user"
    },
    {
      "parts": [{"text": "Hello! I'm doing well, thank you. How can I help you today?"}],
      "role": "model"
    },
    {
      "parts": [{"text": "Can you help me with a coding problem?"}],
      "role": "user"
    }
  ],
  "systemInstruction": {
    "parts": [
      {
        "text": "You are a helpful coding assistant. Provide clear, detailed explanations."
      }
    ]
  }
}
```

#### Function Calling Request
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "What's the weather like in New York?"
        }
      ],
      "role": "user"
    }
  ],
  "tools": [
    {
      "functionDeclarations": [
        {
          "name": "get_weather",
          "description": "Get current weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "City name"
              },
              "unit": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "Temperature unit"
              }
            },
            "required": ["location"]
          }
        }
      ]
    }
  ]
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `contents` | array | Yes | Conversation history and current request |
| `model` | string | Yes | Model name (in URL path) |
| `generationConfig` | object | No | Generation parameters |
| `safetySettings` | array | No | Content safety configuration |
| `systemInstruction` | object | No | System-level instructions for model behavior |
| `tools` | array | No | Available functions for model to call |

### Generation Config Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 1.0 | Controls randomness (0.0-2.0) |
| `topK` | integer | 40 | Top-K sampling parameter |
| `topP` | number | 0.95 | Nucleus sampling parameter |
| `maxOutputTokens` | integer | 8192 | Maximum tokens in response |
| `stopSequences` | array | [] | Sequences that stop generation |
| `candidateCount` | integer | 1 | Number of response variants |
| `responseMimeType` | string | "text/plain" | Response format ("application/json" for JSON mode) |

### Response Format

#### Successful Response
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "The capital of France is Paris."
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE"
        }
      ]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 8,
    "candidatesTokenCount": 9,
    "totalTokenCount": 17
  }
}
```

#### Function Calling Response
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "get_weather",
              "args": {
                "location": "New York",
                "unit": "fahrenheit"
              }
            }
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP"
    }
  ]
}
```

---

## 2. Generate Content (Streaming)

### Endpoint
```http
POST /v1beta/models/{model}:streamGenerateContent
```

### Request Format
Same as non-streaming, with optional `stream: true` parameter.

### Response Format (Server-Sent Events)
```
data: {"candidates":[{"content":{"parts":[{"text":"The"}],"role":"model"},"safetyRatings":[...],"index":0}],"usageMetadata":{"promptTokenCount":8}}

data: {"candidates":[{"content":{"parts":[{"text":" capital"}],"role":"model"},"safetyRatings":[...],"index":0}]}

data: {"candidates":[{"content":{"parts":[{"text":" of France is Paris."}],"role":"model"},"finishReason":"STOP","safetyRatings":[...],"index":0}],"usageMetadata":{"candidatesTokenCount":9,"totalTokenCount":17}}
```

---

## Audio API

### Overview
The Gemini API provides native audio capabilities including text-to-speech (TTS) generation with controllable voice characteristics and audio understanding for multimodal inputs.

---

## 3. Text-to-Speech (Speech Generation)

### Endpoint
```http
POST /v1beta/models/gemini-2.5-flash-preview-tts:generateContent
```

### Available TTS Models
- **gemini-2.5-flash-preview-tts**: Price-performant TTS model
- **gemini-2.5-pro-preview-tts**: Most powerful TTS model with advanced control

### Request Format

#### Basic TTS Request
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Hello world! This is a test of Gemini's text-to-speech capabilities."
        }
      ]
    }
  ],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": {
          "voiceName": "Zephyr"
        }
      }
    }
  }
}
```

#### Multi-Speaker TTS Request
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Speaker 1: Hello there! Speaker 2: Hi, how are you doing today?"
        }
      ]
    }
  ],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "multiSpeakerVoiceConfig": {
          "speakers": [
            {
              "speaker": "SPEAKER_1",
              "voiceConfig": {
                "prebuiltVoiceConfig": {
                  "voiceName": "Puck"
                }
              }
            },
            {
              "speaker": "SPEAKER_2", 
              "voiceConfig": {
                "prebuiltVoiceConfig": {
                  "voiceName": "Charon"
                }
              }
            }
          ]
        }
      }
    }
  }
}
```

#### Styled TTS Request
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Welcome to our customer support line. How can I assist you today?"
        }
      ]
    }
  ],
  "systemInstruction": {
    "parts": [
      {
        "text": "Speak in a warm, professional customer service tone with a slight smile in your voice."
      }
    ]
  },
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": {
          "voiceName": "Nova"
        }
      }
    }
  }
}
```

### Available Voices (30+ Options)
- **Zephyr**: Bright and energetic
- **Puck**: Upbeat and playful
- **Charon**: Informative and authoritative
- **Nova**: Professional and clear
- **Echo**: Deep and resonant
- **Fable**: Storytelling voice
- **Onyx**: Sophisticated and mature
- **Shimmer**: Light and airy
- ... (22 additional voices available)

### TTS Response Format
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "inlineData": {
              "mimeType": "audio/wav",
              "data": "base64_encoded_audio_data"
            }
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "safetyRatings": []
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 15,
    "candidatesTokenCount": 0,
    "totalTokenCount": 15
  }
}
```

### Audio Format Specifications
- **Format**: audio/wav (PCM)
- **Sample Rate**: 24,000 Hz
- **Bit Depth**: 16-bit
- **Channels**: Mono
- **Context Window**: 32k tokens maximum

---

## 4. Audio Understanding (Input)

### Multimodal Audio Input
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Transcribe and summarize this audio clip"
        },
        {
          "inlineData": {
            "mimeType": "audio/wav",
            "data": "base64_encoded_audio_data"
          }
        }
      ]
    }
  ]
}
```

### Supported Audio Formats
- WAV (audio/wav)
- MP3 (audio/mp3)
- FLAC (audio/flac)
- AAC (audio/aac)
- OGG (audio/ogg)
- WEBM (audio/webm)

---

## Embeddings API

### Overview
Generate vector embeddings for text, images, and other content for semantic search, clustering, and similarity tasks.

---

## 5. Single Embedding

### Endpoint
```http
POST /v1beta/models/text-embedding-004:embedContent
```

### Available Embedding Models
- **text-embedding-004**: Latest model with configurable output dimensions
- **gemini-embedding-001**: Multimodal embedding model

### Request Format
```json
{
  "content": {
    "parts": [
      {
        "text": "What is the meaning of life?"
      }
    ]
  },
  "taskType": "SEMANTIC_SIMILARITY",
  "outputDimensionality": 768
}
```

### Task Types
- `SEMANTIC_SIMILARITY`: For semantic search and similarity tasks
- `CLASSIFICATION`: For classification tasks
- `CLUSTERING`: For clustering and grouping tasks
- `QUESTION_ANSWERING`: For Q&A applications
- `FACT_VERIFICATION`: For fact-checking tasks

### Response Format
```json
{
  "embedding": {
    "values": [-0.013168523, 0.008711934, -0.002899825, ...]
  }
}
```

---

## 6. Batch Embeddings

### Endpoint
```http
POST /v1beta/models/text-embedding-004:batchEmbedContents
```

### Request Format
```json
{
  "requests": [
    {
      "content": {
        "parts": [{"text": "First document to embed"}]
      },
      "taskType": "SEMANTIC_SIMILARITY"
    },
    {
      "content": {
        "parts": [{"text": "Second document to embed"}]
      },
      "taskType": "SEMANTIC_SIMILARITY"
    }
  ]
}
```

### Response Format
```json
{
  "embeddings": [
    {
      "values": [-0.013168523, 0.008711934, ...]
    },
    {
      "values": [0.025847195, -0.019283742, ...]
    }
  ]
}
```

---

## File API

### Overview
Upload and manage files for use with Gemini API, supporting images, audio, video, and documents.

---

## 7. Upload File

### Endpoint
```http
POST /v1beta/files
```

### Request Format (Multipart)
```http
Content-Type: multipart/related; boundary=boundary123

--boundary123
Content-Type: application/json

{
  "file": {
    "displayName": "sample_document.pdf"
  }
}

--boundary123
Content-Type: application/pdf

[Binary file data]

--boundary123--
```

### File Size Limits
- **Images**: Up to 20MB each, max 10 images per request
- **Audio**: Up to 15MB per file
- **Video**: Up to 2GB per file (gemini-2.0 models)
- **Documents**: Up to 15MB per file

### Supported File Types

#### Images
- JPEG, PNG, WebP, HEIC, HEIF

#### Audio
- WAV, MP3, AIFF, AAC, OGG, FLAC

#### Video  
- MP4, MPEG, MOV, AVI, FLV, MPG, WEBM, WMV, 3GPP

#### Documents
- PDF, TXT, HTML, CSV, XML, RTF

### Response Format
```json
{
  "file": {
    "name": "files/sample_document_123",
    "displayName": "sample_document.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": "1048576",
    "createTime": "2025-01-01T12:00:00.000Z",
    "updateTime": "2025-01-01T12:00:00.000Z",
    "expirationTime": "2025-01-03T12:00:00.000Z",
    "sha256Hash": "abcd1234...",
    "uri": "https://generativelanguage.googleapis.com/v1beta/files/sample_document_123",
    "state": "ACTIVE"
  }
}
```

---

## 8. List Files

### Endpoint
```http
GET /v1beta/files
```

### Query Parameters
- `pageSize`: Number of files to return (default: 10, max: 100)
- `pageToken`: Token for pagination

### Response Format
```json
{
  "files": [
    {
      "name": "files/document_123",
      "displayName": "document.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": "1048576",
      "createTime": "2025-01-01T12:00:00.000Z",
      "state": "ACTIVE"
    }
  ],
  "nextPageToken": "next_page_token_here"
}
```

---

## 9. Get File Details

### Endpoint
```http
GET /v1beta/files/{file_id}
```

### Response Format
Same as upload response format.

---

## 10. Delete File

### Endpoint
```http
DELETE /v1beta/files/{file_id}
```

### Response Format
```json
{}
```

---

## Utility APIs

## 11. Count Tokens

### Endpoint
```http
POST /v1beta/models/{model}:countTokens
```

### Request Format
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "How many tokens is this text?"
        }
      ]
    }
  ]
}
```

### Response Format
```json
{
  "totalTokens": 31,
  "totalBillableCharacters": 96,
  "promptTokensDetails": [
    {
      "modality": "TEXT",
      "tokenCount": 31
    }
  ]
}
```

---

## Authentication

### API Key Authentication
All requests require an API key in the header:

```http
x-goog-api-key: YOUR_API_KEY
```

### Alternative: Query Parameter
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=YOUR_API_KEY
```

### Environment Variable
```bash
export GEMINI_API_KEY="your-api-key-here"
```

### Obtaining API Keys
1. Visit [Google AI Studio](https://makersuite.google.com/)
2. Create a new project or select existing one
3. Generate API key in the settings
4. Ensure proper quotas and billing setup

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "error": {
    "code": 400,
    "message": "Invalid JSON payload received",
    "status": "INVALID_ARGUMENT",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.BadRequest",
        "fieldViolations": [
          {
            "field": "contents",
            "description": "contents is required"
          }
        ]
      }
    ]
  }
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "code": 401,
    "message": "API key not valid. Please pass a valid API key",
    "status": "UNAUTHENTICATED"
  }
}
```

#### 429 Rate Limited
```json
{
  "error": {
    "code": 429,
    "message": "Quota exceeded for project",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```

#### 500 Internal Server Error
```json
{
  "error": {
    "code": 500,
    "message": "An internal error occurred",
    "status": "INTERNAL"
  }
}
```

### Safety Blocking
```json
{
  "candidates": [
    {
      "finishReason": "SAFETY",
      "safetyRatings": [
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "HIGH"
        }
      ]
    }
  ]
}
```

---

## Best Practices

### 1. Text/Chat API
- Use appropriate models based on task complexity and cost requirements
- Implement conversation memory for chat applications  
- Set reasonable `maxOutputTokens` to control costs
- Use system instructions for consistent behavior
- Handle safety blocks gracefully
- Cache responses when appropriate

### 2. Audio API
- Optimize audio file sizes before upload
- Use appropriate voice selection for your use case
- Consider multi-speaker scenarios for conversational content
- Test different speech styles through system instructions
- Handle large audio files by chunking when necessary

### 3. Embeddings API
- Choose appropriate task types for your use case
- Use batch operations for efficiency with multiple texts
- Store embeddings for reuse to reduce costs
- Consider output dimensionality based on your downstream tasks
- Implement proper similarity search algorithms

### 4. File Management
- Clean up unused files regularly (they expire automatically)
- Use appropriate file formats for your content type
- Monitor file storage quotas
- Validate file uploads before processing
- Handle file processing states properly

### 5. General
- Implement exponential backoff for retries
- Monitor token usage and costs
- Use streaming for better user experience
- Set appropriate safety settings for your application
- Test thoroughly with edge cases

---

## Rate Limits and Quotas

### API Rate Limits
- **Requests per minute**: 300 (varies by model)
- **Tokens per minute**: 32,000 (varies by model)
- **Requests per day**: 50,000

### File Upload Limits
- **Uploads per day**: 1,000 files
- **Storage quota**: 20GB per project

### Cost Optimization
- Use cheaper models (Flash vs Pro) when possible
- Implement request caching
- Optimize prompt lengths
- Use batch operations for embeddings
- Monitor usage through Google Cloud Console

---

## Pricing (2025)

### Text Generation
- **Gemini 2.5 Pro**: $1.25 per 1M input tokens, $3.75 per 1M output tokens
- **Gemini 2.5 Flash**: $0.075 per 1M input tokens, $0.30 per 1M output tokens
- **Gemini 2.0 Flash**: $0.15 per 1M input tokens, $0.60 per 1M output tokens

### Audio
- **TTS Models**: $3.00 per 1M characters
- **Audio Input**: $0.25 per minute of audio

### Embeddings
- **Text Embedding 004**: $0.25 per 1M tokens
- **Gemini Embedding**: $0.125 per 1M tokens

### File Storage
- **Storage**: $0.01 per GB per day

*Prices subject to change. Check Google AI pricing page for current rates.*

---

## SDK Examples

### Python
```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel('gemini-2.5-pro')
response = model.generate_content("Hello world")
print(response.text)
```

### JavaScript
```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("YOUR_API_KEY");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const result = await model.generateContent("Hello world");
console.log(result.response.text());
```

### cURL
```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent" \
  -H "x-goog-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Hello world"}]
    }]
  }'
```