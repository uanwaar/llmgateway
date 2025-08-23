# Gemini Realtime API Documentation

> **Preview**: The Live API is in preview.

## Overview

The Gemini Live API enables low-latency, real-time voice and video interactions with Gemini models. It processes continuous streams of audio, video, or text to deliver immediate, human-like spoken responses, creating a natural conversational experience.

### Key Features

- **Real-time streaming**: Continuous audio, video, and text input/output
- **Voice Activity Detection (VAD)**: Automatic interruption detection and handling
- **Multiple modalities**: Support for text, audio, and video
- **Tool use and function calling**: Integration with external systems
- **Session management**: Long-running conversation handling
- **Ephemeral tokens**: Secure client-sided authentication

## Models and Audio Generation

### Native Audio Models
Provides the most natural and realistic-sounding speech with better multilingual performance:
- `gemini-2.5-flash-preview-native-audio-dialog`
- `gemini-2.5-flash-exp-native-audio-thinking-dialog`

Features:
- Affective (emotion-aware) dialogue
- Proactive audio (model can decide to ignore certain inputs)
- "Thinking" capabilities
- Context window: 128k tokens

### Half-Cascade Audio Models
Uses cascaded model architecture (native audio input + text-to-speech output):
- `gemini-live-2.5-flash-preview`
- `gemini-2.0-flash-live-001`

Features:
- Better performance and reliability in production
- Better tool use support
- Context window: 32k tokens

## Connection Architecture

### WebSocket Endpoint

> **Note**: While the API operates over WebSockets, it is **strongly recommended to use the official Google GenAI SDKs** (e.g., for Node.js, Python). The SDKs handle the complex requirements of authentication, connection, and message formatting, which is difficult to implement correctly from scratch.

```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
```

### Implementation Approaches

While the Live API communicates over WebSockets, the recommended best practice is to use the official Google GenAI SDKs for your language (e.g., `@google/genai` for Node.js, `google-generativeai` for Python). The SDKs handle the complexities of connection management, authentication, and message formatting, providing a much more stable and developer-friendly experience.

#### Server-to-Server
- Your backend connects to the Live API using a Google GenAI SDK.
- The client (e.g., a web or mobile app) sends user data to your server, which then securely interacts with the Gemini API.
- **Recommended for most production applications** as it keeps API keys secure.

#### Client-to-Server
- The frontend connects directly to the Live API using a Google GenAI SDK and an ephemeral, single-use token.
- **Lower latency and simpler setup**, but requires a secure mechanism on your backend to mint and provide ephemeral tokens to the client.
- Use ephemeral tokens to mitigate the risk of exposing long-lived credentials.

## Session Configuration

### Basic Setup Message
```json
{
  "setup": {
    "model": "gemini-live-2.5-flash-preview",
    "generationConfig": {
      "responseModalities": ["TEXT", "AUDIO"],
      "temperature": 0.7,
      "maxOutputTokens": 8192
    },
    "systemInstruction": "You are a helpful assistant...",
    "tools": []
  }
}
```

### Response Modalities
- **TEXT**: Text responses only
- **AUDIO**: Audio responses only
- Note: Only one modality per session

## Audio Configuration

### Audio Format Requirements
- **Input**: 16-bit PCM, 16kHz, mono, little-endian
- **Output**: 16-bit PCM, 24kHz, mono, little-endian
- **MIME Type**: `audio/pcm;rate=16000` (for input)

### Voice Configuration
```json
{
  "speechConfig": {
    "voiceConfig": {
      "prebuiltVoiceConfig": {
        "voiceName": "Kore"
      }
    },
    "languageCode": "en-US"
  }
}
```

Available voices vary by model type:
- **Half-cascade**: Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr
- **Native audio**: Full TTS voice list available

### Audio Transcription
Enable input/output transcription:
```json
{
  "inputAudioTranscription": {},
  "outputAudioTranscription": {}
}
```

## Voice Activity Detection (VAD)

### Automatic VAD (Default)
```json
{
  "realtimeInputConfig": {
    "automaticActivityDetection": {
      "disabled": false,
      "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
      "endOfSpeechSensitivity": "END_SENSITIVITY_HIGH",
      "prefixPaddingMs": 20,
      "silenceDurationMs": 100
    }
  }
}
```

### Manual VAD
```json
{
  "realtimeInputConfig": {
    "automaticActivityDetection": {
      "disabled": true
    }
  }
}
```

When disabled, send activity markers:
```json
{
  "realtimeInput": {
    "activityStart": {}
  }
}
```

## Message Types

### Client Messages

#### Setup Message
```json
{
  "setup": {
    "model": "string",
    "generationConfig": {},
    "systemInstruction": "string",
    "tools": []
  }
}
```

#### Client Content
```json
{
  "clientContent": {
    "turns": [
      {
        "role": "user",
        "parts": [{"text": "Hello!"}]
      }
    ],
    "turnComplete": true
  }
}
```

#### Realtime Input
```json
{
  "realtimeInput": {
    "audio": {
      "data": "base64_audio_data",
      "mimeType": "audio/pcm;rate=16000"
    }
  }
}
```

#### Tool Response
```json
{
  "toolResponse": {
    "functionResponses": [
      {
        "name": "function_name",
        "id": "call_id",
        "response": {}
      }
    ]
  }
}
```

### Server Messages

#### Server Content
```json
{
  "serverContent": {
    "modelTurn": {
      "role": "model",
      "parts": [{"text": "Response text"}]
    },
    "turnComplete": true,
    "interrupted": false
  }
}
```

#### Tool Call
```json
{
  "toolCall": {
    "functionCalls": [
      {
        "name": "function_name",
        "id": "call_id",
        "args": {}
      }
    ]
  }
}
```

## Session Management

### Context Window Compression
Enable unlimited session duration:
```json
{
  "contextWindowCompression": {
    "slidingWindow": {
      "targetTokens": 16000
    },
    "triggerTokens": 32000
  }
}
```

### Session Resumption
Maintain sessions across connection resets:
```json
{
  "sessionResumption": {
    "handle": "previous_session_handle"
  }
}
```

## Ephemeral Tokens

### Creating Tokens
```python
import datetime
from google import genai

client = genai.Client(http_options={'api_version': 'v1alpha'})
now = datetime.datetime.now(tz=datetime.timezone.utc)

token = client.auth_tokens.create(
    config={
        'uses': 1,
        'expire_time': now + datetime.timedelta(minutes=30),
        'new_session_expire_time': now + datetime.timedelta(minutes=1)
    }
)
```

### Using Tokens
- Pass as `access_token` query parameter
- Or in HTTP Authorization header with "Token" prefix
- Only works with Live API and v1alpha version

## Native Audio Capabilities

### Affective Dialog
Enables emotion-aware responses:
```python
client = genai.Client(http_options={"api_version": "v1alpha"})
config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    enable_affective_dialog=True
)
```

### Proactive Audio
Model can choose not to respond to irrelevant input:
```python
config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    proactivity={'proactive_audio': True}
)
```

### Thinking Mode
Available with `gemini-2.5-flash-exp-native-audio-thinking-dialog`:
```python
model = "gemini-2.5-flash-exp-native-audio-thinking-dialog"
config = types.LiveConnectConfig(response_modalities=["AUDIO"])
```

## Supported Languages

| Language | Code | Native Audio | Language | Code | Native Audio |
|----------|------|--------------|----------|------|--------------|
| English (US) | en-US | ✓ | German | de-DE | ✓ |
| English (UK) | en-GB | ❌ | French | fr-FR | ✓ |
| Spanish (US) | es-US | ✓ | Japanese | ja-JP | ✓ |
| Spanish (Spain) | es-ES | ❌ | Korean | ko-KR | ✓ |
| Portuguese | pt-BR | ✓ | Chinese | cmn-CN | ❌ |
| Italian | it-IT | ✓ | Dutch | nl-NL | ✓ |
| Hindi | hi-IN | ✓ | Russian | ru-RU | ✓ |

*Native audio models automatically choose language and don't support explicit language codes*

## Rate Limits and Quotas

### Session Duration
- **Audio-only**: 15 minutes (without compression)
- **Audio + Video**: 2 minutes (without compression)
- **With compression**: Unlimited

### Connection Limits
- Connection lifetime: ~10 minutes
- Use session resumption for longer sessions

### Context Limits
- **Native audio models**: 128k tokens
- **Other models**: 32k tokens

## Error Handling

### Interruption Handling
```json
{
  "serverContent": {
    "interrupted": true
  }
}
```

### Connection Termination
```json
{
  "goAway": {
    "timeLeft": "10s"
  }
}
```

### Tool Call Cancellation
```json
{
  "toolCallCancellation": {
    "ids": ["call_id_1", "call_id_2"]
  }
}
```

## Usage Metadata

Track token consumption:
```json
{
  "usageMetadata": {
    "promptTokenCount": 100,
    "responseTokenCount": 150,
    "totalTokenCount": 250,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 50
      },
      {
        "modality": "AUDIO",
        "tokenCount": 50
      }
    ]
  }
}
```

## Best Practices

### Security
- Use ephemeral tokens for client-to-server implementations
- Set short expiration times for tokens
- Verify backend authentication security
- Avoid using ephemeral tokens for backend-to-Gemini connections

### Performance
- Use client-to-server for lowest latency
- Enable context window compression for long sessions
- Configure appropriate VAD sensitivity settings
- Use session resumption for connection reliability

### Audio Quality
- Ensure proper audio format (16-bit PCM, 16kHz, mono)
- Use native audio models for highest quality
- Configure appropriate voice settings
- Enable transcription for debugging

### Development
- Test with AI Studio first
- Use partner integrations (Daily, LiveKit, Voximplant) for simpler setup
- Monitor usage metadata for cost optimization
- Implement proper error handling for interruptions

## Example Implementations

### Basic Text Chat
```python
import asyncio
from google import genai

client = genai.Client()
model = "gemini-live-2.5-flash-preview"

async def main():
    config = {"response_modalities": ["TEXT"]}
    
    async with client.aio.live.connect(model=model, config=config) as session:
        await session.send_client_content(
            turns={"role": "user", "parts": [{"text": "Hello!"}]},
            turn_complete=True
        )
        
        async for response in session.receive():
            if response.text:
                print(response.text)
```

### Audio Streaming
```python
async def audio_stream():
    config = {"response_modalities": ["AUDIO"]}
    
    async with client.aio.live.connect(model=model, config=config) as session:
        # Send audio data
        await session.send_realtime_input(
            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
        )
        
        # Receive audio response
        async for response in session.receive():
            if response.data:
                # Process audio data
                audio_output.write(response.data)
```

## Integration Notes

This documentation covers the essential aspects needed to implement Gemini Live API in the llmgateway application. Key considerations for integration:

1. **WebSocket Management**: Implement proper connection handling with reconnection logic
2. **Audio Processing**: Set up audio encoding/decoding pipelines
3. **Session State**: Maintain session context and resumption tokens
4. **Error Recovery**: Handle interruptions and connection failures gracefully
5. **Token Management**: Implement ephemeral token generation and refresh logic