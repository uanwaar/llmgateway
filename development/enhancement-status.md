# Enhancement Status — Realtime Transcription

How to use
- Purpose: Single source of truth for feature progress. Keep it short and current.
- When to update: After moving a task between states (Todo/In Progress/Blocked/Done), reaching a milestone, hitting a blocker, or finishing a PR.
- What to enter: Date, task IDs (from `realtime-transcription.tasks.md`), brief notes, links to PRs/commits/logs.

## Current Summary
- Feature flag: realtime.enabled = (unset)
- WS path: /v1/realtime/transcribe — (not wired)
- Providers: OpenAI (WS) — (not integrated), Gemini Live — (not integrated)
- VAD modes: server_vad (default), semantic_vad (OpenAI), manual — (not implemented)

## Milestones
- [ ] M1: WS endpoint returns session.created (T03)
- [ ] M2: OpenAI path end-to-end transcript (T05)
- [ ] M3: Gemini path end-to-end transcript (T06)
- [ ] M4: Limits/metrics/logging in place (T10–T11)
- [ ] M5: Docs, example, and smoke tests (T13–T15)

## Recent Updates
- 2025-08-21: Created tasks plan and status tracker. (No implementation started)

## Blockers
- None

## Links
- Plan: `docs/realtimeapi-enhancement.md`
- Tasks: `development/realtime-transcription.tasks.md`
- OpenAI Realtime: `docs/openai-realtime-api.md`
- Gemini Live: `docs/gemini-realtime-api.md`
