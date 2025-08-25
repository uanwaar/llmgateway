/**
 * Realtime event normalization utility
 * - Maps provider-specific events to unified gateway schema
 */

function normalizeOpenAI(evt) {
  const out = [];
  switch (evt?.type) {
    case 'conversation.item.input_audio_transcription.delta':
      if (evt.delta) out.push({ type: 'transcript.delta', text: evt.delta });
      break;
    case 'conversation.item.input_audio_transcription.completed':
      out.push({ type: 'transcript.done', text: evt.transcript || '' });
      break;
    case 'input_audio_buffer.speech_started':
      out.push({ ...evt, type: 'speech_started' });
      break;
    case 'input_audio_buffer.speech_stopped':
      out.push({ ...evt, type: 'speech_stopped' });
      break;
    case 'rate_limits.updated':
      out.push({ ...evt, type: 'rate_limits.updated' });
      break;
    case 'error':
      out.push({
        type: 'error',
        code: evt.error?.code || 'provider_error',
        message: evt.error?.message || 'OpenAI error',
        provider: 'openai',
        details: evt.error || undefined,
      });
      break;
    default:
      break;
  }
  return out;
}

function normalizeGemini(evt) {
  const out = [];
  // Some SDKs use serverContent, others may use realtimeServerContent; fall back to evt
  const sc = (evt && (evt.serverContent || evt.realtimeServerContent)) || evt || {};

  // Input transcription streaming
  if (sc && sc.inputTranscription && typeof sc.inputTranscription.text === 'string') {
    out.push({ type: 'transcript.delta', text: sc.inputTranscription.text, meta: { provider: 'gemini', source: 'input' } });
  }
  // Some variants: array of inputTranscriptions
  if (sc && Array.isArray(sc.inputTranscriptions)) {
    for (const t of sc.inputTranscriptions) {
      if (t && typeof t.text === 'string' && t.text.length) {
        out.push({ type: 'transcript.delta', text: t.text, meta: { provider: 'gemini', source: 'input' } });
      }
    }
  }
  // Fallback: plain text field
  if (typeof sc.text === 'string' && sc.text.length) {
    out.push({ type: 'transcript.delta', text: sc.text, meta: { provider: 'gemini', source: 'model' } });
  }
  // Model output text (not strictly input transcription, but useful for debugging)
  if (sc && sc.modelTurn && Array.isArray(sc.modelTurn.parts)) {
    const modelText = sc.modelTurn.parts
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('');
  if (modelText) out.push({ type: 'transcript.delta', text: modelText, meta: { provider: 'gemini', source: 'model' } });
  }

  // Turn boundaries / interruptions
  if (sc && sc.turnComplete) {
    out.push({ type: 'transcript.done', meta: { provider: 'gemini' } });
  }
  if (sc && typeof sc.interrupted === 'boolean') {
    out.push({ type: 'interrupted', interrupted: sc.interrupted });
  }

  // Usage metadata and errors
  if (evt && evt.usageMetadata) {
    out.push({ type: 'usage', usage: evt.usageMetadata });
  }
  if (evt && evt.error) {
    out.push({
      type: 'error',
      code: evt.error?.code || 'provider_error',
      message: evt.error?.message || 'Gemini error',
      provider: 'gemini',
      details: evt.error || undefined,
    });
  }

  return out;
}

function normalize(provider, evt) {
  if (provider === 'openai') return normalizeOpenAI(evt);
  if (provider === 'gemini') return normalizeGemini(evt);
  return [];
}

module.exports = { normalize, normalizeOpenAI, normalizeGemini };
