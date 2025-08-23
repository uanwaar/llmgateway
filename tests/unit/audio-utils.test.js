/* eslint-disable no-undef */
const {
  parseMimeSampleRate,
  assertValidInputAudio,
  splitPcm16IntoChunks,
  base64ToBuffer,
  bufferToBase64,
  pcm16DurationMsForBytes,
} = require('../../src/utils/audio');

function makeSinePcm16(durationMs, sampleRate = 16000, freq = 440) {
  const samples = Math.floor((durationMs / 1000) * sampleRate);
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const v = Math.sin(2 * Math.PI * freq * t);
    const s = Math.max(-1, Math.min(1, v));
    buf.writeInt16LE(Math.floor(s * 32767), i * 2);
  }
  return buf;
}

describe('audio utils', () => {
  test('parseMimeSampleRate extracts rate', () => {
    expect(parseMimeSampleRate('audio/pcm;rate=16000')).toBe(16000);
    expect(parseMimeSampleRate('audio/PCM;rate=8000')).toBe(8000);
    expect(parseMimeSampleRate('audio/pcm')).toBeUndefined();
  });

  test('assertValidInputAudio validates mime, rate 16000 and mono', () => {
    expect(() => assertValidInputAudio({ mimeType: 'audio/pcm;rate=16000', channels: 1 })).not.toThrow();
    expect(() => assertValidInputAudio({ mimeType: 'audio/wav;rate=16000', channels: 1 })).toThrow();
    expect(() => assertValidInputAudio({ mimeType: 'audio/pcm;rate=44100', channels: 1 })).toThrow();
    expect(() => assertValidInputAudio({ mimeType: 'audio/pcm;rate=16000', channels: 2 })).toThrow();
  });

  test('splitPcm16IntoChunks enforces chunk sizes and boundaries', () => {
    const buf = makeSinePcm16(250); // ~250ms of audio
    const chunks = splitPcm16IntoChunks(buf, 16000, 100);
    // Expect about 3 chunks (100ms, 100ms, 50ms)
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.every(c => c.length % 2 === 0)).toBe(true);
    const total = chunks.reduce((n, c) => n + c.length, 0);
    expect(total).toBe(buf.length);
  });

  test('base64 encode/decode roundtrip, and duration helper', () => {
    const buf = makeSinePcm16(100);
    const b64 = bufferToBase64(buf);
    const back = base64ToBuffer(b64);
    expect(Buffer.compare(buf, back)).toBe(0);
    const ms = pcm16DurationMsForBytes(buf.length, 16000, 1);
    expect(ms).toBeGreaterThanOrEqual(95);
    expect(ms).toBeLessThanOrEqual(105);
  });
});
