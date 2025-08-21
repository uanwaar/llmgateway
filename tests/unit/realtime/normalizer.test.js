const { normalizeOpenAI, normalizeGemini } = require('../../../src/utils/realtime-normalizer');

describe('realtime-normalizer', () => {
  test('OpenAI transcript delta', () => {
    const evt = { type: 'response.audio_transcript.delta', delta: 'Hello' };
    expect(normalizeOpenAI(evt)).toEqual({ type: 'transcript.delta', text: 'Hello' });
  });

  test('OpenAI transcript done', () => {
    const evt = { type: 'response.audio_transcript.done', transcript: 'Hello world' };
    expect(normalizeOpenAI(evt)).toEqual({ type: 'transcript.done', text: 'Hello world' });
  });

  test('OpenAI error mapping', () => {
    const evt = { type: 'error', error: { code: 'invalid_event', message: 'bad' } };
    expect(normalizeOpenAI(evt)).toEqual({ type: 'error', code: 'invalid_event', message: 'bad', details: evt.error });
  });

  test('Gemini serverContent delta vs done', () => {
    const delta = {
      serverContent: {
        modelTurn: { role: 'model', parts: [{ text: 'Hi' }] },
        turnComplete: false,
      },
    };
    expect(normalizeGemini(delta)).toEqual({ type: 'transcript.delta', text: 'Hi' });

    const done = {
      serverContent: {
        modelTurn: { role: 'model', parts: [{ text: 'Hi there' }] },
        turnComplete: true,
      },
    };
    expect(normalizeGemini(done)).toEqual({ type: 'transcript.done', text: 'Hi there' });
  });
});
