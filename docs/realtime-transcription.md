# Realtime Transcription in LLM Gateway

This guide documents the WebSocket-based realtime transcription feature exposed by the Gateway at `/v1/realtime/transcription`. It covers configuration, protocols, provider mappings, VAD, limits, metrics, examples, and troubleshooting.


## Overview
- Endpoint: `ws://<host>/v1/realtime/transcription`
- Default mode: Strict transcription (no model commentary). The gateway suppresses model responses by default so only transcribed text is emitted.
- Optional (Gemini only): Opt in to model commentary alongside transcription by setting `include.model_output: true` in `session.update`. OpenAI does not emit additional commentary in this mode.
- Providers: OpenAI Realtime (intent=transcription) and Google Gemini Live (via `@google/genai` SDK).
- Event model: Unified Gateway events regardless of provider, with a normalizer in `src/utils/realtime-normalizer.js`.
- Audio: Base64-encoded PCM16 mono audio frames sent in JSON events over the same WebSocket.
- Feature flag: Controlled by config `realtime.enabled` (enabled in development; disabled in production by default until rollout).


## Quickstart

### Connect and stream audio
1) Connect a WebSocket client to `/v1/realtime/transcription`.
2) Send a `session.update` to configure model, language, and VAD.
3) Send audio using `input_audio.append` frames; delimit turns with VAD (manual markers or server VAD + commit if needed).
4) Read `transcript.delta` streaming updates and finalize with `transcript.done`.

See runnable examples:
- `tests/realtimeapi/gateway-openai-transcription.mjs` (OpenAI via Gateway)
- `tests/realtimeapi/gateway-gemini-transcription.mjs` (Gemini via Gateway)


## API reference: /v1/realtime/transcription

WebSocket endpoint that accepts JSON events and streams back normalized transcript events.

- URL: `ws(s)://<host>/v1/realtime/transcription`
- Upgrade behavior:
  - 403 Forbidden if `realtime.enabled=false`.
  - 410 Gone on legacy path `/v1/realtime/transcribe` (do not use).
- Query parameters (optional):
  - `model` (string) — Initial model id; can also be set via `session.update`.
  - `provider` (string) — `openai` | `gemini`. If omitted, resolved from configured models by id.
- Headers:
  - If `config.auth.requireAuthHeader=true`, one of: `Authorization: Bearer …` or `x-api-key: …` is required; otherwise optional.
- Connection events:
  - On success, server emits `{ type: "session.created", sessionId }`.

Client events (sent as JSON):

1) session.update
- Purpose: Configure model, language, VAD, and debug options.
- Shape:
  {
    "type": "session.update",
    "data": {
      "model": "gpt-4o-mini-transcribe" | "whisper-1" | "<gemini-model>",
  "prompt": "transcription-only instruction" ,
  "systemInstruction": "same purpose for Gemini (alias of prompt)",
  // Also accepted: system_instruction, systemInstructions, system_instructions
      "language": "en" ,
      "vad": {
        "type": "manual" | "server_vad",
        "silence_duration_ms": 500,
        "prefix_padding_ms": 300,
        "start_sensitivity": "HIGH|MEDIUM|LOW" ,
        "end_sensitivity": "HIGH|MEDIUM|LOW"
      },
      "include": {
        "raw_upstream": false,
        "model_output": false
      }
    }
  }
- Notes:
  - Accepts either flat payload or nested `data` object. The gateway normalizes both.
  - In transcription mode, model commentary is suppressed unless `include.model_output=true` (Gemini only). OpenAI path never emits commentary in this mode.
  - Changing `model` after the upstream is connected isn’t supported. Attempting to do so emits `{ type: "warning", code: "model_change_not_supported" }`.

2) input_audio.append
- Purpose: Stream PCM16 audio frames (Base64-encoded) to the gateway.
- Accepted shapes:
  - { "type": "input_audio.append", "audio": "<base64 pcm16>" }
  - { "type": "input_audio.append", "audio": { "data": "<base64>", "mime_type": "audio/pcm;rate=16000|24000" } }
- Constraints (enforced by service):
  - Max decoded chunk size: `realtime.audio.max_chunk_bytes` (default 262144 bytes). Error: `audio_chunk_exceeds_limit`.
  - APM window: audio per minute ≤ `realtime.limits.apm_audio_seconds_per_min` (default 180s). Error: `apm_exceeded`.
  - Buffer overflow when upstream/backpressure: max buffered ≈ `realtime.audio.max_buffer_ms` (default 5000ms). Error: `backpressure_buffer_overflow`.
- Sample rate handling:
  - Duration accounting uses the configured model sample rate (`config.realtime.models[].input.sample_rate_hz`). If unspecified, defaults to 16000.
  - Provide the recommended rate per provider path (OpenAI 24kHz, Gemini 16kHz) to keep APM accounting accurate.

3) Manual VAD markers (only when `vad.type === 'manual'`)
- input_audio.activity_start — Marks the start of a speech segment.
- input_audio.activity_end — Marks the end of a speech segment.
- input_audio.commit — Finalizes the turn and triggers transcription.

4) Server VAD mode (when `vad.type === 'server_vad'`)
- Turn boundaries are detected upstream. You may optionally:
  - Append brief trailing silence to encourage end-of-speech detection.
  - Send `input_audio.commit` as a fallback to force a boundary.

5) input_audio.clear
- Clears any buffered audio at the provider side. Rarely needed for strict transcription mode.

6) Gemini-compatible messages (auto-normalized):
- setup → session.update
- realtimeInput.audio → input_audio.append
- realtimeInput.activityStart → input_audio.activity_start
- realtimeInput.activityEnd → input_audio.activity_end
- clientContent.turnComplete → input_audio.commit

Server events (JSON) returned by the gateway:

- session.created
  - { "type": "session.created", "sessionId": "<uuid>" }

- session.updated
  - Acknowledges session.update
  - { "type": "session.updated" }

- transcript.delta
  - Streaming transcript chunks.
  - Canonical shape from gateway: { "type": "transcript.delta", "text": "..." }
  - For client compatibility, some examples may show { data: { text } } — prefer reading both `evt.text` and `evt.data?.text`.

- transcript.done
  - End-of-turn transcript.
  - Canonical shape: { "type": "transcript.done", "text": "<final-text>" }
  - Connection remains open. Clients should close the WebSocket when finished with the turn, or keep it open for additional turns. The server still enforces idle timeouts.

- model.delta (Gemini only; requires `include.model_output=true`)
  - Streaming model commentary segments derived from Gemini output.
  - Canonical shape: { "type": "model.delta", "text": "..." }

- model.done (Gemini only; requires `include.model_output=true`)
  - Indicates end of model commentary for the turn.
  - Canonical shape: { "type": "model.done" }

- rate_limits.updated
  - APM window stats per session.
  - { "type": "rate_limits.updated", "minute": { "used_ms": number, "limit_ms": number, "reset_ms": number } }

- warning
  - Operational hints; especially backpressure control.
  - { "type": "warning", "code": "backpressure_paused" | "backpressure_resumed", "reason"?: string }

- speech_started | speech_stopped (OpenAI passthrough)
  - Forwarded from provider events: input buffer detected speech start/stop.

- usage (Gemini)
  - { "type": "usage", "usage": { ...provider fields... } }

- interrupted (Gemini)
  - { "type": "interrupted", "interrupted": boolean }

- error
  - Structured errors emitted by the gateway or normalized provider errors.
  - { "type": "error", "code": string, "message"?: string, "provider"?: "openai"|"gemini", "details"?: object }

Error codes (non-exhaustive):
- bad_json — Client sent invalid JSON.
- idle_timeout — No activity for `config.realtime.security.max_idle_seconds` (default ~60s).
- audio_chunk_exceeds_limit — Decoded PCM size > `realtime.audio.max_chunk_bytes`.
- apm_exceeded — Exceeded audio-per-minute allowance.
- backpressure_buffer_overflow — Buffered audio > `realtime.audio.max_buffer_ms`.
- upstream_init_failed — Couldn’t connect/initialize upstream adapter (missing API key, unsupported provider, etc.).
- upstream_update_failed — Failed sending a session.update upstream.
- audio_append_failed | activity_start_failed | activity_end_failed — Adapter-specific send failures.
- provider_error — Normalized provider-side error (see `details`).

Provider selection:
- By query or session.update `model`, the gateway resolves `provider` using `config.realtime.models[].{ id, provider }`.
- If `provider` remains unknown, upstream initialization will fail with `upstream_init_failed`.

Backpressure:
- When upstream is congested, the gateway pauses socket reads and emits `{ type: 'warning', code: 'backpressure_paused' }`.
- It resumes when buffered audio drains sufficiently, emitting `{ type: 'warning', code: 'backpressure_resumed' }`.


## Configuration
Configuration is loaded from YAML (see `config/default.yaml`, `config/development.yaml`, `config/production.yaml`, `config/test.yaml`) and surfaced via `src/config/index.js`.

Key settings (names may be nested under `realtime.*`):
- `realtime.enabled`: Feature flag (dev:true, prod:false initially).
- `realtime.audio.max_chunk_bytes`: Maximum accepted chunk payload size. Default ~262144 bytes (≈1s at 16kHz PCM16).
- `realtime.audio.max_buffer_ms`: Maximum buffered audio (default 5000ms) to avoid unbounded memory.
- `realtime.audio.chunk_target_ms`: Target chunking granularity (default 50ms) used internally for pacing/backpressure.
- `realtime.limits.apm_audio_seconds_per_min`: Audio seconds per minute cap (default 180s/min) for cost control.
- Provider sample rates:
  - OpenAI path: `audio/pcm;rate=24000` (24kHz PCM16 mono).
  - Gemini path: `audio/pcm;rate=16000` (16kHz PCM16 mono).

Environment knobs:
- `REALTIME_DEBUG_UPSTREAM=1` emits `debug.upstream` events for provider traffic mirroring (metadata only; redacts audio payloads).


## Security and Credentials
- Client auth headers are optional (parity with other Gateway endpoints by default). Behavior is governed by existing auth middleware; no special realtime auth was added.
- Provider API keys are sourced and managed by the Gateway server environment/config. Client-supplied provider tokens are not accepted on this path.


## WebSocket Protocol

### Client → Gateway events
- `session.update` — Configure the session.
  - `data.model`: Provider model id (e.g., `gpt-4o-mini-transcribe`, `whisper-1`, or a Gemini model).
  - `data.prompt` (OpenAI) or `data.systemInstruction` (Gemini): Transcription-only instruction. The gateway forwards the appropriate field.
  - Aliases accepted: `system_instruction`, `systemInstructions`, `system_instructions`.
  - `data.language` (optional): Language hint (e.g., `en`).
  - `data.vad`:
    - `type`: `manual` | `server_vad`
    - `silence_duration_ms`, `prefix_padding_ms`, `start_sensitivity`, `end_sensitivity` (optional; applied when `server_vad`).
  - `data.include` (optional):
    - `raw_upstream` (boolean): When true, emit `debug.upstream` events for observability.
    - `model_output` (boolean): When true, emit `model.delta`/`model.done` (Gemini only).

- `input_audio.append` — Append audio. Two accepted shapes:
  - `{ type: "input_audio.append", audio: "<base64 pcm16>" }`
  - `{ type: "input_audio.append", data: "<base64 pcm16>", mime_type: "audio/pcm;rate=16000|24000" }`

- Manual VAD markers (only if `vad.type === 'manual'`):
  - `input_audio.activity_start` — Must be sent before the first audio frame of a turn.
  - `input_audio.activity_end` — Sent after the final audio frame of a turn.
  - `input_audio.commit` — Finalizes the turn and prompts provider transcription.

- Server VAD (if `vad.type === 'server_vad'`):
  - You can still send `input_audio.commit` as a fallback if your client wants a deterministic turn boundary (optional).
  - Some clients append brief trailing silence to help VAD terminate; see the OpenAI test script for reference.

- Other:
  - `input_audio.clear` — Clear any buffered input (rarely needed in transcription-only mode).

Gateway also accepts Gemini-style messages and normalizes them into the above model:
- `setup`, `realtimeInput.audio`, `clientContent.turnComplete`, `realtimeInput.activityStart`, `realtimeInput.activityEnd`.


### Gateway → Client events
- `session.created` — Emitted upon connection.
- `session.updated` — Acknowledges `session.update` changes.
- `transcript.delta` — Streaming transcript text chunk.
  - Canonical shape: `{ type: "transcript.delta", text: "..." }`
  - For compatibility, some clients/examples also read `evt.data?.text`.
- `transcript.done` — End of transcript for the turn.
  - Canonical shape: `{ type: "transcript.done", text: "<final-text>" }`
  - For compatibility, some clients/examples also read `evt.data?.text`.
  - The WebSocket does not auto-close. Close it client-side when you are finished, or keep it open for additional turns. Idle timeout applies.
- `rate_limits.updated` — Periodic limits usage, currently audio-per-minute (APM) window.
  - Shape: `{ type: "rate_limits.updated", minute: { used_ms, limit_ms, reset_ms } }`
- `warning` — Operational warnings (e.g., backpressure pause/resume).
  - `reason`: `backpressure_paused` | `backpressure_resumed` | other codes
- `error` — Structured errors (validation, limits, provider IO).
  - Example causes: invalid audio format, chunk too large, APM exceeded, upstream errors/timeouts.
- `debug.upstream` — Optional provider event mirror for debugging (redacted). Enabled via `session.update.data.include.raw_upstream` or `REALTIME_DEBUG_UPSTREAM=1`.


## Voice Activity Detection (VAD)
VAD is configurable and mapped per provider.

- `manual` (recommended when you own the audio flow):
  - Client is responsible for explicit markers: `input_audio.activity_start` → audio frames → `input_audio.activity_end` → `input_audio.commit`.
  - Gateway forwards markers as-is and does not auto-inject them.

- `server_vad` (provider-managed):
  - OpenAI mapping: `turn_detection` object on `transcription_session.update`.
  - Gemini mapping: `realtimeInputConfig.automaticActivityDetection` via SDK.
  - Tunables: `silence_duration_ms`, `prefix_padding_ms`, `start_sensitivity`, `end_sensitivity`.
  - Clients may append trailing silence and/or send a `commit` fallback to ensure a timely end-of-turn.


## Audio Requirements
- Encoding: PCM16 mono, little-endian.
- Sample rate: depends on provider path
  - Gemini: 16kHz → `audio/pcm;rate=16000`
  - OpenAI: 24kHz → `audio/pcm;rate=24000`
- Transport: Base64-encoded PCM data contained in JSON events.
- Validation and helpers live in `src/utils/audio.js`.


## Provider Mappings (normalized by `realtime-normalizer`)

### OpenAI Realtime (intent=transcription)
- Upstream endpoint: `wss://api.openai.com/v1/realtime?intent=transcription`
- Headers: `Authorization: Bearer <API_KEY>`, `OpenAI-Beta: realtime=v1`
- Event mapping:
  - `session.update` → `transcription_session.update`
  - `input_audio.append` → `input_audio_buffer.append`
  - `input_audio.commit` → `input_audio_buffer.commit`
  - `input_audio.clear` → `input_audio_buffer.clear`
  - Provider outputs:
    - `conversation.item.input_audio_transcription.delta` → `transcript.delta`
    - `conversation.item.input_audio_transcription.completed` → `transcript.done`
- Notes:
  - Preferred audio sample rate 24kHz.
  - Strict transcription mode suppresses model text not associated with transcription.

### Gemini Live (via `@google/genai` SDK)
- SDK connection: `ai.live.connect({ model, config, callbacks })`
- Setup includes `responseModalities: ["TEXT"]` and `inputAudioTranscription: {}`.
- Input: `session.sendRealtimeInput({ audio: { data: <base64>, mimeType: "audio/pcm;rate=16000" } })`
- Output mapping:
  - `serverContent.inputTranscription` → `transcript.delta` (streaming)
  - `turnComplete` → end-of-turn; gateway emits `transcript.done`
  - `modelTurn.parts[].text` → `model.delta` (when `include.model_output=true`)
- Notes:
  - Preferred audio sample rate 16kHz.
  - `maxOutputTokens` is pinned low in the adapter to prevent verbose model content; commentary is still available when explicitly enabled.


## Limits, Backpressure, and Stability
- Audio-per-minute (APM) limit: default 180 seconds per minute per session. Reported via `rate_limits.updated` with `{ minute: { used_ms, limit_ms, reset_ms } }`.
- Chunk constraints: `realtime.audio.max_chunk_bytes` ≈ 262144 bytes (≈1s @16kHz PCM16). Oversized chunks are rejected.
- Buffer cap: `realtime.audio.max_buffer_ms` (default 5000ms). Protects memory; when exceeded the gateway pauses client reads.
- Backpressure handling:
  - The gateway detects upstream pressure and pauses the client socket (`warning: backpressure_paused`), resuming when drained (`warning: backpressure_resumed`).
  - Clients can monitor WebSocket `bufferedAmount` and pace sends (see test scripts for reference).
- Removed throttle: No artificial per-second throughput cap (previous limiter was removed to prevent idle timeouts on streaming).


## Metrics and Observability
Metrics are exposed by `src/services/metrics.service.js` (Prometheus-compatible when `prom-client` is available, with a safe in-memory fallback):
- `realtime_sessions_active` (gauge) — Active sessions count.
- `realtime_audio_seconds_total` (counter) — Total audio seconds processed.
- `realtime_transcript_tokens_total` (counter) — Approximate total transcript tokens emitted.
- `realtime_response_latency_ms` (histogram) — Commit → first transcript delta latency.
- `realtime_errors_total` (counter) — Error events.

Debugging:
- Enable upstream event mirroring with `REALTIME_DEBUG_UPSTREAM=1` (env) or `session.update.data.include.raw_upstream=true`.
- Normalization logic: `src/utils/realtime-normalizer.js`.
- Audio helpers and validation: `src/utils/audio.js`.


## Examples and Tests

OpenAI path example (via Gateway):
- `tests/realtimeapi/gateway-openai-transcription.mjs`
  - Defaults:
    - `MODEL=gpt-4o-mini-transcribe`
    - Manual VAD by default (`VAD_TYPE=manual`).
    - Target sample rate 24kHz.
  - Sends `session.update` with a strict transcription prompt, streams PCM16 frames, and prints `transcript.delta`/`done`.

Gemini path example (via Gateway):
- `tests/realtimeapi/gateway-gemini-transcription.mjs`
  - Uses SDK-backed Gemini adapter; target sample rate 16kHz.

Gemini path example with model commentary (via Gateway):
- `examples/javascript/realtime-transcription-gemini-opinion.mjs`
  - Add `include.model_output: true` in `session.update` to receive `model.delta`/`model.done` alongside transcript.

Optional client environment variables (see test scripts):
- `GATEWAY_WS_URL`, `AUDIO_FILE`, `MODEL`, `VAD_TYPE`, `VAD_SILENCE_MS`, `VAD_PREFIX_MS`, `TARGET_SAMPLE_RATE`.


## Deployment Notes
- WebSocket upgrades must be allowed end-to-end (Docker/nginx, K8s Ingress). Ensure upgrade headers and reasonable read timeouts are configured.
- The legacy path `/v1/realtime/transcribe` returns `410 Gone` and should not be used.
- Feature flag: disable cleanly via `realtime.enabled=false` for environments where the feature is not yet rolled out.


## Error Handling
Common errors emitted as `{ type: "error", code, message, ... }`:
- `invalid_audio_format` — Non-PCM16 or wrong channel/bit-depth.
- `unsupported_sample_rate` — Sample rate does not match provider path expectations.
- `chunk_too_large` — Exceeds `realtime.audio.max_chunk_bytes`.
- `apm_limit_exceeded` — Audio-per-minute cap reached.
- `upstream_error` — Provider error or transport failure (includes minimal details).
- `idle_timeout` — Session closed after prolonged inactivity (configurable).


## Best Practices
- Prefer manual VAD for deterministic control when you own UX timing; otherwise use server VAD with tuned sensitivities.
- Pace your sends and avoid backpressure: use small PCM chunks and monitor `WebSocket.bufferedAmount`.
- Use the recommended sample rate per provider path (24kHz OpenAI, 16kHz Gemini). If your capture device differs, resample client-side.
 - Keep sessions short in transcription mode; close the socket client-side after `transcript.done` unless you intend to reuse it for another turn.
- Include a `language` hint when known to improve accuracy/latency.


## Best practices and parameter recipes

These recommendations combine provider guidance with gateway constraints. Adjust to your latency/quality needs and device/network conditions.

General constraints and conversions
- Gateway chunk limit: decoded PCM per append must be ≤ `realtime.audio.max_chunk_bytes` (default 262144 bytes ≈ 1.0s at 16kHz mono). Stay well below to reduce jitter.
- Bytes per second (PCM16 mono) ≈ sample_rate_hz × 2. For 16k: ~32 KB/s; for 24k: ~48 KB/s. A 200 ms chunk at 16k ≈ 6.4 KB; at 24k ≈ 9.6 KB.
- APM budget: default 180 s/min. Long calls should pace audio within this budget or increase the limit.

Scenario: live mic captions (lowest latency)
- Provider: Gemini (16 kHz) or OpenAI (24 kHz). For fastest deltas, Gemini often works well with smaller frames.
- Audio format: PCM16 mono; `audio/pcm;rate=16000` (Gemini) or `audio/pcm;rate=24000` (OpenAI).
- Chunking: 20–50 ms (Gemini guidance favors 20–50 ms); 50–100 ms also acceptable. Keep well under 32 KB.
- VAD: server VAD with higher start sensitivity and moderate end sensitivity, or manual VAD if you can mark turns precisely.
  - Gemini `vad` example (auto):
    { "type": "server_vad", "start_sensitivity": "HIGH", "end_sensitivity": "MEDIUM", "prefix_padding_ms": 200–300, "silence_duration_ms": 400–600 }
  - OpenAI `vad` example (auto):
    { "type": "server_vad", "prefix_padding_ms": 200–300, "silence_duration_ms": 400–600 }
- Timing: send frames continuously; avoid large pauses that can trigger idle timeouts.
- Client pacing: if `bufferedAmount > 256 KiB`, briefly pause sends until it drops below ~64 KiB (see OpenAI test script).

Scenario: push-to-talk or deterministic boundaries
- Prefer manual VAD for exact control over turn ends.
- Flow: `input_audio.activity_start` → repeated `input_audio.append` → `input_audio.activity_end` → `input_audio.commit` immediately.
- Chunking: 50–200 ms works well; smaller is fine if the client can keep up.
- Sample rate: match provider path (OpenAI 24 kHz, Gemini 16 kHz).

Scenario: noisy environment or barge‑in prone UX
- Start sensitivity: increase (Gemini: `HIGH`) to avoid false starts.
- End sensitivity: increase to end sooner when user stops; pair with `silence_duration_ms` 400–600 ms.
- Consider manual VAD if you can gate capture at the UI level (PTT), minimizing ambient pickup.
- For OpenAI, there’s no explicit sensitivity setting; tune `silence_duration_ms` and `prefix_padding_ms` and consider manual VAD.

Scenario: mobile or flaky networks
- Smaller chunks (30–80 ms) reduce burstiness and help backpressure recovery.
- Implement adaptive pacing: watch `bufferedAmount`, back off when > 128–256 KiB.
- Expect `warning` events: pause/resume; avoid sending multi-second frames.
- Use manual VAD to reduce unnecessary audio if speech turns are sparse.

Scenario: highest accuracy for longer utterances
- Chunking: 100–200 ms to reduce send overhead while staying under the 32 KB limit.
- VAD: manual VAD for precise endpointing, or server VAD with `silence_duration_ms` 600–900 ms for patience at tail.
- Provide `language` hints.
- For OpenAI, prefer 24 kHz audio for gpt‑4o‑* transcribe models.

Gemini‑specific tips (from provider docs)
- Input format strictly 16-bit PCM, 16 kHz, mono; mime `audio/pcm;rate=16000`.
- Chunk 20–50 ms for best latency; send activity markers for manual VAD via SDK (`sendRealtimeInput({ activityStart: {} })`).
- For transcription-only sessions, keep `responseModalities: ["TEXT"]` and set strict system instruction; set `maxOutputTokens` small (the gateway adapter uses 1).
- Barge‑in: handle `interrupted: true` by stopping TTS and accepting new input.

OpenAI‑specific tips (from provider docs)
- Connect with `intent=transcription`; configure with `transcription_session.update`.
- Input: PCM16, 24 kHz recommended for gpt‑4o‑transcribe/mini‑transcribe; send `input_audio_buffer.append` chunks and `commit` at end (or rely on server VAD).
- Accepted chunk size by API is large, but the gateway enforces ~32 KB decoded per append for stability.
- Use `turn_detection: null` for manual VAD; otherwise set `server_vad` with `silence_duration_ms` and `prefix_padding_ms`.

Recommended session.update snippets
- Manual VAD (either provider):
  {
    "type": "session.update",
    "data": {
      "model": "<model>",
      "prompt": "Only transcribe the user audio.",
      "language": "en",
      "vad": { "type": "manual" }
    }
  }
- Server VAD tuned (Gemini):
  {
    "type": "session.update",
    "data": {
      "model": "<gemini-model>",
      "systemInstruction": "Only transcribe the user audio.",
      "language": "en",
      "vad": {
        "type": "server_vad",
        "start_sensitivity": "HIGH",
        "end_sensitivity": "MEDIUM",
        "prefix_padding_ms": 300,
        "silence_duration_ms": 500
      }
    }
  }
- Server VAD tuned (OpenAI):
  {
    "type": "session.update",
    "data": {
      "model": "gpt-4o-mini-transcribe",
      "prompt": "Only transcribe the user audio.",
      "language": "en",
      "vad": { "type": "server_vad", "prefix_padding_ms": 300, "silence_duration_ms": 500 }
    }
  }


## File Map (implementation reference)
- `src/server.js` — HTTP upgrade listener for `/v1/realtime/transcription`; old path returns 410.
- `src/controllers/realtime.controller.js` — Auth gate, emits `session.created`, delegates to service.
- `src/services/realtime.service.js` — Session lifecycle, limits/backpressure, adapter wiring, normalization, metrics, error envelopes.
- `src/providers/openai/realtime.adapter.js` — OpenAI realtime adapter (intent=transcription).
- `src/providers/gemini/realtime.adapter.js` — Gemini Live adapter via `@google/genai` SDK.
- `src/utils/realtime-normalizer.js` — Provider → unified event mapping.
- `src/utils/audio.js` — PCM16 validation and chunking helpers.
- `src/services/metrics.service.js` — Metrics.


## Troubleshooting
- No transcript events: verify VAD mode and markers; ensure `commit` is sent in manual VAD; confirm sample rate matches provider path.
- Early socket close: now typically client-initiated. If the socket closes unexpectedly, review client logic and check for idle timeouts on the server.
- Throttling/pauses: look for `warning` events (`backpressure_paused`/`backpressure_resumed`) and monitor client `bufferedAmount`.
- APM exceeded: reduce audio duration per minute or increase the limit in config if appropriate.
- Provider auth: ensure server-side provider API keys are configured; client tokens are ignored.
- Debugging providers: enable `REALTIME_DEBUG_UPSTREAM=1` or include `include.raw_upstream=true` in `session.update`.


## Changelog and Status
- Live status is tracked in `development/enhancement-status.md`.
- Task plan and milestones: `development/realtime-transcription.tasks.md`.
