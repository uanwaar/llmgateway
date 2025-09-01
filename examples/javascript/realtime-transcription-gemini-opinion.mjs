// Realtime transcription + model opinion (Gemini via Gateway)
// Note: Only Gemini models support additional commentary alongside transcription.
// OpenAI transcription path does not emit model commentary.

import WebSocket from 'ws';
import * as fs from 'node:fs';
import pkg from 'wavefile';
const { WaveFile } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// Configurable via env; sane defaults for local dev
const GATEWAY_WS_URL = process.env.GATEWAY_WS_URL || 'ws://localhost:8080/v1/realtime/transcription';
const AUDIO_FILE = process.env.AUDIO_FILE || 'tests/audio-files/16KHz/11s.wav';
const MODEL = process.env.MODEL || 'gemini-2.0-flash-live-001';
// VAD: 'manual' (client markers + commit) or 'server_vad' (upstream activity detection)
const VAD_TYPE = process.env.VAD_TYPE || 'manual';
const VAD_SILENCE_MS = Number(process.env.VAD_SILENCE_MS || '500') || undefined;
const VAD_PREFIX_MS = Number(process.env.VAD_PREFIX_MS || '') || undefined;
const VAD_START_SENS = process.env.VAD_START_SENS || undefined; // HIGH|MEDIUM|LOW
const VAD_END_SENS = process.env.VAD_END_SENS || undefined;   // HIGH|MEDIUM|LOW
// Auto-VAD tail helpers
const AUTO_VAD_APPEND_SILENCE_MS = Number(process.env.AUTO_VAD_APPEND_SILENCE_MS || '1200');
const AUTO_VAD_POST_WAIT_MS = Number(process.env.AUTO_VAD_POST_WAIT_MS || '1500');
const AUTO_VAD_COMMIT_FALLBACK = (process.env.AUTO_VAD_COMMIT_FALLBACK || '0') === '1';

// Model commentary is delivered via normalized events (model.delta/model.done)

function sendJSON(ws, obj) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(obj);
    ws.send(data, (err) => (err ? reject(err) : resolve()));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunkBuffer(buf, chunkBytes) {
  const chunks = [];
  for (let i = 0; i < buf.length; i += chunkBytes) {
    chunks.push(buf.subarray(i, Math.min(i + chunkBytes, buf.length)));
  }
  return chunks;
}

async function toPcm16MonoBase64Chunks(filePath, targetHz = 16000, chunkMs = 200) {
  const fileBuffer = fs.readFileSync(filePath);
  const wav = new WaveFile();
  wav.fromBuffer(fileBuffer);
  // Normalize: 16-bit, mono, 16kHz
  wav.toSampleRate(targetHz);
  wav.toBitDepth('16');
  const samples = wav.getSamples(true, Int16Array);
  const pcmBuffer = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const bytesPerSecond = targetHz * 2; // 16-bit mono
  const chunkBytes = Math.max(bytesPerSecond * (chunkMs / 1000), 1) | 0;
  const chunks = chunkBuffer(pcmBuffer, chunkBytes).map((c) => c.toString('base64'));
  const seconds = pcmBuffer.length / bytesPerSecond;
  return { chunks, seconds };
}

async function main() {
  console.log(`🔗 Connecting to gateway: ${GATEWAY_WS_URL}`);
  const ws = new WebSocket(GATEWAY_WS_URL);

  let fullTranscript = '';
  let gotTranscriptDone = false;
  const modelSegments = [];

  ws.on('open', async () => {
    try {
      console.log('✅ WS connected');

      // Configure session for Gemini transcription + mirror upstream for model commentary
      const sessionUpdate = {
        type: 'session.update',
        data: {
          model: MODEL,
          // Strict guidance so model commentary reflects the speech
          system_instruction: 'explain the technical terms used by speaker',
          input_audio_transcription: {},
          response_modalities: ['TEXT'],
          // Enable normalized model commentary events from the gateway
          // Set include.model_output=true to receive model-origin deltas alongside transcript
          include: { model_output: true },
          vad: VAD_TYPE === 'server_vad'
            ? {
                type: 'server_vad',
                ...(VAD_SILENCE_MS ? { silence_duration_ms: VAD_SILENCE_MS } : {}),
                ...(VAD_PREFIX_MS ? { prefix_padding_ms: VAD_PREFIX_MS } : {}),
                ...(VAD_START_SENS ? { start_sensitivity: VAD_START_SENS } : {}),
                ...(VAD_END_SENS ? { end_sensitivity: VAD_END_SENS } : {}),
              }
            : { type: 'manual' },
        },
      };

      await sendJSON(ws, sessionUpdate);
      console.log('⚙️  Sent session.update');

      // Prepare audio chunks
      console.log(`🎤 Loading audio: ${AUDIO_FILE}`);
      const { chunks, seconds } = await toPcm16MonoBase64Chunks(AUDIO_FILE, 16000, 200);
      console.log(`ℹ️  Audio duration ≈ ${seconds.toFixed(2)}s, chunks: ${chunks.length}`);

      if (VAD_TYPE === 'manual') {
        await sendJSON(ws, { type: 'input_audio.activity_start' });
      }

      for (let i = 0; i < chunks.length; i++) {
        await sendJSON(ws, { type: 'input_audio.append', audio: chunks[i] });
        // Simple pacing/backpressure care
        if (ws.bufferedAmount > 256 * 1024) {
          while (ws.bufferedAmount > 64 * 1024) await sleep(10);
        }
      }

      if (VAD_TYPE === 'manual') {
        await sendJSON(ws, { type: 'input_audio.activity_end' });
        await sendJSON(ws, { type: 'input_audio.commit' });
        console.log('🧾 Sent input_audio.commit (manual VAD)');
      } else {
        // Auto VAD helpers
        const sr = 16000;
        const ms = Math.max(0, AUTO_VAD_APPEND_SILENCE_MS | 0);
        if (ms > 0) {
          const bytes = (sr * 2 * ms) / 1000; // mono, 16-bit
          const silence = Buffer.alloc(bytes, 0).toString('base64');
          await sendJSON(ws, { type: 'input_audio.append', audio: silence });
        }
        await sleep(Math.max(0, AUTO_VAD_POST_WAIT_MS | 0));
        if (AUTO_VAD_COMMIT_FALLBACK) {
          await sendJSON(ws, { type: 'input_audio.commit' });
          console.log('🧾 Sent input_audio.commit (auto VAD fallback)');
        }
      }

      // Safety timeout
      setTimeout(() => {
        if (!gotTranscriptDone) {
          console.warn('⏱️  Timeout waiting for transcript; closing socket.');
          ws.close();
        }
      }, 30000);
    } catch (err) {
      console.error('❌ Send error:', err?.message || err);
      ws.close();
    }
  });

  ws.on('message', (data) => {
    let evt;
    try {
      evt = JSON.parse(data.toString());
    } catch {
      console.log('📦 Non-JSON message:', data);
      return;
    }

    const t = evt.type || evt.event || 'unknown';
    switch (t) {
      case 'session.created':
        console.log('📣 session.created');
        break;
      case 'session.updated':
        console.log('📣 session.updated');
        break;
      case 'warning':
        console.warn('⚠️  warning:', evt.data || evt.message || evt);
        break;
      case 'error':
        console.error('💥 error:', evt.data || evt.message || evt);
        break;
      case 'transcript.delta': {
        const delta = evt.data?.text ?? evt.text ?? '';
        if (delta) {
          fullTranscript += delta;
          process.stdout.write(delta);
        }
        break;
      }
      case 'model.delta': {
        const text = evt.data?.text ?? evt.text ?? '';
        if (typeof text === 'string' && text.length) modelSegments.push(text);
        break;
      }
  // (No debug.upstream handling; example relies on normalized model events only)
      case 'transcript.done': {
        const text = evt.data?.text ?? evt.text ?? '';
        if (text) fullTranscript += text;
        gotTranscriptDone = true;
        console.log('\n✅ transcript.done');
        console.log('\n--- Transcription Result ---');
        console.log(fullTranscript.trim() || '(empty)');
        if (modelSegments.length) {
          console.log('\n--- Model Response (Gemini) ---');
          modelSegments.forEach((seg, idx) => console.log(`Model Segment ${idx + 1}: "${seg}"`));
          console.log(`\n💬 Model Opinion: "${modelSegments.join('').trim()}"`);
        } else {
          console.log('\n(No model commentary captured; ensure include.model_output=true and a Gemini model is used)');
          console.log('Note: OpenAI transcription does not include commentary.');
        }
        console.log('--- End Transcription ---\n');
        setTimeout(() => ws.close(), 250);
        break;
      }
      default:
        // Useful for observing other events (rate_limits.updated, etc.)
        // console.log('📨 event:', t, JSON.stringify(evt));
        break;
    }
  });

  ws.on('error', (err) => {
    console.error('❌ WS error:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`🔌 WS closed (${code}) ${reason?.toString?.() || ''}`);
  });
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
