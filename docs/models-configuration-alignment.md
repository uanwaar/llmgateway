# Models configuration alignment (single source of truth)

This document proposes moving the Gateway to a single, unified models configuration used by all endpoints (chat, embeddings, audio, realtime) and providers (OpenAI, Gemini, etc.). It outlines required changes, a concrete schema, and migration steps.

## Why unify?

Today, models are described in multiple places:
- Provider adapter catalogs in code (e.g., `openai.models.js`, `gemini.models.js`)
- Provider sections in YAML (pricing/features), and
- `realtime.models` list for realtime/audio session defaults

This duplication causes drift (models added to YAML don’t appear in `/v1/models` unless adapters are updated) and extra work for filtering. A single source avoids inconsistency and simplifies runtime logic.

## Goals

- One configuration to define models and their capabilities per provider
- All endpoints resolve model availability from this same config
- Realtime/audio defaults embedded alongside the model entry (no separate realtime list)
- Backward-compatible filters and synonyms (chat, stt, tts, realtime, etc.)
- Minimal adapter-specific logic; adapters consume model definitions from the unified registry

## High-level design

- Introduce a `ModelRegistry` that loads, validates, and indexes models from config at startup
- Deprecate adapter-internal allowlists; use registry for model validation and feature checks
- Replace `realtime.models` with per-model `endpoints.realtime` settings in the unified model entries
- `gatewayService.getAvailableModels()` returns registry models; `/v1/models` filters against registry only
- Keep provider-level defaults (e.g., `providers.openai` baseUrl, timeouts) separate from model list

## Proposed YAML schema

Single-source under `models:` (top-level). Provider blocks remain for connection details only.

```yaml
version: 1

providers:
  openai:
    enabled: true
    baseUrl: https://api.openai.com/v1
    useResponsesAPI: true
  gemini:
    enabled: true
    baseUrl: https://generativelanguage.googleapis.com/v1beta

models:
  - id: gpt-4o-mini-realtime
    provider: openai
    type: completion              # completion | embedding | transcription | tts
    capabilities:                 # canonical capability names
      - completion
      - streaming
      - multimodal
      - audio
      - realtime
      - tools
    context_window: 128000        # nullable for non-token models
    max_tokens: 16384             # nullable for non-token models
    pricing:
      currency: USD
      unit: per_1M_tokens         # per_1M_tokens | per_minute | per_1M_characters
      input: 0.15
      output: 0.60
    features:                     # provider- or model-specific boolean flags
      vision: true
      json_mode: true
      system_messages: true
    endpoints:                    # per-endpoint enablement and overrides
      chat:
        enabled: true
      embeddings:
        enabled: false
      audio:
        transcription:
          enabled: false
        tts:
          enabled: false
      realtime:
        enabled: true
        input:
          sample_rate_hz: 24000
          mime_type: audio/pcm;rate=24000
        vad_default: server_vad    # server_vad | semantic_vad | manual
    tags: ["recommended", "omni"]
    deprecated: false

  - id: whisper-1
    provider: openai
    type: transcription
    capabilities: ["transcription", "translation"]
    pricing:
      currency: USD
      unit: per_minute
      input: 0.006
    endpoints:
      audio:
        transcription:
          enabled: true
          streaming: false
      realtime:
        enabled: false

  - id: gemini-2.0-flash-live-001
    provider: gemini
    type: completion
    capabilities: ["completion", "streaming", "multimodal", "audio", "realtime", "tools"]
    context_window: 1000000
    max_tokens: 8192
    pricing:
      currency: USD
      unit: per_1M_tokens
      input: 0.15
      output: 0.60
    endpoints:
      chat: { enabled: true }
      realtime:
        enabled: true
        input:
          sample_rate_hz: 16000
          mime_type: audio/pcm;rate=16000
        vad_default: server_vad
```

### Schema notes
- `models[*].capabilities` are the single canonical truth used by filters.
- Endpoint-specific settings sit under `models[*].endpoints`. For realtime/audio, required audio defaults live here.
- `pricing.unit` covers tokens, minutes, or characters; unused price fields can be omitted.
- Optional fields: `features`, `tags`, `deprecated`.
- Provider-level defaults can be applied if fields are omitted (e.g., default `mime_type`).

## Validation (Joi) updates

- Expand `src/config/index.js` schema to validate `models[*]` per above:
  - `id`: string, required
  - `provider`: enum of configured providers, required
  - `type`: enum (completion|embedding|transcription|tts)
  - `capabilities`: non-empty array of enums
  - `pricing`: optional; if present must include `currency` + `unit`, and numeric `input`/`output` depending on unit
  - `endpoints.chat.enabled`, `endpoints.embeddings.enabled` booleans
  - `endpoints.audio.transcription.enabled`, `.tts.enabled` booleans
  - `endpoints.realtime.enabled` boolean, and when enabled: `input.sample_rate_hz`, `input.mime_type`, `vad_default`
- Enforce unique model `id` across all providers

## Runtime changes

1) New `ModelRegistry` service
- Loads `config.models` and builds indexes:
  - by id (model -> full definition)
  - by provider
  - by type
  - by capability
- Exposes:
  - `list()`
  - `get(id)`
  - `filter({ provider, type, capabilities, realtime, search })`
  - `supports(id, capability)`

2) gatewayService
- Replace `getAvailableModels()` with registry-backed list
- Build `modelToProvider` from registry
- Selection and error messages derive from registry capabilities

3) Adapters (OpenAI, Gemini)
- Remove or gate hard-coded model catalogs behind a feature flag
- For validation: use `ModelRegistry.get(id)` and `supports(id, capability)`
- Keep adapter-specific transformers, clients, and extras (e.g., `responsesAPI`) intact

4) Realtime
- Remove `realtime.models` in YAML
- Derive realtime-enabled models via `models[*].endpoints.realtime.enabled`
- Use the per-model `input.sample_rate_hz`, `mime_type`, and `vad_default`

5) `/v1/models` filtering
- Query params map to registry filters:
  - `capability` (comma, AND semantics; synonyms considered in controller)
  - `type`, `provider`, `realtime`, `search`
- Controller stays API-compatible; internals call `ModelRegistry.filter`

## Capability synonyms (controller)

Keep a small translation map in the controller:
- chat → completion
- stt, asr, transcribe → transcription
- speech → tts
- vision → multimodal
- audio → audio (also match tts/transcription types)
- realtime, streaming, web_search (as-is)

This remains presentation-layer logic; registry stores canonical terms only.

## Migration plan

- Phase 1 (compat):
  - Implement `ModelRegistry` loading from config
  - Export registry data into adapters during init while still allowing adapter catalogs
  - `/v1/models` reads from registry
- Phase 2 (switch-over):
  - Gate adapter catalogs behind a flag (default off); raise on unknown model id
  - Move pricing/feature truth into config; adapter helpers may reference it for logging/metrics
- Phase 3 (cleanup):
  - Remove model definitions from adapters
  - Delete `realtime.models` config; use per-model `endpoints.realtime` only

## Testing & validation

- Unit tests for config schema validation (happy paths + misconfig)
- Registry tests: filtering, synonyms, realtime derivation, uniqueness
- Controller tests: `/v1/models`, `capability` route, query combinations
- Adapter tests: validation via registry, basic request paths still function

## Backward-compatibility

- Continue accepting existing query parameters
- Maintain existing IDs and provider names
- Optionally support a temporary compatibility loader that merges old `realtime.models` into `models[*].endpoints.realtime` until YAMLs are migrated

## Optional enhancements

- `availability`: add region/quotas or "beta" channel flags on models
- `routingHints`: allow per-model latency/cost hints for router
- `deprecation`: specify replacement model id
- `metadata`: free-form annotations for UI/tools

## Summary

Move to a single `models:` array at the top-level configuration, validated at startup and consumed by a `ModelRegistry`. All endpoints and providers use this registry, removing duplication and inconsistencies between YAML and adapter catalogs while preserving current API behavior and filters.
