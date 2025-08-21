/**
 * Audio utilities for realtime streaming
 * - Base64 framing/decoding
 * - PCM16 mono validation helpers
 * - Chunk sizing and simple duration math
 *
 * Notes:
 * - We don't resample in Phase 2; enforce correct sample rates via config/session.
 * - PCM16 mono bytes per sample = 2.
 */

const BYTES_PER_SAMPLE_PCM16 = 2; // mono 16-bit

function encodeBufferToBase64(buf) {
	if (!Buffer.isBuffer(buf)) throw new Error('audio.encode requires Buffer');
	return buf.toString('base64');
}

function decodeBase64ToBuffer(b64) {
	if (typeof b64 !== 'string') throw new Error('audio.decode requires base64 string');
	// Validate base64 roughly
	const sanitized = b64.replace(/\s/g, '');
	return Buffer.from(sanitized, 'base64');
}

/**
 * Validate a provided MIME type like "audio/pcm;rate=16000" matches expected
 */
function validateMimeTypeRate(mime, expected) {
	if (!mime || !expected) return { ok: false, reason: 'missing_mime' };
	const norm = (s) => String(s).trim().toLowerCase();
	if (norm(mime) !== norm(expected)) {
		return { ok: false, reason: 'mime_mismatch', expected, received: mime };
	}
	return { ok: true };
}

/**
 * Validate PCM16 mono chunk length and basic properties.
 * Cannot infer sample rate from raw PCM; rely on session/input config and optional mime.
 */
function validatePcm16Chunk(buf, opts = {}) {
	if (!Buffer.isBuffer(buf)) return { ok: false, reason: 'not_buffer' };
	if (buf.length === 0) return { ok: false, reason: 'empty' };
	if (buf.length % BYTES_PER_SAMPLE_PCM16 !== 0) return { ok: false, reason: 'not_pcm16_aligned' };
	const { maxChunkBytes } = opts;
	if (maxChunkBytes && buf.length > maxChunkBytes) return { ok: false, reason: 'chunk_too_large' };
	return { ok: true };
}

function getDurationMsForPcm16(buf, sampleRateHz) {
	if (!Buffer.isBuffer(buf) || !sampleRateHz) return 0;
	const samples = buf.length / BYTES_PER_SAMPLE_PCM16; // mono
	return (samples / sampleRateHz) * 1000;
}

/**
 * Split a buffer into chunks close to targetBytes (not exceeding maxBytes).
 */
function splitBuffer(buf, targetBytes, maxBytes) {
	if (!Buffer.isBuffer(buf)) throw new Error('splitBuffer requires Buffer');
	const chunks = [];
	let offset = 0;
	const size = Math.max(1, Math.min(maxBytes || targetBytes || buf.length, buf.length));
	const step = Math.max(1, targetBytes || size);
	while (offset < buf.length) {
		const end = Math.min(buf.length, offset + step);
		const slice = buf.subarray(offset, end);
		chunks.push(slice);
		offset = end;
	}
	return chunks;
}

module.exports = {
	BYTES_PER_SAMPLE_PCM16,
	encodeBufferToBase64,
	decodeBase64ToBuffer,
	validateMimeTypeRate,
	validatePcm16Chunk,
	getDurationMsForPcm16,
	splitBuffer,
};
