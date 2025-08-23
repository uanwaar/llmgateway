/* eslint-disable no-undef */
const { normalize } = require('../../src/utils/realtime-normalizer');

describe('Gemini event normalization to transcript.*', () => {
  test('maps serverContent.inputTranscription and turnComplete to transcript.delta|done', () => {
    const events = [
      { serverContent: { inputTranscription: { text: 'Hello' } } },
      { serverContent: { inputTranscription: { text: ' world' } } },
      { serverContent: { turnComplete: true } },
    ];

    const out = events.flatMap((e) => normalize('gemini', e));
    expect(out).toEqual([
      { type: 'transcript.delta', text: 'Hello' },
      { type: 'transcript.delta', text: ' world' },
      { type: 'transcript.done' },
    ]);
  });

  test('passes through interrupted and usage and normalizes error', () => {
    const events = [
      { serverContent: { interrupted: true } },
      { usageMetadata: { totalTokenCount: 123 } },
      { error: { code: 'perm', message: 'denied' } },
    ];

    const out = events.flatMap((e) => normalize('gemini', e));
    expect(out).toEqual([
      { type: 'interrupted', interrupted: true },
      { type: 'usage', usage: { totalTokenCount: 123 } },
      { type: 'error', code: 'perm', message: 'denied', provider: 'gemini', details: { code: 'perm', message: 'denied' } },
    ]);
  });
});
