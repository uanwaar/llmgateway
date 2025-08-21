/**
 * Realtime event normalizer
 * Maps provider-specific WS events to the gateway-unified schema.
 *
 * Unified outbound (gateway->client):
 * - transcript.delta|done
 * - rate_limits.updated
 * - error
 * - session.created|updated (passed through from controller/service)
 */

function normalizeOpenAI(event) {
  if (!event || typeof event !== 'object') return null;
  const type = event.type;
  switch (type) {
  case 'response.audio_transcript.delta':
    return { type: 'transcript.delta', text: event.delta || '' };
  case 'response.audio_transcript.done':
    return { type: 'transcript.done', text: event.transcript || '' };
  case 'rate_limits.updated':
    return { type: 'rate_limits.updated', rate_limits: event.rate_limits };
  case 'error': {
    // OpenAI error envelope
    const e = event.error || {};
    return { type: 'error', code: e.code || 'provider_error', message: e.message || 'OpenAI error', details: e };
  }
  default:
    return null; // ignore others for now
  }
}

function normalizeGemini(event) {
  if (!event || typeof event !== 'object') return null;
  if (event.serverContent) {
    const sc = event.serverContent;
    // Transcription text typically in parts[].text for TEXT modality
    const parts = (sc.modelTurn && sc.modelTurn.parts) || [];
    const textParts = parts.filter(p => typeof p.text === 'string' && p.text.length > 0);
    if (textParts.length > 0) {
      // Gemini doesn't stream deltas in the same shape; assume these are deltas
      // If turnComplete, treat as done.
      if (sc.turnComplete) {
        return { type: 'transcript.done', text: textParts.map(p => p.text).join('') };
      }
      return { type: 'transcript.delta', text: textParts.map(p => p.text).join('') };
    }
    return null;
  }
  if (event.usageMetadata) {
    // Could expose as rate_limits.updated-like, but Gemini provides usage counters
    return { type: 'rate_limits.updated', rate_limits: event.usageMetadata };
  }
  if (event.goAway) {
    return { type: 'error', code: 'provider_goaway', message: 'Gemini is closing the connection', details: event.goAway };
  }
  return null;
}

function normalize(provider, event) {
  const p = String(provider || '').toLowerCase();
  if (p === 'openai') return normalizeOpenAI(event);
  if (p === 'gemini') return normalizeGemini(event);
  return null;
}

module.exports = {
  normalize,
  normalizeOpenAI,
  normalizeGemini,
};
