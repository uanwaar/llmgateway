const { decodeBase64ToBuffer, validatePcm16Chunk, getDurationMsForPcm16, BYTES_PER_SAMPLE_PCM16, validateMimeTypeRate } = require('../../../src/utils/audio');

describe('audio utils', () => {
  test('decode and validate PCM16 chunk', () => {
    const samples = 160; // 10ms at 16kHz
    const buf = Buffer.alloc(samples * BYTES_PER_SAMPLE_PCM16);
    const b64 = buf.toString('base64');
    const out = decodeBase64ToBuffer(b64);
    expect(out.length).toBe(buf.length);
    const valid = validatePcm16Chunk(out, { maxChunkBytes: 32768 });
    expect(valid.ok).toBe(true);
  });

  test('duration calc', () => {
    const samples = 320; // 20ms at 16kHz
    const buf = Buffer.alloc(samples * BYTES_PER_SAMPLE_PCM16);
    const ms = getDurationMsForPcm16(buf, 16000);
    expect(Math.round(ms)).toBe(20);
  });

  test('mime type validation', () => {
    const ok = validateMimeTypeRate('audio/pcm;rate=16000', 'audio/pcm;rate=16000');
    expect(ok.ok).toBe(true);
    const bad = validateMimeTypeRate('audio/pcm;rate=24000', 'audio/pcm;rate=16000');
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe('mime_mismatch');
  });

  test('chunk too large rejected', () => {
    const buf = Buffer.alloc(40000); // > 32768
    const res = validatePcm16Chunk(buf, { maxChunkBytes: 32768 });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('chunk_too_large');
  });
});
