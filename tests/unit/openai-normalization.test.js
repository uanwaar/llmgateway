/* eslint-disable no-undef */
const { normalize } = require('../../src/utils/realtime-normalizer');

function makeSessionLike() {
  // Create a fake ws-like sender
  const ws = { sent: [], send(obj) { this.sent.push(JSON.parse(obj)); } };
  return { ws };
}

describe('OpenAI event normalization to transcript.*', () => {
  test('maps delta and completed to transcript.delta|done', () => {
  const { ws } = makeSessionLike();

    // Feed OpenAI events
    const events = [
      { type: 'conversation.item.input_audio_transcription.delta', delta: 'Hello' },
      { type: 'conversation.item.input_audio_transcription.delta', delta: ' world' },
      { type: 'conversation.item.input_audio_transcription.completed', transcript: 'Hello world' },
    ];

    events.forEach((evt) => {
      const normalized = normalize('openai', evt);
      normalized.forEach(u => ws.send(JSON.stringify(u)));
    });

    expect(ws.sent).toEqual([
      { type: 'transcript.delta', text: 'Hello' },
      { type: 'transcript.delta', text: ' world' },
      { type: 'transcript.done', text: 'Hello world' },
    ]);

  // no cleanup needed
  });

  test('forwards speech and rate limit events and normalizes error', () => {
  const { } = makeSessionLike();
    const events = [
      { type: 'input_audio_buffer.speech_started', ts: 1 },
      { type: 'input_audio_buffer.speech_stopped', ts: 2 },
      { type: 'rate_limits.updated', limit: { rpm: 100 } },
      { type: 'error', error: { code: 'bad_request', message: 'oops' } },
    ];

  const out = events.flatMap((e) => normalize('openai', e));
    expect(out).toEqual([
      { type: 'speech_started', ts: 1, },
      { type: 'speech_stopped', ts: 2, },
      { type: 'rate_limits.updated', limit: { rpm: 100 } },
      { type: 'error', code: 'bad_request', message: 'oops', provider: 'openai', details: { code: 'bad_request', message: 'oops' } },
    ]);
  });
});
