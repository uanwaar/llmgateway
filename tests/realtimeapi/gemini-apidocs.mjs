// Test file: https://storage.googleapis.com/generativeai-downloads/data/16000.wav
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from "node:fs";
import pkg from 'wavefile';  // npm install wavefile
const { WaveFile } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Half cascade model:
const model = "gemini-live-2.5-flash-preview"

// Native audio output model:
// const model = "gemini-2.5-flash-preview-native-audio-dialog"

const config = {
  responseModalities: [Modality.TEXT], 
  systemInstruction: "You are a helpful assistant and answer in a friendly tone."
};

async function live() {
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
                console.debug('Opened');
            },
            onmessage: function (message) {
                responseQueue.push(message);
            },
            onerror: function (e) {
                console.debug('Error:', e.message);
            },
            onclose: function (e) {
                console.debug('Close:', e.reason);
            },
        },
        config: config,
    });

    // Send Audio Chunk
    const fileBuffer = fs.readFileSync("sample.wav");

    // Ensure audio conforms to API requirements (16-bit PCM, 16kHz, mono)
    const wav = new WaveFile();
    wav.fromBuffer(fileBuffer);
    wav.toSampleRate(16000);
    wav.toBitDepth("16");
    const base64Audio = wav.toBase64();

    // If already in correct format, you can use this:
    // const fileBuffer = fs.readFileSync("sample.pcm");
    // const base64Audio = Buffer.from(fileBuffer).toString('base64');

    session.sendRealtimeInput(
        {
            audio: {
                data: base64Audio,
                mimeType: "audio/pcm;rate=16000"
            }
        }

    );

    const turns = await handleTurn();

    // Print the text response
    console.log('\n--- Received Response ---');
    turns.forEach((turn, index) => {
        console.log(`Turn ${index + 1}:`, JSON.stringify(turn, null, 2));
        if (turn.serverContent && turn.serverContent.modelTurn && turn.serverContent.modelTurn.parts) {
            turn.serverContent.modelTurn.parts.forEach((part, partIndex) => {
                if (part.text) {
                    console.log(`\nText Response ${partIndex + 1}:`, part.text);
                }
            });
        }
    });
    console.log('--- End Response ---\n');

    session.close();
}

async function main() {
    await live().catch((e) => console.error('got error', e));
}

main();