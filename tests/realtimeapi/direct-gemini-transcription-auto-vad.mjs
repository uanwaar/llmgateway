// Audio transcription test using Gemini Live API
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from "node:fs";
import pkg from 'wavefile';
const { WaveFile } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const DEBUG_UPSTREAM = (process.env.DEBUG_UPSTREAM === '1');

// Half cascade model for better transcription performance
const model = "gemini-2.0-flash-live-001";

const config = {
    responseModalities: [Modality.TEXT],
    systemInstruction: "What do you think about the speaker\'s opinion?",
    inputAudioTranscription: {}  // Enable input audio transcription
};

async function transcribeAudio() {
    const responseQueue = [];

    async function waitMessage() {
        let done = false;
        let message = undefined;
        while (!done) {
            message = responseQueue.shift();
            if (message) {
                done = true;
            } else {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }
        return message;
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
        model: model,
        callbacks: {
            onopen: function () {
                console.log('🔗 Connected to Gemini Live API for transcription');
            },
            onmessage: function (message) {
                responseQueue.push(message);
                if (DEBUG_UPSTREAM) {
                    try {
                        console.log('📨 debug.upstream', JSON.stringify(message));
                    } catch (_) {
                        console.log('📨 debug.upstream [unserializable message]');
                    }
                }
                
                // Log transcription events as they come
                if (message.serverContent && message.serverContent.inputTranscription) {
                    console.log('📝 Transcription:', message.serverContent.inputTranscription.text);
                }
            },
            onerror: function (e) {
                console.error('❌ Error:', e.message);
            },
            onclose: function (e) {
                console.log('🔌 Connection closed:', e.reason);
            },
        },
        config: config,
    });

    console.log('🎤 Processing audio file for transcription...');

    // Load and prepare audio file
    const fileBuffer = fs.readFileSync("tests/audio-files/16KHz/11s.wav");

    // Ensure audio conforms to API requirements (16-bit PCM, 16kHz, mono)
    const wav = new WaveFile();
    wav.fromBuffer(fileBuffer);
    wav.toSampleRate(16000);
    wav.toBitDepth("16");
    const base64Audio = wav.toBase64();

    // Send audio for transcription
    session.sendRealtimeInput({
        audio: {
            data: base64Audio,
            mimeType: "audio/pcm;rate=16000"
        }
    });

    const turns = await handleTurn();

    // Extract and display transcription results
    console.log('\n--- Transcription Results ---');
    
    let fullTranscription = '';
    turns.forEach((turn, index) => {
        if (turn.serverContent && turn.serverContent.inputTranscription) {
            const transcript = turn.serverContent.inputTranscription.text;
            if (transcript) {
                fullTranscription += transcript;
                console.log(`Segment ${index + 1}: "${transcript}"`);
            }
        }
    });

    if (fullTranscription) {
        console.log(`\n🎯 Complete Transcription: "${fullTranscription.trim()}"`);
    } else {
        console.log('⚠️  No transcription found in response');
        
        // Show full response structure for debugging
        console.log('\n--- Debug: Full Response Structure ---');
        turns.forEach((turn, index) => {
            console.log(`Turn ${index + 1}:`, JSON.stringify(turn, null, 2));
        });
    }

    console.log('--- End Transcription ---\n');

    session.close();
}

async function main() {
    try {
        await transcribeAudio();
    } catch (error) {
        console.error('💥 Transcription failed:', error.message);
        console.error(error.stack);
    }
}

main();