# Enhancement Status — Realtime Transcription

How to use
- Purpose: Single source of truth for feature progress. Keep it short and current.
- When to update: After moving a task between states (Todo/In Progress/Blocked/Done), reaching a milestone, hitting a blocker, or finishing a PR.
- What to enter: Date, task IDs (from `realtime-transcription.tasks.md`), brief notes, links to PRs/commits/logs.

## Current Summary
- Feature flag: realtime.enabled = development:true, production:false
- WS path: /v1/realtime/transcription (active). Old /v1/realtime/transcribe returns 410 Gone.
- Auth: gateway-managed provider API keys in use; client-supplied provider tokens are not accepted.
- Providers: OpenAI Realtime (intent=transcription) integrated; Gemini Live integrated via @google/genai SDK.
- Event normalization: centralized in `src/utils/realtime-normalizer.js`; service imports and uses it.
- Audio I/O: `src/utils/audio.js` added for PCM16 validation and chunking, plus rate helpers (`estimateBase64DecodedBytes`, duration/bytes per second).
- VAD modes: server_vad is configurable and forwarded to providers; manual VAD is fully supported.
	- Exposed to clients via `session.update.vad` with fields: `type` ('server_vad' | 'manual'), `silence_duration_ms`, `prefix_padding_ms`, `start_sensitivity`, `end_sensitivity`.
	- OpenAI: mapped to `turn_detection` (server_vad params) or disabled (`type: 'none'`) for manual.
	- Gemini: mapped to `realtimeInputConfig.automaticActivityDetection` (sensitivities/prefix/silence) or disabled for manual; commits delimit turns.
 - Metrics & logging: T12 completed — lightweight `metrics.service.js` added and wired into the realtime service; see Recent Updates.
- Rate limits & backpressure (T11):
	- Enforces APM (audio seconds per minute) and per-second throughput (based on model sample rate).
	- Bounded queue by `realtime.audio.max_buffer_ms`; emits `rate_limits.updated`.
	- Pauses client reads (`ws._socket.pause()`) on backlog or upstream backpressure; resumes when drained; emits `warning` events `backpressure_paused`/`backpressure_resumed`.

## Milestones
- [x] M1: WS endpoint returns session.created (T03) — Phase 1 complete
- [x] M2: Migrate endpoint to /v1/realtime/transcription (T05)
- [x] M3: OpenAI path end-to-end transcript (T06) — adapter implemented, upstream session.update sent, normalization/tests in place
- [x] M4: Gemini path end-to-end transcript via SDK (T07) — adapter scaffolded with SDK, wiring in service, normalization/tests in place
	— VAD mapping implemented (automaticActivityDetection/disabled) and manual VAD flow via commit.
- [x] M5: Limits/metrics/logging in place (T11–T12)
- [ ] M6: Docs, example, and smoke tests (T14–T16)

## Recent Updates
- 2025-08-23: VAD controls added and wired through adapters.
	- Util: `src/utils/vad.js` with provider mappings (OpenAI turn_detection; Gemini automaticActivityDetection).
	- Service: passes `vad` from `session.update` to Gemini adapter on connect; OpenAI uses mapping on `transcription_session.update`.
	- Adapters: OpenAI `sendSessionUpdate` uses VAD mapping; Gemini `connect` applies `realtimeInputConfig` and supports manual VAD with `commit`.
	- Tests: `tests/unit/vad-mapping.test.js` added; all unit suites pass.
- 2025-08-23: Phase 2 — Align to new plan and provider adapters completed (T05–T09).
	- Server: `src/server.js` migrates WS path to `/v1/realtime/transcription`; old path returns 410 Gone.
	- Service: `src/services/realtime.service.js` now pushes `transcription_session.update` on first connect and on `session.update`; routes `input_audio.append|commit|clear`; consumes provider events and emits unified events via normalizer; improved error envelopes.
	- Adapters: `src/providers/openai/realtime.adapter.js` production-ready (connect timeout, queue before open, heartbeat, safe send, onMessage/onError/onClose). `src/providers/gemini/realtime.adapter.js` uses `@google/genai` live SDK.
	- Normalization: `src/utils/realtime-normalizer.js` created and used by service. Unit tests added for OpenAI and Gemini mappings.
	- Audio utils: `src/utils/audio.js` created for PCM16 validation and chunking with unit tests.
	- Examples: `examples/javascript/realtime-smoke.js` points to new path.
	- Deps: `package.json` includes `@google/genai` and `ws`.

Details:
- `package.json`: now includes `@google/genai` and `ws`.
- `config/default.yaml` and `config/development.yaml`: realtime block present (dev enabled, prod disabled).
- `src/config/index.js`: realtime schema/defaults validated and surfaced.
- `src/server.js`: HTTP upgrade listener for `/v1/realtime/transcription`; old path responds 410 Gone.
- `src/controllers/realtime.controller.js`: basic auth gate; emits `session.created`; delegates to service.
- `src/services/realtime.service.js`: session registry, idle-timeout, upstream adapter wiring, normalization, and error envelopes.
- `src/utils/realtime-normalizer.js`: provider→unified event mapping.
- `src/utils/audio.js`: PCM16 helpers.
- Tests: `tests/unit/openai-normalization.test.js`, `tests/unit/gemini-normalization.test.js`, `tests/unit/audio-utils.test.js` passing.

- 2025-08-23: Observability (T12) completed.
	- Created `src/services/metrics.service.js` which exposes Prometheus-compatible metrics when `prom-client` is available and a safe in-memory fallback otherwise.
	- Metrics added:
		- `realtime_sessions_active` (gauge)
		- `realtime_audio_seconds_total` (counter)
		- `realtime_transcript_tokens_total` (counter)
		- `realtime_response_latency_ms` (histogram)
		- `realtime_errors_total` (counter)
	- Wired into `src/services/realtime.service.js`:
		- sessions_active increment/decrement on create/close
		- audio seconds counted on successful sends/drain
		- transcript tokens approximated on `transcript.done`
		- response latency measured from `input_audio.commit` → first `transcript.delta`
		- errors incremented on error send paths
	- Tests: unit suites remain green after the changes.

- 2025-08-23: T11 — Rate limits and backpressure implemented.
	- Service: per-session windows for per-second throughput and per-minute APM; queue with max_buffer cap; drain loop; timer cleanup on close.
	- Pause/Resume: pause client reads on backlog or upstream adapter backpressure; resume when queue drains; emit `rate_limits.updated` and `warning` events.
	- Utils: added `estimateBase64DecodedBytes` and related helpers in `src/utils/audio.js`.
	- Tests: `tests/unit/realtime-throttle.test.js` (APM error + rate updates), `tests/unit/realtime-pause.test.js` (pause/resume flow) — passing.

Smoke test:
- Ran example `examples/javascript/realtime-smoke.js` against local server on port 8081; observed `session.created` and `session.updated` events.

## Blockers
- None

## Links
- Plan: `docs/realtimeapi-enhancement.md`
- Tasks: `development/realtime-transcription.tasks.md`
- OpenAI Realtime: `docs/openai-realtime-api.md`
- Gemini Live: `docs/gemini-realtime-api.md`
