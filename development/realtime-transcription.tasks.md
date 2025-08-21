# Realtime Transcription Enhancement — Developer Task Plan

How to use
- Work top-to-bottom unless a task explicitly says it’s parallelizable.
- Keep status up to date: Todo → In Progress → Blocked → Done.
- Each task lists files to create/modify, references to read, context from previous tasks, and acceptance criteria.
- If you must deviate, note the decision under the task’s Notes and link to the status file.

Legend
- Status: Todo | In Progress | Blocked | Done
- Effort: S (≤0.5d), M (1–2d), L (3–5d)

Quick links
- Design: `docs/realtimeapi-enhancement.md`
- OpenAI Realtime: `docs/openai-realtime-api.md`
- Gemini Live: `docs/gemini-realtime-api.md`
- Architecture: `docs/architecture.md`

---

## Phase 1 — Foundations

### T01 — Read and align with design docs
- Status: Todo | Effort: S
- Description: Read the realtime plan and provider docs. Confirm model list and VAD defaults.
- Files: (read-only)
  - `docs/realtimeapi-enhancement.md`
  - `docs/openai-realtime-api.md`
  - `docs/gemini-realtime-api.md`
  - `src/config/providers.js`
- Context: Baseline understanding is required before editing config or implementing adapters.
- Acceptance: You can summarize the unified WS event model and provider mappings in 3–5 bullets in a comment in `src/services/realtime.service.js` once created.

### T02 — Config plumbing for realtime
- Status: Todo | Effort: S
- Description: Add `realtime` config block (models, audio, vad, security, limits) and expose via `src/config/index.js`.
- Files (modify/create):
  - Modify: `config/development.yaml`, `config/production.yaml`, `config/test.yaml`, `config/default.yaml`
  - Modify: `src/config/index.js` (load and validate `realtime`)
  - Modify: `src/config/providers.js` (add realtime model map)
- References:
  - `docs/realtimeapi-enhancement.md` (Configuration Changes section)
  - Existing config loading in `src/config/index.js`
- Context: None; foundation for other tasks.
- Acceptance:
  - App boots with new config present; missing blocks have safe defaults.
  - Unit test stub can require `src/config/index.js` without throwing.

### T03 — WebSocket route & server upgrade wiring
- Status: Todo | Effort: M
- Description: Add WS endpoint `ws(s)://<host>/v1/realtime/transcribe`. Use Node HTTP server upgrade (not Express route) and pass to controller.
- Files:
  - Modify: `src/server.js` (HTTP → WS upgrade listener, path match `/v1/realtime/transcribe`)
  - Create: `src/controllers/realtime.controller.js`
  - Modify: `src/index.js` or `src/app.js` if they own server creation
- References:
  - `docs/realtimeapi-enhancement.md` (API Surface, Server Components)
  - Existing server bootstrap `src/server.js`, `src/index.js`, `src/app.js`
- Context: After T02.
- Acceptance:
  - Connecting to the gateway WS path returns a `session.created` JSON event.
  - Non-authorized connections are rejected with an error JSON and closed.

### T04 — Session service and types
- Status: Todo | Effort: M
- Description: Implement `RealtimeSession` lifecycle, session registry, idle/TTL timers, and basic event relay stubs.
- Files:
  - Create: `src/services/realtime.service.js`
  - Create (optional types): `src/types/realtime.d.ts`
- References:
  - `docs/realtimeapi-enhancement.md` (Session Lifecycle)
  - `src/utils/errors.js`, `src/utils/logger.js`
- Context: After T03.
- Acceptance:
  - Sessions tracked in-memory with max idle enforcement from config.
  - Graceful close path logs and cleans up registry.

---

## Phase 2 — Provider Adapters

### T05 — OpenAI Realtime adapter (WebSocket)
- Status: Todo | Effort: M
- Description: Upstream WS client to OpenAI. Map gateway events to OpenAI events and back.
- Files:
  - Create: `src/providers/openai/realtime.adapter.js`
  - Add dependency: `ws` (npm) for client WS
- References:
  - `docs/openai-realtime-api.md` (Connection Methods → WebSocket; Client/Server Events)
  - Config: realtime models in YAML
- Context: After T04. Requires `X-Provider-Token` pass-through and/or gateway API key.
- Methods/Endpoints:
  - `wss://api.openai.com/v1/realtime?model=<model>` headers `Authorization: Bearer <token>`, `OpenAI-Beta: realtime=v1`
  - Map: `input_audio.append→input_audio_buffer.append`, `commit`, `clear`, `response.create`
- Acceptance:
  - Happy path: send append/commit/create; receive `response.audio_transcript.delta|done` normalized to `transcript.*`.
  - Proper error mapping to gateway `error` envelope.

### T06 — Gemini Live adapter (WebSocket)
- Status: Todo | Effort: M
- Description: Upstream WS client to Gemini Live. Implement `setup`, `realtimeInput`, manual/automatic VAD.
- Files:
  - Create: `src/providers/gemini/realtime.adapter.js`
- References:
  - `docs/gemini-realtime-api.md` (WebSocket Endpoint, Session Config, Realtime Input)
- Context: After T04.
- Methods/Endpoints:
  - `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`
  - `setup` with `generationConfig.responseModalities=["TEXT"]`
  - `realtimeInput.audio` with `mimeType: audio/pcm;rate=16000`
- Acceptance:
  - Happy path: append audio, either manual turn or AAD config; receive transcription mapped to `transcript.delta|done`.

### T07 — Event normalization layer
- Status: Todo | Effort: S
- Description: Normalize provider events to the gateway schema.
- Files:
  - Create: `src/utils/realtime-normalizer.js`
- References:
  - `docs/realtimeapi-enhancement.md` (Unified Event Model, Provider Mapping)
- Context: After T05, T06 stubs exist.
- Acceptance:
  - Unit tests cover mapping for OpenAI `response.*` and Gemini `serverContent` → `transcript.*`, `rate_limits.updated`, `error`.

### T08 — Audio utils (PCM16 framing and validation)
- Status: Todo | Effort: S
- Description: Validate PCM16 mono chunks, base64 decode/encode, chunk sizing, and optional resampling stub.
- Files:
  - Create: `src/utils/audio.js`
- References:
  - `docs/openai-realtime-api.md` and `docs/gemini-realtime-api.md` (Audio formats)
- Context: After T04.
- Acceptance:
  - Unit tests: invalid mime/sample rate rejected; chunk size caps enforced.

---

## Phase 3 — Security, Limits, Observability

### T09 — Gateway auth + provider ephemeral tokens
- Status: Todo | Effort: S
- Description: Require gateway auth; accept `X-Provider-Token` for OpenAI/Gemini ephemeral session tokens.
- Files:
  - Modify: `src/controllers/realtime.controller.js` (auth check)
  - Modify: `src/services/realtime.service.js` (store provider token per session)
- References:
  - `docs/realtimeapi-enhancement.md` (Security)
  - `src/middleware/auth.middleware.js`
- Context: After T03.
- Acceptance:
  - Unauthorized WS gets `error` and close; authorized with optional provider token reaches upstream.

### T10 — Rate limits and backpressure
- Status: Todo | Effort: M
- Description: Enforce RPM/APM limits and pause/resume reads on pressure. Cap buffer length and chunk rate.
- Files:
  - Modify: `src/services/realtime.service.js`
  - Modify: `src/utils/audio.js`
- References:
  - `docs/realtimeapi-enhancement.md` (Rate Limits and Backpressure)
- Context: After T04, T08.
- Acceptance:
  - When limits exceeded, emit `error` and/or throttle without crashing; log metrics.

### T11 — Metrics, logging, tracing
- Status: Todo | Effort: S
- Description: Add Prometheus counters/gauges, structured logs, and tracing spans.
- Files:
  - Modify: `src/utils/logger.js`
  - Modify: `src/services/realtime.service.js`
  - Create (if needed): `src/services/metrics.service.js`
- References:
  - `docs/realtimeapi-enhancement.md` (Observability and Ops)
- Context: Parallel with T10.
- Acceptance:
  - Metrics: sessions_active, audio_seconds_in_total, transcript_tokens_total, response_latency_ms, errors_total.

---

## Phase 4 — Tests, Examples, and Ops

### T12 — Integration tests with mock providers
- Status: Todo | Effort: M
- Description: Mock WS servers that emit representative OpenAI and Gemini events. Test normalization and flows.
- Files:
  - Create: `tests/integration/realtime/openai.mock-server.js`
  - Create: `tests/integration/realtime/gemini.mock-server.js`
  - Create: `tests/integration/realtime/gateway-realtime.test.js`
- References:
  - `docs/openai-realtime-api.md`, `docs/gemini-realtime-api.md`
- Context: After adapters (T05, T06) exist.
- Acceptance:
  - Jest passes in CI for happy path and key error paths.

### T13 — E2E smoke test and example client
- Status: Todo | Effort: S
- Description: Minimal WS client sending PCM16 chunks and asserting transcript stream.
- Files:
  - Create: `examples/javascript/realtime-transcription.js`
  - Create: `tests/e2e/realtime-smoke.test.js`
- References:
  - `docs/realtimeapi-enhancement.md` (Unified events)
- Context: After T03–T08.
- Acceptance:
  - Local run produces expected `transcript.delta|done`.

### T14 — Docker/nginx and K8s WS tweaks
- Status: Todo | Effort: S
- Description: Ensure WS proxying and timeouts.
- Files:
  - Modify: `docker/nginx.conf` (upgrade headers, timeouts)
  - Modify: `k8s/ingress.yaml` (annotations for WS and read timeouts)
- References:
  - `docs/realtimeapi-enhancement.md` (Deployment Changes)
- Context: Any time after T03.
- Acceptance:
  - WS works through Docker and Ingress; tested via example client.

### T15 — Documentation updates
- Status: Todo | Effort: S
- Description: Add API reference for unified WS events and quickstart.
- Files:
  - Create: `docs/realtime-api-reference.md`
  - Modify: `README.md` (link to realtime reference and example)
- References:
  - `docs/realtimeapi-enhancement.md`
- Context: End of feature.
- Acceptance:
  - Docs provide copy-paste example for connecting and streaming audio.

### T16 — Performance & benchmarks
- Status: Todo | Effort: S
- Description: Measure E2E latency from commit→first transcript delta; add to `benchmark-results/`.
- Files:
  - Create: `tests/performance/realtime-benchmark.js`
  - Modify: `benchmark-results/latest.json`
- References:
  - `scripts/performance-monitor.js`
- Context: After basic E2E is green.
- Acceptance:
  - Reported median latency <300ms (LAN) or baseline documented if higher.

### T17 — Feature flag and rollout
- Status: Todo | Effort: S
- Description: Gate endpoint behind `realtime.enabled`. Disable cleanly when false.
- Files:
  - Modify: `src/server.js`, `src/controllers/realtime.controller.js`
  - Modify: YAML config to set enabled=false by default in production initially
- References:
  - `docs/realtimeapi-enhancement.md` (Configuration Changes)
- Context: Final hardening.
- Acceptance:
  - When disabled, WS path returns structured error and closes.

### T18 — Release notes and changelog
- Status: Todo | Effort: S
- Description: Summarize feature and migration notes.
- Files:
  - Modify: `CHANGELOG.md`
- References:
  - This tasks file and the status file
- Context: Ship-ready.
- Acceptance:
  - CHANGELOG contains a concise summary with links to docs and examples.

---

Notes
- Avoid adding resampling initially; enforce correct sample rates per model. Add resampling later only if needed.
- Prefer additive changes; do not break existing HTTP APIs.
- Redact audio payloads in logs.
