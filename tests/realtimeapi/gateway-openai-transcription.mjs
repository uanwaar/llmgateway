// Realtime transcription test via LLM Gateway (OpenAI provider behind gateway)
import WebSocket from 'ws';
import * as fs from 'node:fs';
import pkg from 'wavefile';
const { WaveFile } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// Defaults chosen to match OpenAI transcription models configured in config.realtime.models
// - gpt-4o-mini-transcribe/gpt-4o-transcribe expect 24kHz PCM16
// - whisper-1 expects 16kHz PCM16
const GATEWAY_WS_URL = process.env.GATEWAY_WS_URL || 'ws://localhost:8080/v1/realtime/transcription';
const MODEL = process.env.MODEL || 'gpt-4o-mini-transcribe';
const DEFAULT_AUDIO_24K = 'tests/audio-files/24KHz/11s.wav';
const DEFAULT_AUDIO_16K = 'tests/audio-files/16KHz/11s.wav';
const AUDIO_FILE = process.env.AUDIO_FILE || (MODEL.includes('whisper') ? DEFAULT_AUDIO_16K : DEFAULT_AUDIO_24K);
// VAD options: 'manual' (use activity markers + commit) or 'server_vad'
const VAD_TYPE = process.env.VAD_TYPE || 'manual';
const DEBUG_UPSTREAM = (process.env.DEBUG_UPSTREAM || '0') === '1';

// Sends JSON with callback completion
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

async function toPcm16MonoBase64Chunks(filePath, targetHz, chunkMs = 320) {
  const fileBuffer = fs.readFileSync(filePath);
  const wav = new WaveFile();
  wav.fromBuffer(fileBuffer);

  // Normalize to target sample rate and 16-bit depth
  wav.toSampleRate(targetHz);
  wav.toBitDepth('16');

  // Extract mono Int16 samples (assumes mono or takes first channel)
  const samples = wav.getSamples(true, Int16Array);
  const pcmBuffer = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);

  const bytesPerSecond = targetHz * 2; // 16-bit mono
  const chunkBytes = Math.max((bytesPerSecond * (chunkMs / 1000)) | 0, 1);

  const chunks = chunkBuffer(pcmBuffer, chunkBytes).map((c) => c.toString('base64'));
  const seconds = pcmBuffer.length / bytesPerSecond;
  return { chunks, seconds, mimeType: `audio/pcm;rate=${targetHz}` };
}

async function main() {
  // Pick target SR based on model
  const isWhisper = /whisper/i.test(MODEL);
  const targetHz = isWhisper ? 16000 : 24000;

  console.log(`🔗 Connecting to gateway: ${GATEWAY_WS_URL}`);
  const ws = new WebSocket(GATEWAY_WS_URL);

  let fullTranscript = '';
  let gotTranscriptDone = false;

  ws.on('open', async () => {
    try {
      console.log('✅ WS connected');

      // Configure session. Use prompt and manual VAD by default per enhancement notes
      const sessionUpdate = {
        type: 'session.update',
        data: {
          model: MODEL,
          language: 'en',
          prompt:
            'You are a transcription assistant. Only transcribe the audio without any additional commentary.',
          include: { raw_upstream: DEBUG_UPSTREAM },
          vad: VAD_TYPE === 'server_vad' ? { type: 'server_vad' } : { type: 'manual' },
        },
      };

      await sendJSON(ws, sessionUpdate);
      console.log('⚙️  Sent session.update');

      // Prepare audio as base64 PCM16 chunks; keep chunks well under 32KB
      const file = AUDIO_FILE;
      console.log(`🎤 Loading audio: ${file}`);
      const { chunks, seconds } = await toPcm16MonoBase64Chunks(file, targetHz, 320);
      console.log(`ℹ️  Audio duration ≈ ${seconds.toFixed(2)}s, chunks: ${chunks.length}, sr=${targetHz}`);

      // Manual VAD markers if selected
      if (VAD_TYPE === 'manual') {
        await sendJSON(ws, { type: 'input_audio.activity_start' });
      }

      // Stream chunks
      for (let i = 0; i < chunks.length; i++) {
        const msg = {
          type: 'input_audio.append',
          audio: chunks[i], // gateway accepts base64 string
        };
        await sendJSON(ws, msg);

        // Gentle pacing to respect gateway backpressure/limits
        if (ws.bufferedAmount > 256 * 1024) {
          while (ws.bufferedAmount > 64 * 1024) {
            await sleep(10);
          }
        }
      }

      if (VAD_TYPE === 'manual') {
        await sendJSON(ws, { type: 'input_audio.activity_end' });
      }

      // Delimit the turn explicitly
      await sendJSON(ws, { type: 'input_audio.commit' });
      console.log('🧾 Sent input_audio.commit');

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
      case 'rate_limits.updated':
        console.log('📉 rate_limits.updated:', evt.minute || evt.data || evt);
        break;
      case 'warning':
        console.warn('⚠️  warning:', evt.reason || evt.code || evt.message || evt);
        break;
      case 'error':
        console.error('💥 error:', evt.code || evt.message || evt);
        break;
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
        if (text) fullTranscript += text;
        gotTranscriptDone = true;
        console.log('\n✅ transcript.done');
        console.log('\n--- Transcription Result ---');
        console.log(fullTranscript.trim() || '(empty)');
        console.log('--- End Transcription ---\n');
        setTimeout(() => ws.close(), 250);
        break;
      }
      case 'debug.upstream': {
        if (DEBUG_UPSTREAM) console.log('🐞 debug.upstream:', JSON.stringify(evt.raw).slice(0, 1000));
        break;
      }
      default:
        // For visibility into other normalized events
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
