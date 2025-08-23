/**
 * Audio utilities for realtime transcription (PCM16 mono @ 16kHz)
 */

const BYTES_PER_SAMPLE = 2; // PCM16

function parseMimeSampleRate(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') return undefined;
  // Expect forms like: 'audio/pcm;rate=16000' (case-insensitive)
  const m = /audio\/pcm\s*;\s*rate\s*=\s*(\d+)/i.exec(mimeType);
  if (m) return Number(m[1]);
  return undefined;
}

function assertValidInputAudio({ mimeType, sampleRate, channels = 1 } = {}) {
  // Validate MIME
  const mimeOk = typeof mimeType === 'string' && /^audio\/pcm(\s*;|$)/i.test(mimeType);
  if (!mimeOk) {
    throw new Error('Invalid MIME type: expected audio/pcm;rate=16000');
  }
  // Determine sample rate from param or MIME
  const rateFromMime = parseMimeSampleRate(mimeType);
  const rate = sampleRate || rateFromMime;
  if (!rate || rate !== 16000) {
    throw new Error('Invalid sample rate: expected 16000 Hz');
  }
  if (channels !== 1) {
    throw new Error('Invalid channels: expected mono (1)');
  }
  return true;
}

function bytesPerSecond(sampleRate, channels = 1) {
  return sampleRate * channels * BYTES_PER_SAMPLE;
}

function pcm16DurationMsForBytes(byteLength, sampleRate, channels = 1) {
  const bps = bytesPerSecond(sampleRate, channels);
  if (!bps) return 0;
  return Math.floor((byteLength / bps) * 1000);
}

function base64ToBuffer(b64) {
  return Buffer.from(b64, 'base64');
}

function bufferToBase64(buf) {
  return Buffer.from(buf).toString('base64');
}

function estimateBase64DecodedBytes(b64) {
  if (!b64 || typeof b64 !== 'string') return 0;
  // Base64 decoding size approximation: floor(len * 3/4) minus padding
  const len = b64.length;
  const padding = (b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0));
  return Math.floor((len * 3) / 4) - padding;
}

function maxChunkBytesForMs(sampleRate = 16000, channels = 1, maxChunkMs = 100) {
  const bps = bytesPerSecond(sampleRate, channels);
  let bytes = Math.floor((bps * maxChunkMs) / 1000);
  if (bytes % BYTES_PER_SAMPLE !== 0) bytes -= (bytes % BYTES_PER_SAMPLE);
  return Math.max(bytes, BYTES_PER_SAMPLE);
}

function splitPcm16IntoChunks(buffer, sampleRate = 16000, maxChunkMs = 100, channels = 1) {
  if (!Buffer.isBuffer(buffer)) throw new Error('buffer must be a Buffer');
  const bps = bytesPerSecond(sampleRate, channels);
  const bytesPerMs = bps / 1000;
  let chunkBytes = Math.floor(bytesPerMs * maxChunkMs);
  // Ensure even number of bytes (whole samples)
  if (chunkBytes % BYTES_PER_SAMPLE !== 0) chunkBytes -= (chunkBytes % BYTES_PER_SAMPLE);
  if (chunkBytes <= 0) throw new Error('maxChunkMs too small');

  const chunks = [];
  let offset = 0;
  while (offset < buffer.length) {
    const end = Math.min(offset + chunkBytes, buffer.length);
    const sliceLen = end - offset;
    // Ensure we cut on sample boundary
    const evenLen = sliceLen - (sliceLen % BYTES_PER_SAMPLE);
    const nextEnd = offset + evenLen;
    chunks.push(buffer.slice(offset, nextEnd));
    offset = nextEnd;
  }
  return chunks;
}

// Placeholder for future resampling implementation; currently returns input unchanged
function resamplePcm16LinearStub(buffer, fromRate, toRate) {
  if (fromRate === toRate) return buffer;
  // Future: implement streaming-friendly linear interpolation
  // For now, explicitly not implemented to avoid silent quality issues
  throw new Error('Resampling not implemented');
}

module.exports = {
  BYTES_PER_SAMPLE,
  parseMimeSampleRate,
  assertValidInputAudio,
  bytesPerSecond,
  pcm16DurationMsForBytes,
  base64ToBuffer,
  bufferToBase64,
  splitPcm16IntoChunks,
  resamplePcm16LinearStub,
  estimateBase64DecodedBytes,
  maxChunkBytesForMs,
};
