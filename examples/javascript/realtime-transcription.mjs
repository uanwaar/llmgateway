// Realtime Transcription — JavaScript example (Node.js)
//
// Mandatory vs Optional parameters:
// - Mandatory (for reliable routing):
//   - session.update.data.model: e.g., "gpt-4o-mini-transcribe" (OpenAI) or a Gemini live model.
//   - input_audio.append.audio: base64-encoded PCM16 mono frames.
//   - In manual VAD: activity_start, activity_end, and commit are required to delimit a turn.
// - Optional:
//   - session.update.data.language (e.g., "en")
//   - session.update.data.vad: choose { type: 'manual' } or { type: 'server_vad', ...tuning }
//   - session.update.data.include.raw_upstream: boolean for debug mirroring
//   - You can also send audio in `{ audio: { data, mime_type } }` shape; mime_type recommended.
//
// Requirements:
// - npm i ws
// - Use a 24 kHz, 16-bit PCM mono WAV for OpenAI models (recommended); for Gemini, use 16 kHz.
// - Example uses a WAV header scan to locate raw PCM; no resampling is done.
//
// Usage:
//   node examples/javascript/realtime-transcription.mjs
// Environment:
//   GATEWAY_WS_URL=ws://localhost:8080/v1/realtime/transcription
//   AUDIO_FILE=tests/audio-files/24KHz/11s.wav
//   MODEL=gpt-4o-mini-transcribe
//   VAD_TYPE=manual | server_vad
//   LANGUAGE=en

import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';

const GATEWAY_WS_URL = process.env.GATEWAY_WS_URL || 'ws://localhost:8080/v1/realtime/transcription';
const AUDIO_FILE = process.env.AUDIO_FILE || 'tests/audio-files/24KHz/11s.wav';
const MODEL = process.env.MODEL || 'gpt-4o-mini-transcribe';
const VAD_TYPE = process.env.VAD_TYPE || 'manual';
const LANGUAGE = process.env.LANGUAGE || 'en';

// Chunking parameters
const CHUNK_MS = Number(process.env.CHUNK_MS || '100'); // 100 ms chunks by default

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function parseWav(buffer) {
  // Minimal WAV parser: ensure RIFF/WAVE, read numChannels, sampleRate, bitsPerSample, data chunk
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const str = (o, l) => String.fromCharCode(...new Uint8Array(buffer.subarray(o, o + l)));
  if (str(0, 4) !== 'RIFF' || str(8, 4) !== 'WAVE') throw new Error('Not a WAVE file');
  // fmt chunk at 12..; find 'fmt ' and 'data'
  let off = 12;
  let fmt = null, data = null;
  while (off + 8 <= buffer.length) {
    const id = str(off, 4); const size = dv.getUint32(off + 4, true); off += 8;
    if (id === 'fmt ') fmt = { off, size };
    else if (id === 'data') { data = { off, size }; break; }
    off += size;
  }
  if (!fmt || !data) throw new Error('Missing fmt or data chunk');
  const audioFormat = dv.getUint16(fmt.off + 0, true); // 1 = PCM
  const numChannels = dv.getUint16(fmt.off + 2, true);
  const sampleRate = dv.getUint32(fmt.off + 4, true);
  const bitsPerSample = dv.getUint16(fmt.off + 14, true);
  if (audioFormat !== 1) throw new Error('Only PCM supported');
  if (numChannels !== 1) console.warn('Note: file is not mono; gateway expects mono');
  if (bitsPerSample !== 16) console.warn('Note: file is not 16-bit; gateway expects PCM16');
  const pcm = buffer.subarray(data.off, data.off + data.size);
  return { sampleRate, numChannels, bitsPerSample, pcm };
}

function chunkBuffer(buf, chunkBytes) {
  const out = [];
  for (let i = 0; i < buf.length; i += chunkBytes) out.push(buf.subarray(i, Math.min(i + chunkBytes, buf.length)));
  return out;
}

async function main() {
  console.log(`Connecting to ${GATEWAY_WS_URL}`);
  const ws = new WebSocket(GATEWAY_WS_URL);

  let full = '';
  let gotTranscriptDone = false;
  let safetyTimer = null;
  let serverCloseFallbackTimer = null;

  ws.on('open', async () => {
    try {
      // Configure session
      const sessionUpdate = {
        type: 'session.update',
        data: {
          model: MODEL, // mandatory for reliable provider selection
          prompt: 'Only transcribe the user audio. Do not add commentary.', // optional 
          language: LANGUAGE, // optional
          vad: VAD_TYPE === 'server_vad' ? { type: 'server_vad', silence_duration_ms: 500, prefix_padding_ms: 300 } : { type: 'manual' },
        },
      };
      ws.send(JSON.stringify(sessionUpdate));

      // Load WAV and chunk PCM
      const wavBuf = fs.readFileSync(path.resolve(AUDIO_FILE));
      const { sampleRate, pcm } = parseWav(wavBuf);
      console.log(`WAV sampleRate=${sampleRate}Hz, bytes=${pcm.length}`);

      const bytesPerSecond = sampleRate * 2; // 16-bit mono
      const chunkBytes = Math.max(1, Math.floor((bytesPerSecond * CHUNK_MS) / 1000));
      const chunks = chunkBuffer(pcm, chunkBytes);
      console.log(`Streaming ${chunks.length} chunks (~${CHUNK_MS}ms each)`);

      if (VAD_TYPE === 'manual') ws.send(JSON.stringify({ type: 'input_audio.activity_start' }));

      for (const c of chunks) {
        ws.send(JSON.stringify({ type: 'input_audio.append', audio: c.toString('base64') }));
        // pacing for stability
        if (ws.bufferedAmount > 256 * 1024) {
          while (ws.bufferedAmount > 64 * 1024) await sleep(10);
        }
      }

      if (VAD_TYPE === 'manual') {
        ws.send(JSON.stringify({ type: 'input_audio.activity_end' }));
        ws.send(JSON.stringify({ type: 'input_audio.commit' }));
      } else {
        // Optional fallback commit
        ws.send(JSON.stringify({ type: 'input_audio.commit' }));
      }

      // Safety timer: if no transcript in 30s, close
      safetyTimer = setTimeout(() => {
        if (!gotTranscriptDone) {
          console.warn('Timeout waiting for transcript');
          try { ws.close(); } catch {}
        }
      }, 30000);
    } catch (e) {
      console.error('Send error:', e?.message || e);
      try { ws.close(); } catch {}
    }
  });

  ws.on('message', (data) => {
    let evt; try { evt = JSON.parse(data.toString()); } catch { return; }
    switch (evt.type) {
      case 'session.created':
      case 'session.updated':
        console.log('Event:', evt.type);
        break;
      case 'transcript.delta': {
        const text = typeof evt.text === 'string' ? evt.text : evt.data?.text || '';
        if (text) { full += text; process.stdout.write(text); }
        break; }
      case 'transcript.done': {
        const text = typeof evt.text === 'string' ? evt.text : evt.data?.text || '';
        if (!full && text) full = text;
        gotTranscriptDone = true;
        if (safetyTimer) { try { clearTimeout(safetyTimer); } catch {} safetyTimer = null; }
        console.log('\nFinal:', (full || '').trim());
        // Rely on server to close shortly after transcript.done; set a fallback in case it doesn't
        serverCloseFallbackTimer = setTimeout(() => { try { ws.close(); } catch {} }, 1500);
        break; }
      case 'warning':
      case 'rate_limits.updated':
      case 'error':
      default:
        console.log('Event:', evt.type, JSON.stringify(evt));
    }
  });

  ws.on('close', (c, r) => {
    if (safetyTimer) { try { clearTimeout(safetyTimer); } catch {} safetyTimer = null; }
    if (serverCloseFallbackTimer) { try { clearTimeout(serverCloseFallbackTimer); } catch {} serverCloseFallbackTimer = null; }
    console.log('Closed', c, r?.toString?.() || '');
  });
  ws.on('error', (e) => console.error('WS error:', e.message));
}

main().catch((e) => { console.error(e); process.exit(1); });
