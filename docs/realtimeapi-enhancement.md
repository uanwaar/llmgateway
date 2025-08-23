# Realtime Transcription API Enhancement Plan

This plan describes how to add low-latency, realtime transcription to LLM Gateway via WebSockets for OpenAI Realtime and Google Gemini Live APIs, with a unified event model, security hardening, and production-ready observability.

## Goals and Non-Goals

- Goals
  - Realtime transcription over WebSockets with low latency (<300ms target E2E on LAN) and robust turn detection.
  - Unified gateway interface that normalizes events across OpenAI Realtime and Gemini Live.
  - Support push-to-talk (manual VAD) and automatic VAD modes.
  - Use standard provider API keys managed by the gateway (no ephemeral tokens); support server-to-provider S2S mode.
  - Backpressure-safe audio pipelines and graceful interruption.
  - Production-grade metrics, logging, and rate-limiting.
- Non-Goals
  - Full duplex TTS playback in browser via WebRTC (out of scope for this iteration; WS-first approach).
  - Tool/function-calling during realtime sessions (may be added later).

## High-Level Design

- New WebSocket entrypoint at the gateway: `ws://<gateway>/v1/realtime/transcription` (provider-agnostic).
- The gateway maintains a per-connection RealtimeSession with:
  - Provider binding (OpenAI or Gemini) based on requested model.
  - VAD configuration (server/semantic/manual), audio buffer, and item state machine.
  - Provider session lifecycle and resumption (when available).
- Event Normalization Layer converts provider-specific events into a unified schema.
- Audio I/O Pipeline ensures PCM16 mono handling, base64 framing, backpressure, and chunk sizing.
- Security uses gateway auth (standard API key) and gateway-managed provider credentials (no ephemeral provider tokens).

## Unified Event Model (Gateway-facing)

All WS messages are JSON. Client→Gateway events:
- `session.update`: Update session defaults (model, modalities=["text"|"audio"], language, vad).
- `input_audio.append`: Append base64 PCM16 audio chunk (16kHz mono for Gemini; 24kHz mono default for OpenAI; see normalization below).
- `input_audio.commit`: Commit the current audio buffer into a user turn.
- `input_audio.clear`: Clear buffer.
  - In transcription mode, commit marks end-of-input and triggers transcription; no separate `response.create` is required.

Gateway→Client events:
- `session.created|updated`
- `conversation.item.created` (for committed user input)
- `transcript.delta|done` (streaming text transcript of user input)
- `rate_limits.updated` (when available from provider)
- `error` (unified error envelope)

Notes
- For OpenAI mapping, `session.update` → `transcription_session.update`; `input_audio.append` → `input_audio_buffer.append`, `input_audio.commit` → `input_audio_buffer.commit`, `input_audio.clear` → `input_audio_buffer.clear`.
- For Gemini mapping, use the official SDK; `input_audio.append` → `session.sendRealtimeInput({ audio })`; server responses mapped from `serverContent.inputTranscription` outputs.

## Provider Mapping Summary

OpenAI Realtime (WebSocket, transcription intent)
  - Endpoint: `wss://api.openai.com/v1/realtime?intent=transcription`
  - Required headers: `Authorization: Bearer <API_KEY>`, `OpenAI-Beta: realtime=v1`
  - Session config: send `transcription_session.update` to set `input_audio_format`, `input_audio_transcription.model` (e.g., `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, or `whisper-1`), `language`, `turn_detection`, etc.
  - Input events: `input_audio_buffer.append | commit | clear` (no `response.create` in transcription mode)
  - Output events: `input_audio_buffer.speech_started | speech_stopped | committed`, `conversation.item.input_audio_transcription.delta | completed`, `rate_limits.updated`, `error`
  - Audio: PCM16, 24kHz mono (recommended).

Gemini Live (SDK-backed)
  - Connection: Use the official Google GenAI SDK (e.g., `@google/genai` for Node.js) instead of raw WebSocket for stability and correctness.
  - Session config: `{ responseModalities: ["TEXT"], systemInstruction, inputAudioTranscription: {} }`.
  - Input: `session.sendRealtimeInput({ audio: { data: <base64>, mimeType: "audio/pcm;rate=16000" } })`; for manual VAD, the adapter may emit an activity start equivalent when needed.
  - Output: SDK messages with `serverContent.inputTranscription` mapped to `transcript.delta|done`; use `serverContent.turnComplete` to delimit turns; also map `usageMetadata` and `interrupted`.
  - Audio: PCM16, 16kHz mono input; output 24kHz mono.

## API Surface (Gateway)

- URL: `ws(s)://<gateway-host>/v1/realtime/transcription`
- Auth: Same gateway auth as existing HTTP APIs via header `Authorization: Bearer <client_key>` or session cookie. Ephemeral provider tokens are not supported.
- Query params:
  - `model`: required (e.g., `gpt-4o-realtime-preview-2025-06-03`, `gemini-live-2.5-flash-preview`)
  - `provider`: optional (`openai|gemini`). If omitted, resolved by model map.
  - `vad`: optional (`server_vad|semantic_vad|manual`; provider-mapped). Default provider-recommended.
  - `language`: optional (e.g., `en-US`) for Gemini half-cascade; native audio auto-detect.

- Example client session bootstrap
  - Send `session.update` with model, modalities=["text"], vad config.
  - For manual: sequence `input_audio.append*` → `input_audio.commit` (commit triggers transcription in both providers via adapters; no `response.create`).

## Configuration Changes

Add to YAML configs under `config/*.yaml`:

```yaml
realtime:
  enabled: true
  # Allowed realtime transcription models and default provider routing
  models:
    - id: gpt-4o-transcribe
      provider: openai
      input:
        sample_rate_hz: 24000
        mime_type: audio/pcm;rate=24000
      vad_default: server_vad
    - id: gpt-4o-mini-transcribe
      provider: openai
      input:
        sample_rate_hz: 24000
        mime_type: audio/pcm;rate=24000
      vad_default: server_vad
    - id: whisper-1
      provider: openai
      input:
        sample_rate_hz: 16000
        mime_type: audio/pcm;rate=16000
      vad_default: server_vad
    - id: gemini-2.0-flash-live-001
      provider: gemini
      input:
        sample_rate_hz: 16000
        mime_type: audio/pcm;rate=16000
      vad_default: server_vad
    - id: gemini-live-2.5-flash-preview
      provider: gemini
      input:
        sample_rate_hz: 16000
        mime_type: audio/pcm;rate=16000
      vad_default: server_vad
  # Buffering and chunking
  audio:
    max_buffer_ms: 5000           # Max uncommitted input buffer
    chunk_target_ms: 50           # Preferred send size
    max_chunk_bytes: 32768        # Upper bound after base64
  # Turn detection settings (mapped per provider)
  vad:
    server_vad:
      interrupt_response: true
      silence_duration_ms: 500
      prefix_padding_ms: 50
    semantic_vad:
      interrupt_response: true
      eagerness: auto
  # Security
  security:
    allow_client_ephemeral_tokens: false
    max_session_minutes: 15
    max_idle_seconds: 60
  # Limits
  limits:
    max_sessions_per_api_key: 5
    max_concurrent_sessions: 100
    rpm_per_api_key: 120
    apm_audio_seconds_per_min: 180
```

## Server Components and Files

- Controller: `src/controllers/realtime.controller.js`
  - Upgrades HTTP → WS, authenticates, creates `RealtimeSession`, binds provider adapter, and relays events.
- Service: `src/services/realtime.service.js`
  - Session registry (in-memory; optional Redis later), VAD orchestration, backpressure, interruption, idle timeouts.
- Adapters:
  - `src/providers/openai/realtime.adapter.js` (wraps OpenAI Realtime WS with transcription intent, maps events)
  - `src/providers/gemini/realtime.adapter.js` (uses Google GenAI SDK Live API, maps messages)
- Utils:
  - `src/utils/audio.js` (PCM16 conversion, resampling if needed, base64 framing, chunk sizing)
  - `src/utils/realtime-normalizer.js` (event normalization)
- Routing:
  - Extend `src/routes` to mount WS upgrade route `/v1/realtime/transcribe` via server upgrade handler in `src/server.js`.
- Config:
  - Extend `src/config/index.js` to surface `realtime` block; add provider model map in `src/config/providers.js`.

Note: Keep changes additive; existing HTTP APIs remain untouched.

## Session Lifecycle

1. WS connect → authenticate → `session.created`.
2. `session.update` → provider session initialization:
  - OpenAI: send `transcription_session.update` with `input_audio_format`, `input_audio_transcription.model`, `language`, and `turn_detection` settings.
  - Gemini: initialize SDK Live session with `{ responseModalities: ["TEXT"], inputAudioTranscription: {} }` and configure VAD (`automaticActivityDetection` or manual).
3. Audio append/commit flow:
   - Buffer and enforce `max_buffer_ms`. When `input_audio.commit`, forward provider-specific commit event.
4. Response creation:
  - Manual VAD: commit marks end-of-input; provider starts transcription automatically. For Gemini, the adapter may also signal turn completion as needed.
5. Stream transcripts:
  - OpenAI: map `conversation.item.input_audio_transcription.delta|completed` to `transcript.delta|done`.
  - Gemini: map `serverContent.inputTranscription` outputs to `transcript.delta|done`.
6. Idle timeout and max session enforcement.
7. Graceful close on `error` or `goAway` or gateway shutdown.

## VAD Modes and Mapping

- server_vad (default)
  - OpenAI: `turn_detection: { type: "server_vad", interrupt_response }`
  - Gemini: `automaticActivityDetection.disabled=false` with `silenceDurationMs`, `prefixPaddingMs`.
- semantic_vad (advanced)
  - OpenAI: `turn_detection: { type: "semantic_vad", interrupt_response, eagerness }`
  - Gemini: N/A; fallback to server VAD with tuned thresholds.
- manual
  - OpenAI: `turn_detection: null`; client manually sends `commit`/`response.create`.
  - Gemini: `automaticActivityDetection.disabled=true`; client sends `realtimeInput.activityStart` and `turnComplete`.

## Security

- Gateway Auth: must pass existing auth middleware (API key or JWT).
- Provider Credentials:
  - Use only gateway-managed provider API keys. Client-supplied ephemeral provider tokens are not supported in this enhancement.
- Quotas and Abuse Controls:
  - Per-API key session caps and RPM/APM (audio-seconds per minute) limits.
  - Max input chunk size, max buffer length, and model allowlist.
- CORS/Origins:
  - For browser WS clients, enforce `Origin` allowlist.

## Observability and Ops

- Metrics (Prometheus labels: provider, model)
  - `realtime_sessions_active`
  - `realtime_audio_seconds_in_total`
  - `realtime_transcript_tokens_total`
  - `realtime_response_latency_ms`
  - `realtime_errors_total{code}`
- Logs
  - Connection lifecycle, VAD state changes, interruptions, provider errors.
  - Redact audio payloads; log sizes only.
- Tracing
  - Add spans for WS connect, provider session init, per-response generation.

## Rate Limits and Backpressure

- Enforce configured RPM/APM on gateway.
- Apply per-connection sliding window for `input_audio.append` frequency and byte size.
- On provider backpressure, pause reading from socket (Node ws supports pause/resume) and/or apply drop strategy with warning.

## Failure Handling

- Map provider errors to unified `error` shape: `{ type: "error", code, message, details? }`.
- Gemini `goAway.timeLeft` → gateway warning + session close countdown.
- Automatic reconnection (client-driven) with optional session resumption handle (Gemini); OpenAI currently re-creates.
- Circuit breaker integration with existing provider health monitoring; avoid connecting when unhealthy.

## Testing Strategy

- Unit tests
  - Event normalizer mappings for both providers.
  - Audio utils (chunking, base64 framing, resampling logic).
- Integration tests (Node ws)
  - Mock provider WS servers emitting representative events (OpenAI `response.*`, Gemini `serverContent`, `usageMetadata`).
  - Happy path streaming; manual/server VAD; interruptions; errors.
- E2E smoke
  - Script piping a small WAV/PCM into the gateway WS and asserting streamed transcript.
- Performance
  - Measure E2E latency (commit→first transcript delta) and throughput under concurrent sessions; add results to `benchmark-results/`.

## Deployment Changes

- Docker: ensure `UPGRADE` headers and WS proxying supported via nginx config.
  - Confirm `Connection: upgrade` and `Upgrade: websocket` pass-through.
- K8s Ingress: add annotations for WS; increase `proxy-read-timeout` to cover session duration.
- ConfigMaps/Secrets: add `realtime` block and provider keys; document ephemeral token usage.

## Documentation and Examples

- Docs
  - Update `docs/` with this plan and an API reference for the unified WS schema.
- Examples
  - `examples/javascript/streaming.js` (client WS example using unified events).
  - `examples/python/async_usage.py` can be extended for WS.

## Phased Implementation Plan

1) Foundations (1–2 days)
- Config plumbing (`realtime` block), model map updates, feature flag.
- WS upgrade route and controller scaffold.
- Audio utils MVP (validation, size checks, base64).

2) OpenAI Path (2–3 days)
- OpenAI adapter (connect, session.update, append/commit/clear, response.create).
- Event normalization to `transcript.delta|done`, `rate_limits.updated`, errors.
- Manual + server VAD support.

3) Gemini Path (2–3 days)
- Gemini adapter (setup, realtimeInput, clientContent, AAD config).
- Map input transcription to transcript events; handle `goAway`.

4) Observability, Limits, and Hardening (1–2 days)
- Metrics, logging, idle/limit enforcement, circuit breaker hooks.
- Fuzz/error tests, large-audio guardrails.

5) Docs & Examples (0.5–1 day)
- API doc, examples, quickstart.

## Risks and Mitigations

- Audio rate mismatches (16k vs 24k): validate sample rate per model; optionally resample; reject otherwise.
- Provider preview instabilities: isolate adapter failures; fast fallback path.
- Cost blowups from open mics: enforce idle timeouts, VAD, and APM limits.
- Browser CORS/Origin pitfalls: explicit Origin allowlist and test across environments.

## Acceptance Criteria

- Can connect to `/v1/realtime/transcribe`, stream PCM16 audio, and receive live transcripts for both OpenAI and Gemini models.
- Works in manual and server VAD modes; semantic VAD supported on OpenAI.
- Sessions respect configured limits and timeouts.
- Metrics and logs provide clear operational visibility.

---
