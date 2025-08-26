# Models configuration in LLM Gateway

This guide explains how models are defined, discovered, and filtered by the Gateway, including realtime models and the OpenAI-compatible /v1/models API.

## Where configuration comes from

- Base file: `config/default.yaml`
- Environment override: `config/{NODE_ENV}.yaml`
- Environment variables: applied by `src/config/index.js` after files are merged.

Provider API keys and flags (e.g., OPENAI_USE_RESPONSES_API) are read from env vars; see `src/config/index.js` for details.

## Provider model catalogs vs. runtime behavior

- Source of truth (supported models): provider adapters expose a static catalog in code.
  - OpenAI: `src/providers/openai/openai.models.js`
  - Gemini: corresponding adapter (models are mapped in its adapter)
- Gateway aggregates supported models at runtime via `gatewayService.getAvailableModels()`.
- The YAML provider model entries under `providers.openai.models` are informational (costs/features) and do not directly control which models are accepted by the adapter. For admission/validation, the adapter catalogs are authoritative.
- Realtime models are additionally declared under `realtime.models` in YAML (see below) and used by the Gateway for realtime-aware filtering and defaults.

## Realtime configuration (default.yaml)

Section: `realtime`
- `enabled`: enable/disable realtime features at the gateway level
- `models`: list of realtime-capable or audio pipeline models with:
  - `id`: model id (e.g., `gpt-4o-mini-realtime`, `gemini-2.0-flash-live-001`)
  - `provider`: `openai` or `gemini`
  - `input.sample_rate_hz` and `input.mime_type`: preferred inbound audio format
  - `vad_default`: `server_vad`, `semantic_vad`, or `manual`
- Audio/VAD/security/limits: tuning knobs for realtime sessions (buffer sizes, VAD settings, idle limits, etc.)

How the Gateway uses this:
- A model is considered “realtime” if either:
  1) its capabilities include `realtime` from the provider’s catalog; or
  2) its id appears in `realtime.models` in YAML.

## Capabilities and types

Each model in the provider catalog exposes:
- `type`: one of `completion`, `embedding`, `transcription`, `tts`
- `capabilities`: array such as `completion`, `streaming`, `multimodal`, `audio`, `realtime`, `embedding`, `transcription`, `tts`, `web_search`

Common capability synonyms the Gateway accepts when filtering:
- chat → completion
- stt, asr, transcribe → transcription
- speech → tts
- vision → multimodal
- audio → audio (also matches models whose type is tts or transcription)
- realtime, streaming, web_search

## Models API (OpenAI-compatible)

Base route: `/v1/models`

- GET `/v1/models` — returns a list, with optional query params:
  - `capability`: comma-separated (case-insensitive; supports synonyms). AND semantics when multiple are provided.
  - `type`: comma-separated among `completion,embedding,transcription,tts`.
  - `provider`: comma-separated among `openai,gemini`.
  - `realtime`: `true|1|yes` to restrict to realtime-capable models (capability or listed in YAML `realtime.models`).
  - `search`: substring filter on model id.
- GET `/v1/models/capability/:capability` — returns models matching the capability (same synonyms and realtime logic).
- GET `/v1/models/:model` — returns details about one model (404 if not supported).

Notes
- When no query params are passed, `/v1/models` returns all available models from initialized providers.
- If no models match a capability (route variant), you’ll get a 404 payload with `type: not_found`.

## Examples

Only realtime models (from capability or YAML realtime list):
- GET `/v1/models?realtime=true`
- GET `/v1/models/capability/realtime`

Chat-only models (aka completion):
- GET `/v1/models?capability=chat`

Speech-to-text (transcription):
- GET `/v1/models?capability=stt`

Text-to-speech:
- GET `/v1/models?capability=tts`

Filter by provider and type:
- GET `/v1/models?provider=openai,gemini&type=transcription`

Search by id substring:
- GET `/v1/models?search=realtime`

## Adding or updating models

- For OpenAI, add/update entries in `src/providers/openai/openai.models.js` (id, type, capabilities, limits, and cost metadata used by the adapter). The adapter uses this catalog for validation.
- Optionally, mirror cost/feature data in `config/default.yaml` under `providers.openai.models` for documentation purposes.
- For realtime: add the model id to `realtime.models` in `default.yaml` if you want it recognized as realtime for filtering and to specify audio/VAD defaults.
- Restart the Gateway (or reload config if hot-reload is available) for changes to take effect.

## Rate limiting

`config/default.yaml` exposes a models-specific rate limit at `rateLimit.models` (defaults are conservative because it’s intended for internal checks). Adjust to your needs.

## Troubleshooting

- 404 on `/v1/models/:model`: model id isn’t in the provider catalog or the provider didn’t initialize.
- Empty results on capability filters: check capability spelling and supported synonyms; confirm the provider adapter lists that capability; for `realtime`, ensure either the capability is present in the catalog or the id is in `realtime.models`.
- Provider not initialized: verify API keys and base URLs in `default.yaml` or environment variables.

---

For realtime audio specifics (VAD, chunking, session security), see `docs/realtime-transcription.md`.
