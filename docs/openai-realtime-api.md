# OpenAI Realtime API Reference

This document provides comprehensive reference and implementation guide for the OpenAI Realtime API, which enables low-latency, multimodal interactions including speech-to-speech conversational experiences and real-time transcription.

## Overview

The Realtime API allows you to communicate with GPT-4o class models in real time using WebRTC or WebSockets. It supports:
- Text and audio inputs and outputs
- Audio transcriptions with Whisper-1, GPT-4o Transcribe, and GPT-4o mini Transcribe
- Function calling in real-time contexts
- Real-time conversation management
- Voice Activity Detection (VAD)
- Multiple connection methods optimized for different use cases

## Getting Started

Just getting started with Realtime? Try the new [Agents SDK for TypeScript](https://openai.github.io/openai-agents-js), optimized for building voice agents with Realtime models.

You can connect to the Realtime API in two ways:
- **WebRTC**: Ideal for client-side applications (web browsers, mobile apps)
- **WebSockets**: Great for server-to-server applications and voice agents over phone

### Example Applications

- **[Realtime Console](https://github.com/openai/openai-realtime-console)**: Demo showing events and function calling
- **[Solar System Demo](https://github.com/openai/openai-realtime-solar-system)**: WebRTC integration with voice navigation
- **[Twilio Integration](https://github.com/openai/openai-realtime-twilio-demo)**: AI calling assistant
- **[Realtime Agents Demo](https://github.com/openai/openai-realtime-agents)**: Agent handoffs with reasoning validation

### Partner Integrations

- **[LiveKit](https://docs.livekit.io/agents/openai/overview/)**: WebRTC infrastructure integration
- **[Twilio](https://www.twilio.com/en-us/blog/twilio-openai-realtime-api-launch-integration)**: Voice APIs integration
- **[Agora](https://docs.agora.io/en/open-ai-integration/get-started/quickstart)**: Real-time audio communication
- **[Pipecat](https://docs.pipecat.ai/guides/features/openai-audio-models-and-apis)**: Voice agent orchestration
- **[Stream](https://getstream.io/video/voice-agents/)**: Mobile and web voice agents

## Use Cases

The most common use case is building real-time, speech-to-speech conversational experiences for voice agents and voice-enabled applications.

The API can also be used independently for:
- **Transcription**: Streaming audio with real-time transcripts
- **Turn Detection**: Automatic detection when users finish speaking
- **Voice Activity Detection**: Built-in VAD for seamless conversation handling

## Connection Methods

### WebRTC Connection

WebRTC is recommended for client-side applications like web browsers. It provides better handling of variable connection states and convenient APIs for audio capture and playback.

**Connection Details:**
- URL: `https://api.openai.com/v1/realtime`
- Query Parameters: `model` (e.g., `gpt-4o-realtime-preview-2025-06-03`)
- Headers: `Authorization: Bearer EPHEMERAL_KEY`

**Security Note**: Use ephemeral tokens for client-side WebRTC connections. Standard API keys should only be used server-side.

#### WebRTC Implementation Example

```javascript
async function initWebRTC() {
  // Get ephemeral key from your server
  const tokenResponse = await fetch("/session");
  const data = await tokenResponse.json();
  const EPHEMERAL_KEY = data.client_secret.value;

  // Create peer connection
  const pc = new RTCPeerConnection();

  // Set up remote audio playback
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = e => audioEl.srcObject = e.streams[0];

  // Add local microphone
  const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
  pc.addTrack(ms.getTracks()[0]);

  // Set up data channel for events
  const dc = pc.createDataChannel("oai-events");
  dc.addEventListener("message", (e) => {
    console.log("Server event:", JSON.parse(e.data));
  });

  // Initialize session
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-realtime-preview-2025-06-03";
  const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp"
    },
  });

  const answer = {
    type: "answer",
    sdp: await sdpResponse.text(),
  };
  await pc.setRemoteDescription(answer);

  return { pc, dc };
}
```

### WebSocket Connection

WebSockets are ideal for server-to-server applications and provide more granular control over audio handling.

**Connection Details:**
- URL: `wss://api.openai.com/v1/realtime`
- Query Parameters: `model` (for conversations) or `intent=transcription` (for transcription-only)
- Headers: `Authorization: Bearer YOUR_API_KEY`, `OpenAI-Beta: realtime=v1`

#### WebSocket Implementation Examples

**Node.js (ws module):**
```javascript
import WebSocket from "ws";

const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";
const ws = new WebSocket(url, {
  headers: {
    "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
    "OpenAI-Beta": "realtime=v1",
  },
});

ws.on("open", function open() {
  console.log("Connected to server.");
});

ws.on("message", function incoming(message) {
  const event = JSON.parse(message.toString());
  console.log("Received:", event);
});
```

**Python (websocket-client):**
```python
import os
import json
import websocket

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17"
headers = [
    "Authorization: Bearer " + OPENAI_API_KEY,
    "OpenAI-Beta: realtime=v1"
]

def on_open(ws):
    print("Connected to server.")

def on_message(ws, message):
    data = json.loads(message)
    print("Received event:", json.dumps(data, indent=2))

ws = websocket.WebSocketApp(
    url,
    header=headers,
    on_open=on_open,
    on_message=on_message,
)

ws.run_forever()
```

## Session Tokens

### Create Session

Creates an ephemeral API token for use in client-side applications with the Realtime API.

**Endpoint:** `POST https://api.openai.com/v1/realtime/sessions`

**Request Body:**
```json
{
  "model": "gpt-4o-realtime-preview",
  "modalities": ["audio", "text"],
  "instructions": "You are a friendly assistant.",
  "voice": "alloy",
  "input_audio_format": "pcm16",
  "output_audio_format": "pcm16",
  "input_audio_transcription": {
    "model": "whisper-1"
  },
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 200
  },
  "tools": [],
  "tool_choice": "auto",
  "temperature": 0.8,
  "max_response_output_tokens": "inf",
  "speed": 1.0
}
```

**Parameters:**

- `input_audio_format` (string, optional): Format of input audio. Options: `pcm16`, `g711_ulaw`, `g711_alaw`. Default: `pcm16`
- `input_audio_noise_reduction` (object, optional): Configuration for input audio noise reduction
- `input_audio_transcription` (object, optional): Configuration for input audio transcription
- `instructions` (string, optional): Default system instructions prepended to model calls
- `max_response_output_tokens` (integer or "inf", optional): Maximum output tokens for a single response
- `modalities` (array, optional): Set of modalities the model can respond with. To disable audio: `["text"]`
- `model` (string, optional): The Realtime model for this session
- `output_audio_format` (string, optional): Format of output audio. Default: `pcm16`
- `speed` (number, optional): Speed of spoken response (0.25-1.5). Default: 1.0
- `temperature` (number, optional): Sampling temperature (0.6-1.2). Default: 0.8
- `tool_choice` (string, optional): How model chooses tools: `auto`, `none`, `required`, or specify function
- `tools` (array, optional): Tools (functions) available to the model
- `turn_detection` (object, optional): Configuration for turn detection (Server VAD or Semantic VAD)
- `voice` (string, optional): Voice for responses: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`

**Response:**
```json
{
  "id": "sess_001",
  "object": "realtime.session",
  "model": "gpt-4o-realtime-preview",
  "modalities": ["audio", "text"],
  "instructions": "You are a friendly assistant.",
  "voice": "alloy",
  "input_audio_format": "pcm16",
  "output_audio_format": "pcm16",
  "client_secret": {
    "value": "ek_abc123",
    "expires_at": 1234567890
  }
}
```

### Create Transcription Session

Creates an ephemeral API token specifically for realtime transcriptions.

**Endpoint:** `POST https://api.openai.com/v1/realtime/transcription_sessions`

**Request Body:**
```json
{
  "input_audio_format": "pcm16",
  "input_audio_transcription": {
    "model": "gpt-4o-transcribe",
    "language": null,
    "prompt": ""
  },
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 200
  }
}
```

## Client Events

These are events that the client can send to the OpenAI Realtime WebSocket server.

### session.update

Updates the session's default configuration.

```json
{
  "event_id": "event_123",
  "type": "session.update",
  "session": {
    "modalities": ["text", "audio"],
    "instructions": "You are a helpful assistant.",
    "voice": "sage",
    "input_audio_format": "pcm16",
    "output_audio_format": "pcm16",
    "temperature": 0.8
  }
}
```

### input_audio_buffer.append

Appends audio bytes to the input audio buffer.

```json
{
  "event_id": "event_456",
  "type": "input_audio_buffer.append",
  "audio": "Base64EncodedAudioData"
}
```

### input_audio_buffer.commit

Commits the user input audio buffer, creating a new user message item.

```json
{
  "event_id": "event_789",
  "type": "input_audio_buffer.commit"
}
```

### input_audio_buffer.clear

Clears the audio bytes in the buffer.

```json
{
  "event_id": "event_012",
  "type": "input_audio_buffer.clear"
}
```

### conversation.item.create

Adds a new item to the conversation's context.

```json
{
  "event_id": "event_345",
  "type": "conversation.item.create",
  "previous_item_id": null,
  "item": {
    "id": "msg_001",
    "type": "message",
    "role": "user",
    "content": [
      {
        "type": "input_text",
        "text": "Hello, how are you?"
      }
    ]
  }
}
```

### conversation.item.retrieve

Retrieves a specific item from conversation history.

```json
{
  "event_id": "event_901",
  "type": "conversation.item.retrieve",
  "item_id": "msg_003"
}
```

### conversation.item.truncate

Truncates a previous assistant message's audio.

```json
{
  "event_id": "event_678",
  "type": "conversation.item.truncate",
  "item_id": "msg_002",
  "content_index": 0,
  "audio_end_ms": 1500
}
```

### conversation.item.delete

Removes an item from conversation history.

```json
{
  "event_id": "event_901",
  "type": "conversation.item.delete",
  "item_id": "msg_003"
}
```

### response.create

Instructs the server to create a response (trigger model inference).

```json
{
  "event_id": "event_234",
  "type": "response.create",
  "response": {
    "modalities": ["text", "audio"],
    "instructions": "Please assist the user.",
    "voice": "sage",
    "temperature": 0.8,
    "max_output_tokens": 1024
  }
}
```

### response.cancel

Cancels an in-progress response.

```json
{
  "event_id": "event_567",
  "type": "response.cancel"
}
```

### transcription_session.update

Updates a transcription session.

```json
{
  "type": "transcription_session.update",
  "session": {
    "input_audio_format": "pcm16",
    "input_audio_transcription": {
      "model": "gpt-4o-transcribe",
      "prompt": "",
      "language": ""
    }
  }
}
```

### output_audio_buffer.clear

WebRTC Only: Cuts off the current audio response.

```json
{
  "event_id": "optional_client_event_id",
  "type": "output_audio_buffer.clear"
}
```

## Server Events

These are events emitted from the OpenAI Realtime WebSocket server to the client.

### error

Returned when an error occurs.

```json
{
  "event_id": "event_890",
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "code": "invalid_event",
    "message": "The 'type' field is missing.",
    "param": null,
    "event_id": "event_567"
  }
}
```

### session.created

Emitted automatically when a new connection is established.

```json
{
  "event_id": "event_1234",
  "type": "session.created",
  "session": {
    "id": "sess_001",
    "object": "realtime.session",
    "model": "gpt-4o-realtime-preview",
    "modalities": ["text", "audio"],
    "instructions": "...model instructions here...",
    "voice": "sage"
  }
}
```

### session.updated

Returned when a session is updated.

```json
{
  "event_id": "event_5678",
  "type": "session.updated",
  "session": {
    "id": "sess_001",
    "object": "realtime.session",
    "model": "gpt-4o-realtime-preview",
    "modalities": ["text"],
    "instructions": "New instructions"
  }
}
```

### conversation.created

Emitted when a conversation is created.

```json
{
  "event_id": "event_9101",
  "type": "conversation.created",
  "conversation": {
    "id": "conv_001",
    "object": "realtime.conversation"
  }
}
```

### conversation.item.created

Emitted when a conversation item is created.

```json
{
  "event_id": "event_1920",
  "type": "conversation.item.created",
  "previous_item_id": "msg_002",
  "item": {
    "id": "msg_003",
    "object": "realtime.item",
    "type": "message",
    "status": "completed",
    "role": "user",
    "content": []
  }
}
```

### conversation.item.input_audio_transcription.completed

Emitted when input audio transcription is completed.

```json
{
  "event_id": "event_2122",
  "type": "conversation.item.input_audio_transcription.completed",
  "item_id": "msg_003",
  "content_index": 0,
  "transcript": "Hello, how are you?",
  "usage": {
    "type": "tokens",
    "total_tokens": 48,
    "input_tokens": 38,
    "output_tokens": 10
  }
}
```

### response.created

Emitted when a new response is created.

```json
{
  "event_id": "event_2930",
  "type": "response.created",
  "response": {
    "id": "resp_001",
    "object": "realtime.response",
    "status": "in_progress",
    "output": [],
    "usage": null
  }
}
```

### response.done

Emitted when a response is complete.

```json
{
  "event_id": "event_3132",
  "type": "response.done",
  "response": {
    "id": "resp_001",
    "object": "realtime.response",
    "status": "completed",
    "output": [
      {
        "id": "msg_006",
        "object": "realtime.item",
        "type": "message",
        "status": "completed",
        "role": "assistant",
        "content": [
          {
            "type": "text",
            "text": "Sure, how can I assist you today?"
          }
        ]
      }
    ],
    "usage": {
      "total_tokens": 275,
      "input_tokens": 127,
      "output_tokens": 148
    }
  }
}
```

### response.output_item.added

Emitted when a new item is created during response generation.

```json
{
  "event_id": "event_3334",
  "type": "response.output_item.added",
  "response_id": "resp_001",
  "output_index": 0,
  "item": {
    "id": "msg_007",
    "object": "realtime.item",
    "type": "message",
    "status": "in_progress",
    "role": "assistant",
    "content": []
  }
}
```

### response.content_part.added

Emitted when a new content part is added to an assistant message.

```json
{
  "event_id": "event_3738",
  "type": "response.content_part.added",
  "response_id": "resp_001",
  "item_id": "msg_007",
  "output_index": 0,
  "content_index": 0,
  "part": {
    "type": "text",
    "text": ""
  }
}
```

### response.text.delta

Emitted when the text value of a content part is updated.

```json
{
  "event_id": "event_4142",
  "type": "response.text.delta",
  "response_id": "resp_001",
  "item_id": "msg_007",
  "output_index": 0,
  "content_index": 0,
  "delta": "Sure, I can h"
}
```

### response.text.done

Emitted when text content is complete.

```json
{
  "event_id": "event_4344",
  "type": "response.text.done",
  "response_id": "resp_001",
  "item_id": "msg_007",
  "output_index": 0,
  "content_index": 0,
  "text": "Sure, I can help with that."
}
```

### response.audio_transcript.delta

Emitted when model-generated audio transcription is updated.

```json
{
  "event_id": "event_4546",
  "type": "response.audio_transcript.delta",
  "response_id": "resp_001",
  "item_id": "msg_008",
  "output_index": 0,
  "content_index": 0,
  "delta": "Hello, how can I a"
}
```

### response.audio_transcript.done

Emitted when audio transcription is complete.

```json
{
  "event_id": "event_4748",
  "type": "response.audio_transcript.done",
  "response_id": "resp_001",
  "item_id": "msg_008",
  "output_index": 0,
  "content_index": 0,
  "transcript": "Hello, how can I assist you today?"
}
```

### response.audio.delta

Emitted when model-generated audio is updated.

```json
{
  "event_id": "event_4950",
  "type": "response.audio.delta",
  "response_id": "resp_001",
  "item_id": "msg_008",
  "output_index": 0,
  "content_index": 0,
  "delta": "Base64EncodedAudioDelta"
}
```

### response.audio.done

Emitted when model-generated audio is complete.

```json
{
  "event_id": "event_5152",
  "type": "response.audio.done",
  "response_id": "resp_001",
  "item_id": "msg_008",
  "output_index": 0,
  "content_index": 0
}
```

### response.function_call_arguments.delta

Emitted when function call arguments are updated.

```json
{
  "event_id": "event_5354",
  "type": "response.function_call_arguments.delta",
  "response_id": "resp_002",
  "item_id": "fc_001",
  "output_index": 0,
  "call_id": "call_001",
  "delta": "{\"location\": \"San\""
}
```

### response.function_call_arguments.done

Emitted when function call arguments are complete.

```json
{
  "event_id": "event_5556",
  "type": "response.function_call_arguments.done",
  "response_id": "resp_002",
  "item_id": "fc_001",
  "output_index": 0,
  "call_id": "call_001",
  "arguments": "{\"location\": \"San Francisco\"}"
}
```

### input_audio_buffer.committed

Emitted when the input audio buffer is committed.

```json
{
  "event_id": "event_1121",
  "type": "input_audio_buffer.committed",
  "previous_item_id": "msg_001",
  "item_id": "msg_002"
}
```

### input_audio_buffer.cleared

Emitted when the input audio buffer is cleared.

```json
{
  "event_id": "event_1314",
  "type": "input_audio_buffer.cleared"
}
```

### input_audio_buffer.speech_started

Emitted in server VAD mode when speech is detected.

```json
{
  "event_id": "event_1516",
  "type": "input_audio_buffer.speech_started",
  "audio_start_ms": 1000,
  "item_id": "msg_003"
}
```

### input_audio_buffer.speech_stopped

Emitted in server VAD mode when speech ends.

```json
{
  "event_id": "event_1718",
  "type": "input_audio_buffer.speech_stopped",
  "audio_end_ms": 2000,
  "item_id": "msg_003"
}
```

### rate_limits.updated

Emitted at the beginning of a response to indicate updated rate limits.

```json
{
  "event_id": "event_5758",
  "type": "rate_limits.updated",
  "rate_limits": [
    {
      "name": "requests",
      "limit": 1000,
      "remaining": 999,
      "reset_seconds": 60
    },
    {
      "name": "tokens",
      "limit": 50000,
      "remaining": 49950,
      "reset_seconds": 60
    }
  ]
}
```

## Audio Formats

### PCM16
- 16-bit PCM audio
- 24kHz sample rate
- Single channel (mono)
- Little-endian byte order

### G.711 μ-law and A-law
- 8kHz sample rate
- Single channel (mono)

## Voice Options

Available voices for audio responses:
- `alloy`
- `ash`
- `ballad`
- `coral`
- `echo`
- `sage`
- `shimmer`
- `verse`

Note: Voice cannot be changed during the session once the model has responded with audio.

## Voice Activity Detection (VAD)

VAD automatically detects when users start and stop speaking, enabled by default in both conversation and transcription modes.

### Server VAD (Default)

Uses periods of silence to automatically chunk audio. Best for most applications.

**Configuration:**
```json
{
  "type": "server_vad",
  "threshold": 0.5,           // Activation threshold (0-1, higher = less sensitive)
  "prefix_padding_ms": 300,    // Audio before detected speech (ms)
  "silence_duration_ms": 500,  // Silence duration to detect speech stop (ms)
  "create_response": true,     // Auto-create responses (conversation mode)
  "interrupt_response": true   // Allow interrupting responses
}
```

**Tuning Guidelines:**
- **Higher threshold**: Better for noisy environments
- **Shorter silence_duration_ms**: Faster turn detection
- **Longer prefix_padding_ms**: Captures more context before speech

### Semantic VAD (Advanced)

Uses semantic understanding to detect when users finish speaking. Reduces interruptions and provides more natural conversation flow.

**Configuration:**
```json
{
  "type": "semantic_vad",
  "eagerness": "medium",       // "low" | "medium" | "high" | "auto"
  "create_response": true,
  "interrupt_response": true
}
```

**Eagerness Levels:**
- **Low**: Lets users take their time, larger transcript chunks
- **Medium/Auto**: Balanced approach (default)
- **High**: Faster responses, quicker chunking

### Disabling VAD

For manual control (push-to-talk interfaces):
```json
{
  "turn_detection": null
}
```

When disabled, manually send:
- `input_audio_buffer.commit` to create user input
- `response.create` to trigger responses
- `input_audio_buffer.clear` before new input

### VAD Events

- `input_audio_buffer.speech_started`: User starts speaking
- `input_audio_buffer.speech_stopped`: User stops speaking
- `input_audio_buffer.committed`: Audio buffer committed for processing

## Function Calling

The Realtime API supports function calling to extend model capabilities with custom code execution.

### Function Calling Flow

1. **Configure functions** in session or response
2. **Model determines** need to call function based on input
3. **Client receives** function call arguments
4. **Execute custom code** using the arguments
5. **Return results** to model for final response

### Configuring Functions

```javascript
const event = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "get_weather",
        description: "Get current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "City name"
            },
            unit: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              description: "Temperature unit"
            }
          },
          required: ["location"]
        }
      }
    ],
    tool_choice: "auto"
  }
};

dataChannel.send(JSON.stringify(event));
```

### Handling Function Calls

```javascript
function handleEvent(e) {
  const serverEvent = JSON.parse(e.data);
  
  if (serverEvent.type === "response.done") {
    const output = serverEvent.response.output[0];
    
    if (output.type === "function_call") {
      // Execute function
      const args = JSON.parse(output.arguments);
      const result = await executeFunction(output.name, args);
      
      // Return result to model
      const resultEvent = {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: output.call_id,
          output: JSON.stringify(result)
        }
      };
      
      dataChannel.send(JSON.stringify(resultEvent));
      
      // Trigger response with function result
      dataChannel.send(JSON.stringify({ type: "response.create" }));
    }
  }
}

async function executeFunction(name, args) {
  switch (name) {
    case "get_weather":
      return await getWeatherData(args.location, args.unit);
    default:
      return { error: "Function not found" };
  }
}
```

### Function Call Events

- `response.function_call_arguments.delta`: Streaming function arguments
- `response.function_call_arguments.done`: Complete function arguments
- Function calls appear in `response.done` output with `type: "function_call"`

## Error Handling

Errors are returned with the following structure:
```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "code": "invalid_event",
    "message": "Description of the error",
    "param": null,
    "event_id": "event_id_that_caused_error"
  }
}
```

## Rate Limits

Rate limits are enforced and communicated through `rate_limits.updated` events. Limits apply to:
- Requests per minute
- Tokens per minute
- Audio duration

## Audio Handling

### WebRTC Audio Management

WebRTC handles most audio processing automatically through browser APIs:

```javascript
// Set up audio playback
const audioEl = document.createElement("audio");
audioEl.autoplay = true;
pc.ontrack = e => audioEl.srcObject = e.streams[0];

// Capture microphone input
const mediaStream = await navigator.mediaDevices.getUserMedia({
  audio: {
    sampleRate: 24000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true
  }
});
pc.addTrack(mediaStream.getTracks()[0]);
```

**WebRTC-Specific Events:**
- `output_audio_buffer.started`: Audio playback begins
- `output_audio_buffer.stopped`: Audio playback ends
- `output_audio_buffer.cleared`: Audio buffer cleared

### WebSocket Audio Processing

Manual audio handling required for WebSocket connections:

#### Streaming Audio Input

```javascript
// Convert Float32Array to PCM16 Base64
function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function base64EncodeAudio(float32Array) {
  const arrayBuffer = floatTo16BitPCM(float32Array);
  let binary = '';
  let bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    let chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// Send audio chunks
const audioChunk = captureAudioChunk(); // Your audio capture logic
const base64Audio = base64EncodeAudio(audioChunk);

ws.send(JSON.stringify({
  type: 'input_audio_buffer.append',
  audio: base64Audio
}));
```

#### Processing Audio Output

```javascript
function handleAudioOutput(event) {
  if (event.type === "response.audio.delta") {
    // Base64-encoded audio chunks
    const audioChunk = event.delta;
    // Process and play audio
    playAudioChunk(audioChunk);
  }
}
```

### Audio Formats

**Supported Input/Output Formats:**
- **PCM16** (default): 16-bit PCM, 24kHz, mono, little-endian
- **G.711 μ-law**: 8kHz, mono
- **G.711 A-law**: 8kHz, mono

**Format Configuration:**
```javascript
// Session-level format
const sessionUpdate = {
  type: "session.update",
  session: {
    input_audio_format: "pcm16",
    output_audio_format: "pcm16"
  }
};

// Response-level format
const responseCreate = {
  type: "response.create",
  response: {
    input_audio_format: "g711_ulaw",
    output_audio_format: "pcm16"
  }
};
```

## Transcription Mode

Use the Realtime API for transcription-only without model responses:

### Transcription Session Setup

```javascript
// WebSocket connection for transcription
const url = "wss://api.openai.com/v1/realtime?intent=transcription";
const ws = new WebSocket(url, {
  headers: {
    "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
    "OpenAI-Beta": "realtime=v1"
  }
});
```

### Transcription Configuration

```javascript
const config = {
  type: "transcription_session.update",
  session: {
    input_audio_format: "pcm16",
    input_audio_transcription: {
      model: "gpt-4o-transcribe",  // or "whisper-1", "gpt-4o-mini-transcribe"
      language: "en",              // ISO-639-1 format for better accuracy
      prompt: "Expect technical terms"  // Guide transcription context
    },
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500
    },
    input_audio_noise_reduction: {
      type: "near_field"  // or "far_field", null to disable
    },
    include: ["item.input_audio_transcription.logprobs"]  // Optional: confidence scores
  }
};

ws.send(JSON.stringify(config));
```

### Transcription Events

```javascript
ws.on("message", (message) => {
  const event = JSON.parse(message);
  
  switch (event.type) {
    case "conversation.item.input_audio_transcription.delta":
      // Streaming transcript (GPT-4o models)
      console.log("Transcript delta:", event.delta);
      break;
      
    case "conversation.item.input_audio_transcription.completed":
      // Final transcript
      console.log("Final transcript:", event.transcript);
      console.log("Item ID:", event.item_id);
      break;
      
    case "input_audio_buffer.speech_started":
      console.log("User started speaking");
      break;
      
    case "input_audio_buffer.speech_stopped":
      console.log("User stopped speaking");
      break;
  }
});
```

## Advanced Features

### Out-of-Band Responses

Generate responses outside the main conversation context:

```javascript
const oobResponse = {
  type: "response.create",
  response: {
    conversation: "none",  // Don't add to main conversation
    metadata: { purpose: "classification" },
    modalities: ["text"],
    instructions: "Classify this conversation as 'support' or 'sales'"
  }
};

dataChannel.send(JSON.stringify(oobResponse));
```

### Custom Context Responses

```javascript
const customResponse = {
  type: "response.create",
  response: {
    conversation: "none",
    input: [
      {
        type: "item_reference",
        id: "some_conversation_item_id"
      },
      {
        type: "message",
        role: "user",
        content: [{
          type: "input_text",
          text: "Custom context message"
        }]
      }
    ]
  }
};
```

### Response Control

Manual response generation with VAD enabled:

```javascript
const sessionConfig = {
  type: "session.update",
  session: {
    turn_detection: {
      type: "server_vad",
      create_response: false,    // Disable auto-responses
      interrupt_response: false  // Disable auto-interruptions
    }
  }
};

// Manually trigger responses
const triggerResponse = {
  type: "response.create"
};
```

## Error Handling and Best Practices

### Error Event Structure

```javascript
function handleError(event) {
  if (event.type === "error") {
    console.error(`Error ${event.error.code}: ${event.error.message}`);
    console.error(`Event ID: ${event.error.event_id}`);
    console.error(`Parameter: ${event.error.param}`);
  }
}
```

### Best Practices

1. **Use ephemeral tokens** for client-side WebRTC connections
2. **Handle connection failures** gracefully with reconnection logic
3. **Monitor rate limits** via `rate_limits.updated` events
4. **Implement proper audio device management** for WebRTC
5. **Buffer audio appropriately** for WebSocket implementations
6. **Use event IDs** for debugging failed client events
7. **Configure VAD** based on your application's noise environment
8. **Choose appropriate audio formats** for your bandwidth requirements

### Session Management

- **Maximum session duration**: 30 minutes
- **Voice changes**: Cannot change voice after model responds with audio
- **Connection states**: Monitor WebRTC connection state changes
- **Audio interruption**: Use `response.cancel` to stop in-progress responses

## WebRTC-Specific Events

Additional events available when using WebRTC:
- `output_audio_buffer.started`: Audio playback begins
- `output_audio_buffer.stopped`: Audio playback ends  
- `output_audio_buffer.cleared`: Audio buffer cleared (client can send this to cut off responses)

These events help manage audio playback and buffering in WebRTC implementations.