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
  const sc = evt && evt.serverContent;
  if (sc && sc.inputTranscription && sc.inputTranscription.text) {
    out.push({ type: 'transcript.delta', text: sc.inputTranscription.text });
  }
  if (sc && sc.turnComplete) {
    out.push({ type: 'transcript.done' });
  }
  if (sc && typeof sc.interrupted === 'boolean') {
    out.push({ type: 'interrupted', interrupted: sc.interrupted });
  }
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
