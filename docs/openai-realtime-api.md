# OpenAI Realtime Transcription API Guide

This guide explains how to implement realtime transcription (speech-to-text only) with the OpenAI Realtime API. It covers connection setup, required client/server events, audio streaming, VAD configuration, and practical Node.js examples.

Key differences from conversation mode:
- No model responses are generated (no response.create).
- You connect with intent=transcription.
- You configure a transcription session via transcription_session.update.
- You listen for transcription events on conversation items.

Supported transcription models:
- gpt-4o-transcribe
- gpt-4o-mini-transcribe
- whisper-1

## Quick Start (Node.js, WebSockets)

Connect with intent=transcription and send a transcription session update before streaming audio.

```javascript
import WebSocket from "ws";
import fs from "fs";
import path from "path";

// Helper: Float32 -> PCM16 -> Base64
function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function base64EncodeAudio(float32Array) {
  const arrayBuffer = floatTo16BitPCM(float32Array);
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return Buffer.from(binary, "binary").toString("base64");
}

const url = "wss://api.openai.com/v1/realtime?intent=transcription";
const ws = new WebSocket(url, {
  headers: {
    Authorization: "Bearer " + process.env.OPENAI_API_KEY,
    "OpenAI-Beta": "realtime=v1",
  },
});

ws.on("open", () => {
  console.log("Connected.");

  // Configure transcription session
  const config = {
    type: "transcription_session.update",
    session: {
      input_audio_format: "pcm16",
      input_audio_transcription: {
        model: "gpt-4o-mini-transcribe", // or "gpt-4o-transcribe", "whisper-1"
        language: "en",
        prompt: "You are a transcription assistant. Only transcribe the audio."
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      },
      input_audio_noise_reduction: { type: "near_field" },
      // Optional: include confidence details
      // include: ["item.input_audio_transcription.logprobs"]
    }
  };
  ws.send(JSON.stringify(config));

  // After configuration, stream audio
  setTimeout(() => streamWavOrSynthetic(ws), 750);
});

ws.on("message", (message) => {
  const event = JSON.parse(message.toString());

  switch (event.type) {
    // Some deployments emit transcription_session.*; others may emit session.*
    case "transcription_session.created":
    case "transcription_session.updated":
    case "session.created":
    case "session.updated":
      console.log("Session ready/updated.");
      break;

    case "input_audio_buffer.speech_started":
      console.log("Speech started.");
      break;

    case "input_audio_buffer.speech_stopped":
      console.log("Speech stopped.");
      break;

    case "input_audio_buffer.committed":
      console.log("Audio committed.");
      break;

    case "conversation.item.input_audio_transcription.delta":
      process.stdout.write(event.delta);
      break;

    case "conversation.item.input_audio_transcription.completed":
      console.log("\nFinal transcript:", event.transcript);
      break;

    case "error":
      console.error("Server error:", event.error);
      break;
  }
});

function streamWavOrSynthetic(ws) {
  // Try a WAV file first (expects 24 kHz mono PCM)
  const wav = path.join(process.cwd(), "tests", "audio-files", "24KHz", "20s.wav");
  if (fs.existsSync(wav)) {
    const audio = fs.readFileSync(wav);
    // Prefer sending raw PCM ("data" chunk) if available
    const idx = audio.indexOf("data");
    const payload = idx > 0 ? audio.slice(idx + 8) : audio;
    const base64 = payload.toString("base64");

    ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64 }));
    ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    return;
  }

  // Fallback: synthetic 440 Hz tone (not speech)
  const sampleRate = 24000;
  const durationSec = 2;
  const samples = sampleRate * durationSec;
  const freq = 440;
  const pcm = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    pcm[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.3;
  }
  const base64 = base64EncodeAudio(pcm);

  // Send in chunks
  const chunkSamples = 4800; // ~0.2s
  const chunkBytes = Math.floor(chunkSamples * 4 / 3); // base64 overhead estimate
  (async () => {
    for (let i = 0; i < base64.length; i += chunkBytes) {
      ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64.slice(i, i + chunkBytes) }));
      await new Promise(r => setTimeout(r, 200));
    }
    ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  })();
}
```

## Connection Options

### WebSockets (recommended for servers)

- URL: wss://api.openai.com/v1/realtime?intent=transcription
- Headers:
  - Authorization: Bearer YOUR_API_KEY
  - OpenAI-Beta: realtime=v1

Use WebSockets for server-to-server or controlled environments. Audio is sent as Base64 chunks via JSON events.

### WebRTC (for clients/browsers)

- URL: https://api.openai.com/v1/realtime
- Auth: ephemeral token (client_secret.value) from POST /v1/realtime/transcription_sessions
- Use RTCPeerConnection for media; use the data channel to send/receive events.
- Prefer ephemeral tokens in untrusted clients.

Note: This guide focuses on WebSockets. For WebRTC specifics (media tracks, SDP), mirror the standard Realtime WebRTC flow but mint ephemeral tokens from the transcription sessions endpoint.

## Client Events (Transcription Mode)

- transcription_session.update
  - Configure input_audio_format, input_audio_transcription, turn_detection, input_audio_noise_reduction, include.
  - Example:
    ```json
    {
      "type": "transcription_session.update",
      "session": {
        "input_audio_format": "pcm16",
        "input_audio_transcription": {
          "model": "gpt-4o-mini-transcribe",
          "language": "en",
          "prompt": "Expect technical terms"
        },
        "turn_detection": {
          "type": "server_vad",
          "threshold": 0.5,
          "prefix_padding_ms": 300,
          "silence_duration_ms": 500
        },
        "input_audio_noise_reduction": { "type": "near_field" },
        "include": ["item.input_audio_transcription.logprobs"]
      }
    }
    ```
- input_audio_buffer.append
  - Appends Base64-encoded audio bytes (PCM16, 24kHz mono recommended).
- input_audio_buffer.commit
  - Commits the buffered audio to create a new user input item and start transcription.
- input_audio_buffer.clear
  - Clears the current input buffer (useful when VAD is disabled and you control turns manually).

No response.create in transcription mode.

## Server Events (Transcription Mode)

- transcription_session.created / transcription_session.updated
  - Acknowledges session state. Some deployments may emit session.created/session.updated instead.
- input_audio_buffer.speech_started
- input_audio_buffer.speech_stopped
- input_audio_buffer.committed
- conversation.item.input_audio_transcription.delta
  - Streaming transcript chunks (gpt-4o-* models).
- conversation.item.input_audio_transcription.completed
  - Final transcript for a committed item. Use item_id to correlate with input_audio_buffer.committed.previous_item_id.
- rate_limits.updated
- error
  - Inspect error.code/message; handle gracefully. A benign error like input_audio_buffer_commit_empty can occur if you commit with no data.

## Audio Formats

- Input formats:
  - pcm16 (default, 24kHz mono, little-endian) — recommended
  - g711_ulaw (8kHz)
  - g711_alaw (8kHz)
- For WAV files, send only the raw PCM “data” chunk (strip headers) when possible.
- Chunk size per append must be <= 15 MB.

## Voice Activity Detection (VAD)

VAD automatically commits audio when speech starts/stops.

- Server VAD (default):
  - type: server_vad
  - threshold (0–1): higher is less sensitive
  - prefix_padding_ms: prepend audio before detected speech
  - silence_duration_ms: duration to detect end of speech
- Disable VAD by setting turn_detection to null and manually:
  - Send input_audio_buffer.commit to mark end of input.
  - Optionally send input_audio_buffer.clear before next input.

## Confidence and Logprobs

Add include: ["item.input_audio_transcription.logprobs"] in transcription_session.update to request token-level logprobs for confidence estimation.

## Best Practices

- Use pcm16, 24kHz, mono for best results with gpt-4o-transcribe and gpt-4o-mini-transcribe.
- Buffer and send audio in reasonable chunks to avoid large frames and congestion.
- Avoid response.create in transcription mode.
- Handle both delta and completed events; accumulate deltas for live UX.
- Monitor and backoff on rate_limits.updated to respect usage limits.
- Prefer ephemeral tokens on untrusted clients (WebRTC); use standard API keys