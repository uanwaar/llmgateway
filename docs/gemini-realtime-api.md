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
  "responseModalities": ["TEXT"],
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

<!-- Transcription enablement is documented in the Realtime Transcription section to avoid duplication. -->

## Realtime Transcription

This section focuses on real-time speech-to-text (STT) for user audio and optional text transcription of model audio output. It consolidates setup, streaming, and event handling so you can wire Gemini Live into a voice UX quickly and reliably.

### Enable transcription in setup

- For voice sessions, set `responseModalities` to `AUDIO` and toggle transcription:
  - `inputAudioTranscription`: emits live transcripts of user speech.
  - `outputAudioTranscription`: emits live transcripts aligned with model-generated audio.

Example setup (fragment):
```json
{
  "setup": {
    "model": "gemini-live-2.5-flash-preview",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "temperature": 0.7
    },
    "speechConfig": {
      "languageCode": "en-US",
      "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": "Kore" } }
    },
    "inputAudioTranscription": {},
    "outputAudioTranscription": {}
  }
}
```

Notes
- Use `AUDIO` for response modality in speech-first sessions. Text-only (`TEXT`) sessions can still enable input transcription to show live captions while the model returns text.
- Native audio models auto-detect language; half-cascade models respect `speechConfig.languageCode`.

### Stream audio correctly

- Use the input format from Audio Format Requirements (PCM16, 16 kHz, mono, little‑endian; MIME: `audio/pcm;rate=16000`).
- Chunking: send small frames frequently for low latency.
  - 20–50 ms per chunk works well (20 ms at 16 kHz ≈ 320 samples ≈ 640 bytes; 40 ms ≈ 1280 bytes).
  - Base64-encode the raw PCM chunk and send as `realtimeInput.audio` messages.
- Example client chunk message:
```json
{
  "realtimeInput": {
    "audio": { "data": "base64_pcm_chunk", "mimeType": "audio/pcm;rate=16000" }
  }
}
```

### Voice Activity Detection (VAD) and turns

- Automatic VAD (recommended): configure sensitivity in `realtimeInputConfig.automaticActivityDetection`. The server detects start/end of speech and completes the user turn automatically.
- Manual VAD: disable automatic detection and bracket speech with activity markers.
  - Start of user speech:
    ```json
    { "realtimeInput": { "activityStart": {} } }
    ```
  - End of user speech:
    ```json
    { "realtimeInput": { "activityEnd": {} } }
    ```
  - After `activityEnd`, you can mark a boundary with `clientContent.turnComplete: true` if you're also sending text turns. Note: `turnComplete` does not suppress model output; it only closes the turn.

SDK vs raw payload shape
- SDKs typically accept markers at the top level, e.g. `sendRealtimeInput({ activityStart: {} })` and `sendRealtimeInput({ activityEnd: {} })`.
- The raw WebSocket message shape is `{ "realtimeInput": { "activityStart": {} } }` and `{ "realtimeInput": { "activityEnd": {} } }`.

Transcription‑only (no modelTurn commentary)
- The API will generate a `modelTurn` at turn end unless you prevent or ignore it. Options:
  - Prefer instructions: keep `responseModalities: ["TEXT"]` and use a strict system instruction like “Only transcribe; do not respond.” (works well with auto VAD).
  - Client-side: ignore/drop `serverContent.modelTurn` events if you only need transcripts.
  - Note: setting `maxOutputTokens` to 0 is not allowed by Live API (must be positive) and may also prevent transcript delivery; avoid this approach. Set to 1 to minimise the output response.

### Receiving transcripts (input and output)

With transcription enabled:
- You will receive live, incremental (partial) and final transcripts for user audio (input) and model audio (output) within the realtime stream.
- SDKs expose transcript fields on streamed responses (for example, properties for input/output transcription events). Expect fields indicating whether a transcript segment is final vs partial.
- For text responses (when `TEXT` is the response modality), transcripts arrive as normal `modelTurn.parts[].text`; for `AUDIO` responses, output transcripts arrive as transcription events alongside the audio chunks.

Practical tips
- Render partial input transcripts as captions immediately; replace them when the final segment arrives.
- Output transcripts are handy for accessibility and for building transcripts/SRT/VTT after a call.

### Barge-in and interruption

- If the user speaks while the model is talking, automatic VAD can trigger an interruption (barge-in). The server signals this with `interrupted: true` in `serverContent`.
- You can also proactively barge-in by starting a new user activity (`activityStart`) or sending new `clientContent` while output audio is playing.
- On interruption, stop playing current TTS frames, then continue streaming input audio; the model will pivot to the new user turn.

### Observability and quotas

- Use `usageMetadata` to monitor token usage. Audio input contributes to prompt tokens; output audio contributes to response tokens.
- See Rate Limits for session duration limits; enable context window compression for longer-running calls.

### Common pitfalls to avoid

- Sample rate mismatch: ensure 16 kHz input; resample if your capture device is 44.1/48 kHz.
- Stereo input: downmix to mono before encoding.
- Endianness: ensure little-endian for PCM16; incorrect endianness yields garbled audio and poor ASR.
- Large chunks: sending multi-second chunks increases latency and harms VAD; prefer 20–50 ms frames.
- Backpressure: respect network backpressure and avoid uncontrolled buffering when UI thread is slow.

### Minimal flow checklist

- [ ] Connect with Live API using the SDK, set `responseModalities` and speech/voice config.
- [ ] Enable `inputAudioTranscription` (and `outputAudioTranscription` if you need captions for TTS).
- [ ] Stream base64 PCM16 16 kHz mono frames every 20–50 ms.
- [ ] Use automatic VAD or send `activityStart`/`activityEnd` markers for manual control.
- [ ] Handle partial and final transcripts for input/output.
- [ ] Implement barge-in by stopping TTS on `interrupted: true` and accepting new input.


<!-- VAD configuration and markers are covered under Realtime Transcription > Voice Activity Detection (VAD) and turns to avoid duplication. -->

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