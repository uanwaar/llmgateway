# Realtime Transcription API (Third‑Party Client Guide)

This document describes how external clients connect to and use the Gateway’s realtime transcription WebSocket endpoint to stream audio and receive live transcripts.

- Endpoint: ws(s)://<host>/v1/realtime/transcription
- Default mode: Strict speech‑to‑text; the Gateway suppresses model commentary and only emits transcript events.
- Optional (Gemini only): Opt in to model commentary alongside transcription by setting `include.model_output: true` in `session.update`.
- Providers: OpenAI Realtime (intent=transcription) and Gemini Live are handled internally; the client speaks a single, unified protocol.


## 1) Authentication

Gateway deployments can be configured to require a header; ask your API provider which applies.
- Optional (common in development): No auth required.
- API key (production): Include either of the following
  - Authorization: Bearer <GATEWAY_API_KEY>
  - x-api-key: <GATEWAY_API_KEY>

If auth is required but missing, the server closes the socket after sending:
- { "type": "error", "code": "unauthorized", "message": "Missing Authorization" }


## 2) Connect

WebSocket URL: ws(s)://<host>/v1/realtime/transcription

Optional query params (you can also set these in session.update):
- model: Model id (e.g., gpt-4o-mini-transcribe, whisper-1, or a Gemini live model)
- provider: openai | gemini (normally inferred from model)

On success, the server sends:
- { "type": "session.created", "sessionId": "<uuid>" }


## 3) Session configuration (required before audio)

Send a session.update to choose model and optional settings.

Request
{
  "type": "session.update",
  "data": {
    "model": "gpt-4o-mini-transcribe",        // Required for reliable routing (unless passed via query)
    "language": "en",                          // Optional
  "prompt": "Only transcribe user audio.",   // Optional 
  // Gemini instruction aliases are also accepted:
  // systemInstruction | system_instruction | systemInstructions | system_instructions
    "vad": {                                    // Optional; choose one mode
      "type": "manual"                         // Manual VAD: client sends markers + commit
      // or
      // "type": "server_vad",
      // "silence_duration_ms": 500,
      // "prefix_padding_ms": 300,
      // "start_sensitivity": "HIGH|MEDIUM|LOW", // Gemini only
      // "end_sensitivity": "HIGH|MEDIUM|LOW"    // Gemini only
    },
    "include": {
      "raw_upstream": false,                    // Optional debug mirror of provider events
      "model_output": false                     // Gemini only: emit model.delta/model.done alongside transcript
    }
  }
}

Response
- { "type": "session.updated" }
- If you change model after upstream is connected, a warning is sent: { "type": "warning", "code": "model_change_not_supported" }

Notes
- Gemini‑style setup messages are accepted and normalized automatically (see Compatibility below).
 - In transcription mode, model commentary is suppressed unless `include.model_output=true` (Gemini only). OpenAI does not emit commentary in this mode.


## 4) Stream audio

Send Base64‑encoded PCM16 mono audio frames as JSON events on the same WebSocket.

Request (either shape)
- { "type": "input_audio.append", "audio": "<base64 pcm16>" }
- { "type": "input_audio.append", "audio": { "data": "<base64>", "mime_type": "audio/pcm;rate=16000|24000" } }

Voice Activity Detection (turns)
- Manual VAD (recommended when you own UX timing):
  1) { "type": "input_audio.activity_start" }
  2) Repeated input_audio.append frames
  3) { "type": "input_audio.activity_end" }
  4) { "type": "input_audio.commit" }
- Server VAD: Provider detects start/end. You may append brief trailing silence and/or send a fallback { "type": "input_audio.commit" }.

Optional
- { "type": "input_audio.clear" } clears provider input buffer.

Audio formats
- OpenAI path: 24 kHz, PCM16 mono (audio/pcm;rate=24000) recommended.
- Gemini path: 16 kHz, PCM16 mono (audio/pcm;rate=16000) required.

Chunking guidance
- Use small frames for lower latency. 20–50 ms is ideal for Gemini; 50–200 ms also works well across providers.
- Watch client backpressure (WebSocket.bufferedAmount if available) and pace sends.


## 5) Receive events

Canonical transcript shapes (always prefer the text field)
- transcript.delta: { "type": "transcript.delta", "text": "partial text" }
- transcript.done:  { "type": "transcript.done",  "text": "final text" }

Model commentary (Gemini only; when include.model_output=true)
- model.delta: { "type": "model.delta", "text": "…" }
- model.done:  { "type": "model.done" }

Other events
- session.created | session.updated
- rate_limits.updated: { "type": "rate_limits.updated", "minute": { "used_ms", "limit_ms", "reset_ms" } }
- warning: { "type": "warning", "code": "backpressure_paused" | "backpressure_resumed", "reason"?: string }
- speech_started | speech_stopped (OpenAI passthrough)
- usage (Gemini): { "type": "usage", "usage": { ... } }
- interrupted (Gemini): { "type": "interrupted", "interrupted": boolean }
- error: { "type": "error", "code": string, "message"?: string, "provider"?: "openai"|"gemini", "details"?: object }
- debug.upstream (optional): Mirror of provider events when enabled via include.raw_upstream or env on the server.

Connection lifetime
- The server does not auto‑close after transcript.done. Close the WebSocket client‑side when finished, or keep it open for additional turns. Idle timeout still applies.


## 6) Limits and backpressure

- Per‑chunk decoded size: ≤ realtime.audio.max_chunk_bytes (default ≈ 262144 bytes; ~1.0s at 16 kHz PCM16). Oversized chunks are rejected with: { type: "error", code: "audio_chunk_exceeds_limit" }.
- Audio‑per‑minute (APM): ≤ realtime.limits.apm_audio_seconds_per_min (default 180 s/min). On exceed: { code: "apm_exceeded" } with rate_limits.updated.
- Buffer cap: realtime.audio.max_buffer_ms (default 5000 ms). If backlog exceeds cap: { code: "backpressure_buffer_overflow" }.
- Backpressure: The server may pause socket reads and emit warning backpressure_paused/resumed. Clients should pace sends.
- Idle timeout: Session closes after prolonged inactivity; error code: idle_timeout.


## 7) Errors (reference)

Common error codes
- unauthorized — Missing/invalid authorization when required.
- bad_json — Client sent invalid JSON.
- idle_timeout — No activity for server‑configured idle window.
- audio_chunk_exceeds_limit — Decoded PCM chunk exceeds configured limit.
- apm_exceeded — Audio‑per‑minute budget exceeded.
- backpressure_buffer_overflow — Too much data buffered while upstream/backpressured.
- upstream_init_failed — Provider adapter couldn’t connect (e.g., missing provider API key).
- upstream_update_failed — Failed sending a session.update upstream.
- audio_append_failed | activity_start_failed | activity_end_failed — Provider send failure.
- provider_error — Normalized provider error; see details.


## 8) Compatibility (Gemini message shapes)

The Gateway accepts Gemini Live shapes and normalizes them to the unified protocol. These are equivalent to the client events above:
- setup → session.update
- realtimeInput.audio → input_audio.append
- realtimeInput.activityStart → input_audio.activity_start
- realtimeInput.activityEnd → input_audio.activity_end
- clientContent.turnComplete → input_audio.commit


## 9) Examples

JavaScript (Node.js)
- See examples/javascript/realtime-transcription.js
- Mandatory: model, audio frames; in manual VAD, markers + commit.
- Optional: language, vad settings, include.raw_upstream.

Python
- See examples/python/realtime_transcription.py
- Same mandatory/optional parameters; uses base64 for audio.

Shell (WebSocket)
- See examples/curl/realtime-transcription-websocket.sh (uses websocat; curl alone can’t speak WS)


## 10) Best practices (quick picks)

- Manual VAD for deterministic boundaries (PTT UX): activity_start → chunks → activity_end → commit.
- Server VAD for ease: tune silence_duration_ms (400–600 ms) and prefix_padding_ms (200–300 ms). Gemini allows start/end sensitivities.
- Chunk small (20–50 ms for fastest Gemini latency; 50–200 ms works well across providers). Keep well below the ~32 KB limit.
- Sample rate: OpenAI 24 kHz; Gemini 16 kHz. Resample client‑side when needed; send mono PCM16.
- Pace sends using bufferedAmount or short delays; heed backpressure warnings.
- Provide language hints if known; keep sessions short and close the socket client‑side after transcript.done unless you intend to reuse it.


---
Implementation notes (for reference only; not required by clients)
- Public protocol is implemented in src/controllers/realtime.controller.js and src/services/realtime.service.js.
- Provider adapters: src/providers/openai/realtime.adapter.js, src/providers/gemini/realtime.adapter.js.
- Normalization: src/utils/realtime-normalizer.js.
