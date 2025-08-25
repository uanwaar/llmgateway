// Realtime transcription test via LLM Gateway (Gemini provider behind gateway)
import WebSocket from 'ws';
import * as fs from 'node:fs';
import pkg from 'wavefile';
const { WaveFile } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const GATEWAY_WS_URL = process.env.GATEWAY_WS_URL || 'ws://localhost:8080/v1/realtime/transcription';
const AUDIO_FILE = process.env.AUDIO_FILE || 'tests/audio-files/16KHz/11s.wav';
const MODEL = process.env.MODEL || 'gemini-2.0-flash-live-001';
// VAD options: 'manual' (use commit to delimit the turn) or 'server_vad'
const VAD_TYPE = process.env.VAD_TYPE || 'manual';
const SUPPRESS_MODEL = (process.env.SUPPRESS_MODEL || '1') === '1';

// Sends JSON with backpressure awareness
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

async function toPcm16MonoBase64Chunks(filePath, targetHz = 16000, chunkMs = 320) {
  const fileBuffer = fs.readFileSync(filePath);
  const wav = new WaveFile();
  wav.fromBuffer(fileBuffer);

  // Normalize format: 16-bit, mono, 16kHz
  if (wav.fmt.numChannels > 1) {
    // Simple downmix: take first channel via getSamples(true, Int16Array) interleaved
    // For real downmix, average channels—assuming source test files are mono already.
  }
  wav.toSampleRate(targetHz);
  wav.toBitDepth('16');

  // Int16 interleaved samples as typed array
  const samples = wav.getSamples(true, Int16Array);
  const pcmBuffer = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);

  const bytesPerSecond = targetHz * 2; // 16-bit mono
  const chunkBytes = Math.max(bytesPerSecond * (chunkMs / 1000), 1) | 0;

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

      // Configure session: transcription-only at provider level
      const sessionUpdate = {
        type: 'session.update',
        data: {
          model: MODEL,
          // Strict instruction (optional when suppressing model output)
          system_instruction:
            'You are a transcription assistant. Only transcribe the audio you receive without any additional commentary.',
          // Enable input transcription at provider
          input_audio_transcription: {},
          response_modalities: ['TEXT'],
          // Optional debug mirror
          include: { raw_upstream: process.env.DEBUG_UPSTREAM === '1' },
          // VAD selection remains client-owned
          vad: VAD_TYPE === 'server_vad' ? { type: 'server_vad' } : { type: 'manual' }
        }
      };

      await sendJSON(ws, sessionUpdate);
      console.log('⚙️  Sent session.update');

      // Prepare audio into PCM16 chunks (avoid >5s buffer; chunk ~320ms)
      console.log(`🎤 Loading audio: ${AUDIO_FILE}`);
      const { chunks, seconds } = await toPcm16MonoBase64Chunks(AUDIO_FILE, 16000, 320);
      console.log(`ℹ️  Audio duration ≈ ${seconds.toFixed(2)}s, chunks: ${chunks.length}`);

      // If manual VAD, explicitly mark start of activity
      if (VAD_TYPE === 'manual') {
        await sendJSON(ws, { type: 'input_audio.activity_start' });
      }

      // Stream chunks (audio must be a base64 string per gateway contract)
      for (let i = 0; i < chunks.length; i++) {
        const msg = {
          type: 'input_audio.append',
          audio: chunks[i],
        };
        await sendJSON(ws, msg);

        // Gentle pacing to respect buffer/backpressure protections
        if (ws.bufferedAmount > 256 * 1024) {
          // wait for socket to drain a bit
          while (ws.bufferedAmount > 64 * 1024) {
            await sleep(10);
          }
        }
      }

      // If manual VAD, signal end of activity just after last audio
      if (VAD_TYPE === 'manual') {
        await sendJSON(ws, { type: 'input_audio.activity_end' });
      }

      // Commit to delimit the turn
      await sendJSON(ws, { type: 'input_audio.commit' });
      console.log('🧾 Sent input_audio.commit');

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
        console.log('📉 rate_limits.updated:', evt.minute || evt.data || evt);
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
      case 'transcript.done': {
        const text = evt.data?.text ?? evt.text ?? '';
        if (text) fullTranscript += text;
        gotTranscriptDone = true;
        console.log('\n✅ transcript.done');
        console.log('\n--- Transcription Result ---');
        console.log(fullTranscript.trim() || '(empty)');
        console.log('--- End Transcription ---\n');
        // Close shortly after done
        setTimeout(() => ws.close(), 250);
        break;
      }
      default:
        // Useful for debugging other normalized events
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