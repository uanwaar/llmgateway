# API Request Validation Guide

This document explains how to make requests to the LLM Gateway API and understand the validation system that protects against malformed requests while maintaining maximum flexibility.

## Table of Contents

- [Overview](#overview)
- [Request Validation Philosophy](#request-validation-philosophy)
- [Chat Completions API](#chat-completions-api)
- [Embeddings API](#embeddings-api)
- [Audio API](#audio-api)
- [Validation Errors](#validation-errors)
- [Making Requests](#making-requests)
- [Troubleshooting](#troubleshooting)

## Overview

The LLM Gateway uses **ultra-flexible validation** that:
- ✅ **Accepts** all valid OpenAI-compatible requests
- ✅ **Supports** both OpenAI and Gemini parameters
- ✅ **Allows** custom/unknown parameters for future compatibility
- ✅ **Prevents** genuinely malformed requests
- ✅ **Preserves** content exactly as sent (no sanitization of chat content)

## Request Validation Philosophy

### What We Validate (Minimal Constraints)
- **Required fields only**: `model` and `messages` for chat completions
- **Data types**: Ensure strings are strings, numbers are numbers
- **Array length**: Messages array must have at least 1 item
- **Basic ranges**: Temperature between 0-5, max_tokens > 0

### What We DON'T Validate (Maximum Flexibility)
- ❌ Strict parameter values (allows future API changes)
- ❌ Unknown/custom parameters (forwards to provider)
- ❌ Content sanitization (preserves chat content exactly)
- ❌ Strict model name validation (supports new models automatically)
- ❌ Request size limits (handles large contexts)

## Chat Completions API

### Endpoint
```
POST /v1/chat/completions
```

### Required Fields
```json
{
  "model": "string (required)",
  "messages": [
    {
      "role": "string (required)", 
      "content": "any format (required)"
    }
  ]
}
```

### Supported Parameters

#### OpenAI Parameters
```json
{
  "model": "gpt-4o-mini",
  "messages": [...],
  "temperature": 0.7,          // 0-5 range
  "top_p": 1.0,               // 0-1 range
  "n": 1,                     // 1-20 range
  "stream": false,
  "stop": "string or array",
  "max_tokens": 1000,         // min: 1, no upper limit
  "presence_penalty": 0,      // -2 to 2
  "frequency_penalty": 0,     // -2 to 2
  "logit_bias": {},
  "user": "string",
  "response_format": {},
  "seed": 123,
  "tools": [],
  "tool_choice": "auto",
  "functions": [],            // Legacy
  "function_call": "auto"     // Legacy
}
```

#### Gemini Parameters
```json
{
  "model": "gemini-2.5-flash",
  "messages": [...],
  "safety_settings": [],
  "generation_config": {}
}
```

#### Custom Parameters
```json
{
  "model": "any-model",
  "messages": [...],
  "custom_param": "anything",
  "experimental_feature": true,
  "provider_specific": {
    "setting": "value"
  }
}
```

### Message Formats

#### Simple Text
```json
{
  "role": "user",
  "content": "Hello, world!"
}
```

#### Multimodal (Images)
```json
{
  "role": "user", 
  "content": [
    {"type": "text", "text": "What's in this image?"},
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
  ]
}
```

#### Custom Roles
```json
{
  "role": "custom_role",      // Any role accepted
  "content": "Custom content",
  "metadata": {"key": "value"} // Unknown fields preserved
}
```

## Embeddings API

### Endpoint
```
POST /v1/embeddings
```

### Required Fields
```json
{
  "input": "text or array (required)",
  "model": "string (required)"
}
```

### Flexible Input Formats
```json
{
  "input": "Single string",           // String
  "model": "text-embedding-3-small"
}
```

```json
{
  "input": ["Multiple", "strings"],   // Array of strings
  "model": "text-embedding-3-small"
}
```

```json
{
  "input": [1, 2, 3, 4],             // Array of numbers
  "model": "text-embedding-3-small"
}
```

```json
{
  "input": {"custom": "format"},      // Object format
  "model": "text-embedding-3-small"
}
```

### Optional Parameters
```json
{
  "input": "text",
  "model": "text-embedding-3-small",
  "encoding_format": "float",         // Any format accepted
  "dimensions": 1536,                 // Min: 1
  "user": "user-id",
  "custom_embedding_param": "value"   // Unknown params accepted
}
```

## Audio API

### Transcription Endpoint
```
POST /v1/audio/transcriptions
```

### Translation Endpoint  
```
POST /v1/audio/translations
```

### Speech Synthesis Endpoint
```
POST /v1/audio/speech
```

### Flexible Parameters
The audio endpoints accept any parameters and forward them to the appropriate provider, allowing for:
- OpenAI Whisper parameters
- Gemini audio parameters  
- Custom audio processing settings

## Validation Errors

### Error Response Format
```json
{
  "error": {
    "name": "ValidationError",
    "message": "Request validation failed", 
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "details": {
      "field": "body.model",
      "value": null,
      "validationErrors": [
        {
          "field": "body.model",
          "message": "\"body.model\" is required"
        }
      ]
    },
    "timestamp": "2025-07-25T06:25:25.053Z"
  }
}
```

### Common Validation Errors

#### Missing Required Fields
```json
// Request: {"messages": [...]}
// Error: "body.model" is required

// Request: {"model": "gpt-4"}  
// Error: "body.messages" is required
```

#### Empty Messages Array
```json
// Request: {"model": "gpt-4", "messages": []}
// Error: "body.messages" must contain at least 1 items
```

#### Invalid Data Types
```json
// Request: {"model": 123, "messages": [...]}
// Error: "body.model" must be a string

// Request: {"model": "gpt-4", "messages": "not an array"}
// Error: "body.messages" must be an array
```

#### Missing Message Fields
```json
// Request: {"messages": [{"content": "hello"}]}
// Error: "body.messages[0].role" is required

// Request: {"messages": [{"role": "user"}]}  
// Error: "body.messages[0].content" is required
```

## Making Requests

### cURL Examples

#### Basic Chat Completion
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### Windows Command Line (Recommended)
```bash
echo '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello!"}]}' | curl -X POST http://localhost:3000/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" --data @-
```

#### Complex Request with Custom Parameters
```bash
echo '{
  "model": "gpt-4o-mini",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain quantum computing"}
  ],
  "temperature": 0.7,
  "max_tokens": 500,
  "stream": false,
  "custom_setting": "experimental",
  "provider_config": {
    "optimization": "speed"
  }
}' | curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  --data @-
```

#### Streaming Request
```bash
echo '{
  "model": "gpt-4o-mini", 
  "messages": [{"role": "user", "content": "Count from 1 to 10"}],
  "stream": true
}' | curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  --data @-
```

### JavaScript Examples

#### Using Fetch
```javascript
const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key'
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
    temperature: 0.7,
    max_tokens: 100,
    // Custom parameters are automatically preserved
    customParameter: 'value',
    experimentalFeature: true
  })
});

const data = await response.json();
console.log(data);
```

#### Using OpenAI SDK (Compatible)
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'your-api-key',
  baseURL: 'http://localhost:3000/v1'  // Point to LLM Gateway
});

const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  // All OpenAI parameters supported
  // Custom parameters also work
});
```

### Python Examples

#### Using Requests
```python
import requests

response = requests.post(
    'http://localhost:3000/v1/chat/completions',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key'
    },
    json={
        'model': 'gpt-4o-mini',
        'messages': [
            {'role': 'user', 'content': 'Hello!'}
        ],
        'temperature': 0.7,
        'max_tokens': 100,
        # Custom parameters preserved
        'custom_param': 'value'
    }
)

data = response.json()
print(data)
```

#### Using OpenAI SDK (Compatible)
```python
from openai import OpenAI

client = OpenAI(
    api_key='your-api-key',
    base_url='http://localhost:3000/v1'  # Point to LLM Gateway
)

completion = client.chat.completions.create(
    model='gpt-4o-mini',
    messages=[
        {'role': 'user', 'content': 'Hello!'}
    ],
    temperature=0.7
)

print(completion.choices[0].message.content)
```

## Troubleshooting

### Common Issues

#### 1. JSON Parsing Errors
```
Error: "Bad escaped character in JSON at position X"
```
**Solution**: Use file input or echo pipe instead of inline JSON in curl:
```bash
# Instead of: -d '{"complex":"json"}'
# Use: echo '{"complex":"json"}' | curl --data @-
```

#### 2. Validation Errors with Valid Requests
If you receive validation errors for seemingly valid requests:
1. Check that `model` and `messages` fields are present
2. Ensure `messages` is an array with at least one item  
3. Verify each message has `role` and `content` fields
4. Check JSON syntax with a validator

#### 3. Middleware Headers
All requests include these headers for debugging:
- `X-Correlation-ID`: Request tracking ID
- `X-RateLimit-*`: Rate limiting information
- `X-Cache`: Cache hit/miss status

#### 4. Provider-Specific Parameters
The gateway forwards unknown parameters to providers:
- OpenAI parameters → OpenAI API
- Gemini parameters → Gemini API  
- Custom parameters → Forwarded as-is

### Getting Help

1. **Check validation errors**: Look at the `details.validationErrors` array
2. **Verify required fields**: Ensure `model` and `messages` are present
3. **Test with minimal request**: Start with basic request and add parameters
4. **Check provider documentation**: Some parameters are provider-specific

### Debug Mode

Enable debug logging by setting environment variable:
```bash
NODE_ENV=development
```

This provides detailed request/response logs including:
- Request validation details
- Parameter forwarding information  
- Provider-specific processing
- Cache and rate limiting status

## Best Practices

1. **Always include required fields**: `model` and `messages`
2. **Use appropriate data types**: Strings for text, numbers for numeric values
3. **Handle validation errors gracefully**: Check status codes and error messages
4. **Leverage flexibility**: Include custom parameters for future compatibility
5. **Test with different providers**: OpenAI and Gemini may handle parameters differently
6. **Use correlation IDs**: Include in logs for request tracking
7. **Monitor rate limits**: Check `X-RateLimit-*` headers

---

*This validation system ensures compatibility with existing OpenAI clients while providing flexibility for future API evolution and multi-provider support.*