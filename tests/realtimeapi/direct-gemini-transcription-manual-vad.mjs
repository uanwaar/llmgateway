// Audio transcription test using Gemini Live API with MANUAL VAD
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from 'node:fs';
import pkg from 'wavefile';
const { WaveFile } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const DEBUG_UPSTREAM = (process.env.DEBUG_UPSTREAM === '1');

// Half-cascade model for reliable transcription
const model = 'gemini-2.0-flash-live-001';

const config = {
  responseModalities: [Modality.TEXT],
  systemInstruction:
    'You are a transcription assistant. Only transcribe the audio no output.',
  inputAudioTranscription: {}, // Enable input audio transcription
  maxOutputTokens: 1, // minimise model output
  // MANUAL VAD: disable automatic activity detection
  realtimeInputConfig: {
    automaticActivityDetection: { disabled: true },
  },
};

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function findWavDataChunk(buffer) {
  // Parse RIFF WAV and return {offset, length} for the 'data' chunk
  // Reference: RIFF header: 0..3 'RIFF', 8..11 'WAVE', then chunks starting at 12
  let pos = 12;
  while (pos + 8 <= buffer.length) {
    const id = buffer.toString('ascii', pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    const next = pos + 8 + size;
    if (id === 'data') {
      return { offset: pos + 8, length: size };
    }
    pos = next;
  }
  throw new Error('WAV data chunk not found');
}

async function transcribeAudioManualVAD() {
  const responseQueue = [];

  async function waitMessage() {
    let msg;
    while (!msg) {
      msg = responseQueue.shift();
      if (!msg) await sleep(50);
    }
    return msg;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      }
    }
    return turns;
  }

  const session = await ai.live.connect({
    model,
    callbacks: {
      onopen() {
        console.log('🔗 Connected to Gemini Live API (manual VAD)');
      },
      onmessage(message) {
        responseQueue.push(message);
        if (DEBUG_UPSTREAM) {
          try {
            console.log('📨 debug.upstream', JSON.stringify(message));
          } catch (_) {
            console.log('📨 debug.upstream [unserializable message]');
          }
        }
        if (message.serverContent && message.serverContent.inputTranscription) {
          console.log('📝 Transcription:', message.serverContent.inputTranscription.text);
        }
      },
      onerror(e) {
        console.error('❌ Error:', e.message);
      },
      onclose(e) {
        console.log('🔌 Connection closed:', e?.reason ?? '');
      },
    },
    config,
  });

  console.log('🎤 Processing audio file for transcription (manual VAD)...');

  // Load and normalize the WAV to PCM16 mono 16kHz
  const fileBuffer = fs.readFileSync('tests/audio-files/16KHz/11s.wav');
  const wav = new WaveFile();
  wav.fromBuffer(fileBuffer);
  wav.toSampleRate(16000);
  wav.toBitDepth('16');
  const wavBuffer = Buffer.from(wav.toBuffer());
  const { offset, length } = findWavDataChunk(wavBuffer);
  const pcm = wavBuffer.slice(offset, offset + length);

  // Send manual VAD signaling (no extra envelope)
  await session.sendRealtimeInput({ activityStart: {} });

  // Stream PCM in 40ms chunks
  const sampleRate = 16000;
  const bytesPerSample = 2; // PCM16
  const channels = 1;
  const frameMs = 40;
  const bytesPerFrame = Math.floor((sampleRate * bytesPerSample * channels * frameMs) / 1000); // ~1280 bytes

  for (let i = 0; i < pcm.length; i += bytesPerFrame) {
    const chunk = pcm.subarray(i, Math.min(i + bytesPerFrame, pcm.length));
    const b64 = chunk.toString('base64');
  await session.sendRealtimeInput({
      audio: {
        data: b64,
        mimeType: 'audio/pcm;rate=16000',
      },
    });
    // Pace to simulate realtime and help VAD
    await sleep(frameMs);
  }

  // End of user speech
  await session.sendRealtimeInput({ activityEnd: {} });

  // Wait for the model/server to mark the turn complete
  const turns = await handleTurn();

  console.log('\n--- Transcription Results (Manual VAD) ---');
  let fullTranscription = '';
  turns.forEach((turn, idx) => {
    if (turn.serverContent && turn.serverContent.inputTranscription) {
      const t = turn.serverContent.inputTranscription.text;
      if (t) {
        fullTranscription += t;
        console.log(`Segment ${idx + 1}: "${t}"`);
      }
    }
  });

  if (fullTranscription) {
    console.log(`\n🎯 Complete Transcription: "${fullTranscription.trim()}"`);
  } else {
    console.log('⚠️  No transcription found in response');
    console.log('\n--- Debug: Full Response Structure ---');
    turns.forEach((turn, index) => {
      try {
        console.log(`Turn ${index + 1}:`, JSON.stringify(turn, null, 2));
      } catch (e) {
        console.log(`Turn ${index + 1}: [unserializable]`);
      }
    });
  }
  console.log('--- End Transcription ---\n');

  session.close();
}

async function main() {
  try {
    await transcribeAudioManualVAD();
  } catch (err) {
    console.error('💥 Manual VAD transcription failed:', err?.message ?? err);
  }
}

main();
