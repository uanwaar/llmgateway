// Realtime transcription test via LLM Gateway (OpenAI provider behind gateway)
import WebSocket from 'ws';
import * as fs from 'node:fs';
import pkg from 'wavefile';
const { WaveFile } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// Defaults tuned for OpenAI transcription path
const GATEWAY_WS_URL = process.env.GATEWAY_WS_URL || 'ws://localhost:8080/v1/realtime/transcription';
const AUDIO_FILE = process.env.AUDIO_FILE || 'tests/audio-files/24KHz/11s.wav';
const MODEL = process.env.MODEL || 'gpt-4o-mini-transcribe';
// Manual VAD by default (matches recent Gemini fixes); alternative: 'server_vad'
const VAD_TYPE = process.env.VAD_TYPE || 'manual';
// Optional VAD tuning (used when VAD_TYPE === 'server_vad')
const VAD_SILENCE_MS = Number(process.env.VAD_SILENCE_MS || '500') || undefined;
const VAD_PREFIX_MS = Number(process.env.VAD_PREFIX_MS || '300') || undefined;
// OpenAI path prefers 24kHz PCM16
const TARGET_SAMPLE_RATE = Number(process.env.TARGET_SAMPLE_RATE || '24000') || 24000;
// Auto-VAD tail handling (only when VAD_TYPE !== 'manual')
const AUTO_VAD_APPEND_SILENCE_MS = Number(process.env.AUTO_VAD_APPEND_SILENCE_MS || '1200');
const AUTO_VAD_POST_WAIT_MS = Number(process.env.AUTO_VAD_POST_WAIT_MS || '1500');
const AUTO_VAD_COMMIT_FALLBACK = (process.env.AUTO_VAD_COMMIT_FALLBACK || '0') === '1';

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

async function toPcm16MonoBase64Chunks(filePath, targetHz = 24000, chunkMs = 200) {
  const fileBuffer = fs.readFileSync(filePath);
  const wav = new WaveFile();
  wav.fromBuffer(fileBuffer);

  // Resample and format: 16-bit, mono, target sample rate
  wav.toSampleRate(targetHz);
  wav.toBitDepth('16');
  // If multi-channel, WaveFile#getSamples(true, Int16Array) returns interleaved; for test inputs we assume mono, else take first channel by stride copy
  const samples = wav.getSamples(true, Int16Array);
  const pcmBuffer = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);

  const bytesPerSecond = targetHz * 2; // 16-bit mono
  const chunkBytes = Math.max((bytesPerSecond * chunkMs) / 1000, 1) | 0;

  const chunks = chunkBuffer(pcmBuffer, chunkBytes).map((c) => c.toString('base64'));
  const seconds = pcmBuffer.length / bytesPerSecond;
  return { chunks, seconds, mimeType: `audio/pcm;rate=${targetHz}` };
}

async function main() {
  console.log(`🔗 Connecting to gateway: ${GATEWAY_WS_URL}`);
  const ws = new WebSocket(GATEWAY_WS_URL);

  let fullTranscript = '';
  let gotTranscriptDone = false;

  ws.on('open', async () => {
    try {
      console.log('✅ WS connected');

      // Configure session for strict transcription
      const sessionUpdate = {
        type: 'session.update',
        data: {
          model: MODEL,
          // Use 'prompt' to align with gateway mapping; ensures transcription-only behavior
          prompt:
            'You are a transcription assistant. Only transcribe the user audio verbatim. Do not add any commentary or responses.',
          // VAD selection (manual by default)
          vad:
            VAD_TYPE === 'server_vad'
              ? {
                  type: 'server_vad',
                  ...(VAD_SILENCE_MS ? { silence_duration_ms: VAD_SILENCE_MS } : {}),
                  ...(VAD_PREFIX_MS ? { prefix_padding_ms: VAD_PREFIX_MS } : {}),
                }
              : { type: 'manual' },
          // Optional language hint
          language: process.env.LANGUAGE || 'en',
        },
      };

      await sendJSON(ws, sessionUpdate);
      console.log('⚙️  Sent session.update');

      // Prepare audio into PCM16 chunks sized ~200ms each
      console.log(`🎤 Loading audio: ${AUDIO_FILE}`);
      const { chunks, seconds } = await toPcm16MonoBase64Chunks(
        AUDIO_FILE,
        TARGET_SAMPLE_RATE,
        200
      );
      console.log(`ℹ️  Audio duration ≈ ${seconds.toFixed(2)}s, chunks: ${chunks.length}`);

      // Manual VAD: explicit activity markers around audio
      if (VAD_TYPE === 'manual') {
        await sendJSON(ws, { type: 'input_audio.activity_start' });
      }

      // Stream audio chunks with gentle backpressure awareness
      for (let i = 0; i < chunks.length; i++) {
        await sendJSON(ws, { type: 'input_audio.append', audio: chunks[i] });
        if (ws.bufferedAmount > 256 * 1024) {
          while (ws.bufferedAmount > 64 * 1024) {
            await sleep(10);
          }
        }
      }

      if (VAD_TYPE === 'manual') {
        await sendJSON(ws, { type: 'input_audio.activity_end' });
        await sendJSON(ws, { type: 'input_audio.commit' });
        console.log('🧾 Sent input_audio.commit (manual VAD)');
      } else {
        // Server VAD: help with a bit of trailing silence and wait for end-of-speech
        const sr = TARGET_SAMPLE_RATE;
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

      // Safety timeout in case no transcript arrives
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
      case 'rate_limits.updated':
        // Show APM window usage
        console.log('📉 rate_limits.updated:', evt.minute || evt.data || evt);
        break;
      case 'warning':
        console.warn('⚠️  warning:', evt.reason || evt.code || evt.message || evt);
        break;
      case 'error':
        console.error('💥 error:', evt.code || evt.message || evt);
        break;
      case 'debug.upstream': {
        if (process.env.DEBUG_UPSTREAM === '1') {
          console.log('🐞 debug.upstream (truncated):', JSON.stringify(evt).slice(0, 500));
        }
        break;
      }
      case 'transcript.delta': {
        const delta = evt.data?.text ?? evt.text ?? '';
        if (delta) {
          fullTranscript += delta;
          process.stdout.write(delta);
        }
        break;
      }
      case 'transcript.done': {
        const text = evt.data?.text ?? evt.text ?? '';
        // If we didn't receive streaming deltas, fall back to final text
        if (!fullTranscript && text) {
          fullTranscript = text;
        }
        gotTranscriptDone = true;
        console.log('\n✅ transcript.done');
        console.log('\n--- Transcription Result ---');
        console.log(fullTranscript.trim() || '(empty)');
        console.log('--- End Transcription ---\n');
        setTimeout(() => ws.close(), 250);
        break;
      }
      default:
        console.log('📨 event:', t, JSON.stringify(evt));
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
