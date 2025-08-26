/* eslint-disable no-unused-vars */
/* eslint-disable indent */
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class OpenAITranscriptionTester {
    constructor(options = {}) {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.ws = null;
        this.testResults = [];
        this.quietMode = options.quiet || false;
        this.showOnlyTranscription = options.transcriptionOnly || false;
    }

    // Convert Float32Array to PCM16 Base64 (for audio streaming)
    floatTo16BitPCM(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        let offset = 0;
        for (let i = 0; i < float32Array.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
        return buffer;
    }

    base64EncodeAudio(float32Array) {
        const arrayBuffer = this.floatTo16BitPCM(float32Array);
        let binary = '';
        let bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 0x8000; // 32KB chunks
        for (let i = 0; i < bytes.length; i += chunkSize) {
            let chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        return Buffer.from(binary, 'binary').toString('base64');
    }

    // Load test audio file and convert to base64
    loadTestAudio(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const audioData = fs.readFileSync(filePath);
                
                // For WAV files, we need to skip the header and extract raw PCM data
                if (filePath.toLowerCase().endsWith('.wav')) {
                    // WAV header is typically 44 bytes, but let's find the data chunk
                    const dataIndex = audioData.indexOf('data');
                    if (dataIndex > 0) {
                        // Skip 'data' (4 bytes) + size (4 bytes) = 8 bytes after 'data'
                        const pcmData = audioData.slice(dataIndex + 8);
                        return pcmData.toString('base64');
                    } else {
                        return audioData.toString('base64');
                    }
                }
                
                return audioData.toString('base64');
            }
            return null;
        } catch (error) {
            if (!this.quietMode && !this.showOnlyTranscription) {
                console.warn(`Could not load audio file ${filePath}:`, error.message);
            }
            return null;
        }
    }

    async testTranscriptionModel(model, sessionConfig = {}) {
        return new Promise((resolve, reject) => {
            if (!this.quietMode && !this.showOnlyTranscription) {
                console.log(`\n🎯 Testing ${model} transcription model...`);
            }
            
            // WebSocket URL for transcription intent
            const wsUrl = 'wss://api.openai.com/v1/realtime?intent=transcription';
            
            const ws = new WebSocket(wsUrl, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });

            const testResult = {
                model,
                success: false,
                events: [],
                transcripts: [],
                currentTranscript: '',
                error: null,
                startTime: Date.now(),
                audioCommitted: false
            };

            ws.on('open', () => {
                if (!this.quietMode && !this.showOnlyTranscription) {
                    console.log(`✅ Connected to OpenAI Transcription API for ${model}`);
                }
                
                // Configure transcription session
                const config = {
                    type: 'transcription_session.update',
                    session: {
                        input_audio_format: 'pcm16',
                        input_audio_transcription: {
                            model: model,
                            language: 'en',
                            prompt: 'You are a transcription assistant. Only transcribe the audio you receive without any additional commentary.'
                        },
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.5,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 500
                        },
                        input_audio_noise_reduction: {
                            type: 'near_field'
                        },
                        ...sessionConfig
                    }
                };
                
                if (!this.quietMode && !this.showOnlyTranscription) {
                    console.log('Sending transcription session configuration...');
                }
                ws.send(JSON.stringify(config));
                
                // Simulate sending audio data after a short delay
                setTimeout(async () => {
                    await this.sendTestAudio(ws, testResult);
                }, 1000);
            });

            ws.on('message', (data) => {
                const event = JSON.parse(data.toString());
                testResult.events.push(event);
                
                if (!this.quietMode && !this.showOnlyTranscription) {
                    console.log(`📥 [${model}] Event:`, event.type);
                }
                
                switch (event.type) {
                    case 'transcription_session.created':
                    case 'transcription_session.updated':
                        if (!this.quietMode && !this.showOnlyTranscription) {
                            console.log(`✅ [${model}] Session configured successfully`);
                        }
                        break;
                        
                    case 'conversation.item.input_audio_transcription.delta':
                        testResult.currentTranscript += event.delta;
                        if (this.showOnlyTranscription) {
                            process.stdout.write(event.delta);
                        } else if (!this.quietMode && !this.showOnlyTranscription) {
                            console.log(`📝 [${model}] Transcript delta:`, event.delta);
                        }
                        break;
                        
                    case 'conversation.item.input_audio_transcription.completed':
                        if (this.showOnlyTranscription) {
                            console.log(); // New line after transcript
                        } else if (!this.quietMode && !this.showOnlyTranscription) {
                            console.log(`✅ [${model}] Final transcript:`, event.transcript);
                        }
                        testResult.transcripts.push(event.transcript);
                        testResult.success = true;
                        break;
                        
                    case 'input_audio_buffer.speech_started':
                        if (!this.quietMode && !this.showOnlyTranscription) {
                            console.log(`🎤 [${model}] Speech detection started`);
                        }
                        break;
                        
                    case 'input_audio_buffer.speech_stopped':
                        if (!this.quietMode && !this.showOnlyTranscription) {
                            console.log(`🔇 [${model}] Speech detection stopped`);
                        }
                        break;
                        
                    case 'input_audio_buffer.committed':
                        testResult.audioCommitted = true;
                        if (!this.quietMode && !this.showOnlyTranscription) {
                            console.log(`💾 [${model}] Audio buffer committed`);
                        }
                        break;
                        
                    case 'error':
                        // Only log critical errors, ignore buffer commit errors if transcription was successful
                        if (event.error.code !== 'input_audio_buffer_commit_empty' || !testResult.success) {
                            if (!this.quietMode && !this.showOnlyTranscription) {
                                console.error(`❌ [${model}] Error:`, event.error);
                            }
                            testResult.error = event.error;
                        }
                        break;
                }
                
                // Close connection after getting transcription result or critical error
                if (event.type === 'conversation.item.input_audio_transcription.completed' || 
                    (event.type === 'error' && event.error.code !== 'input_audio_buffer_commit_empty')) {
                    setTimeout(() => {
                        ws.close();
                    }, 1000);
                }
            });

            ws.on('error', (error) => {
                if (!this.quietMode && !this.showOnlyTranscription) {
                    console.error(`❌ [${model}] WebSocket error:`, error.message);
                }
                testResult.error = error.message;
            });

            ws.on('close', (code, reason) => {
                testResult.endTime = Date.now();
                testResult.duration = testResult.endTime - testResult.startTime;
                if (!this.quietMode && !this.showOnlyTranscription) {
                    console.log(`🔌 [${model}] Connection closed: ${code} ${reason}`);
                }
                resolve(testResult);
            });

            // Timeout after 20 seconds
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    if (!this.quietMode && !this.showOnlyTranscription) {
                        console.log(`⏰ [${model}] Test timeout - closing connection`);
                    }
                    testResult.error = 'Test timeout';
                    ws.close();
                }
            }, 20000);
        });
    }

    async sendTestAudio(ws, testResult) {
        // Try to load actual audio file first
        const audioFiles = [
            path.join(__dirname, '../audio-files/24KHz/11s.wav')
        ];
        
        let audioData = null;
        for (const filePath of audioFiles) {
            audioData = this.loadTestAudio(filePath);
            if (audioData) {
                if (!this.quietMode && !this.showOnlyTranscription) {
                    console.log(`📁 Using audio file: ${filePath}`);
                }
                break;
            }
        }
        
        if (audioData) {
            // Send actual audio file
            if (!this.quietMode && !this.showOnlyTranscription) {
                console.log('📤 Sending actual audio file...');
                console.log('Audio data length:', audioData.length, 'characters');
                console.log('Audio data preview:', audioData.substring(0, 100) + '...');
            }
            
            ws.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: audioData
            }));
            
            // Commit the audio buffer only once
            setTimeout(() => {
                if (!testResult.audioCommitted) {
                    if (!this.quietMode && !this.showOnlyTranscription) {
                        console.log('🔄 Committing audio buffer...');
                    }
                    ws.send(JSON.stringify({
                        type: 'input_audio_buffer.commit'
                    }));
                    testResult.audioCommitted = true;
                }
            }, 500);
        } else {
            // Generate synthetic audio data for testing
            console.log('📤 Sending synthetic audio data...');
            
            // Create synthetic PCM16 audio (sine wave at 440Hz for 2 seconds)
            const sampleRate = 24000;
            const duration = 2; // seconds
            const frequency = 440; // Hz
            const samples = sampleRate * duration;
            const audioArray = new Float32Array(samples);
            
            for (let i = 0; i < samples; i++) {
                audioArray[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
            }
            
            const base64Audio = this.base64EncodeAudio(audioArray);
            
            // Send audio in chunks
            const chunkSize = 4800; // 0.2 seconds of audio
            const base64ChunkSize = Math.floor(chunkSize * 4 / 3); // Base64 encoding overhead
            
            for (let i = 0; i < base64Audio.length; i += base64ChunkSize) {
                const chunk = base64Audio.substring(i, i + base64ChunkSize);
                ws.send(JSON.stringify({
                    type: 'input_audio_buffer.append',
                    audio: chunk
                }));
                
                // Small delay between chunks
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Commit the audio buffer
            setTimeout(() => {
                ws.send(JSON.stringify({
                    type: 'input_audio_buffer.commit'
                }));
            }, 500);
        }
    }

    async runAllTests() {
        if (!this.quietMode && !this.showOnlyTranscription) {
            console.log('🚀 Starting OpenAI Transcription API Tests...');
        }
        
        if (!this.apiKey) {
            console.error('❌ OPENAI_API_KEY not found in environment variables');
            return;
        }

        if (!this.quietMode && !this.showOnlyTranscription) {
            console.log('Using API key:', this.apiKey.substring(0, 10) + '...');
        }

        // Test different transcription models
        const models = [
            'whisper-1'
        ];

        // Different configuration scenarios
        const testScenarios = [
            { name: 'Default Configuration', config: {} },
            { 
                name: 'High Sensitivity VAD', 
                config: {
                    turn_detection: {
                        type: 'server_vad',
                        threshold: 0.3,
                        prefix_padding_ms: 500,
                        silence_duration_ms: 300
                    }
                }
            },
            { 
                name: 'With Language Hint', 
                config: {
                    input_audio_transcription: {
                        language: 'en',
                        prompt: 'This is a technical discussion about APIs and software development'
                    }
                }
            }
        ];

        for (const model of models) {
            try {
                const result = await this.testTranscriptionModel(model);
                this.testResults.push(result);
                
                // Wait between tests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`❌ Failed to test ${model}:`, error);
                this.testResults.push({
                    model,
                    success: false,
                    error: error.message
                });
            }
        }

        // Print summary
        this.printTestSummary();
    }

    printTestSummary() {
        if (this.showOnlyTranscription) {
            return; // Don't print summary in transcription-only mode
        }
        
        if (this.quietMode) {
            // Just print the transcription results
            for (const result of this.testResults) {
                if (result.transcripts && result.transcripts.length > 0) {
                    console.log(`\n[${result.model}] Transcription:`);
                    result.transcripts.forEach((transcript) => {
                        console.log(transcript);
                    });
                }
            }
            return;
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 TRANSCRIPTION TEST SUMMARY');
        console.log('='.repeat(60));
        
        let successCount = 0;
        
        for (const result of this.testResults) {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            const duration = result.duration ? `${result.duration}ms` : 'N/A';
            
            console.log(`\n${status} ${result.model}`);
            console.log(`   Duration: ${duration}`);
            
            if (result.transcripts && result.transcripts.length > 0) {
                console.log(`   Transcripts: ${result.transcripts.length}`);
                result.transcripts.forEach((transcript, idx) => {
                    console.log(`     ${idx + 1}. "${transcript}"`);
                });
            }
            
            // Only show critical errors (not buffer commit errors)
            if (result.error && result.error.code !== 'input_audio_buffer_commit_empty') {
                console.log(`   Error: ${result.error.message || result.error}`);
            }
            
            if (result.success) successCount++;
        }
        
        console.log('\n' + '-'.repeat(60));
        console.log(`📈 Success Rate: ${successCount}/${this.testResults.length} (${Math.round(successCount/this.testResults.length*100)}%)`);
        console.log('='.repeat(60));
    }
}

// Run the tests
async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {
        quiet: args.includes('--quiet') || args.includes('-q'),
        transcriptionOnly: args.includes('--transcription-only') || args.includes('-t'),
    };
    
    const tester = new OpenAITranscriptionTester(options);
    await tester.runAllTests();
}

// Simple function for just getting transcription
async function transcribeOnly() {
    const tester = new OpenAITranscriptionTester({ 
        quiet: true, 
        transcriptionOnly: true 
    });
    await tester.runAllTests();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { OpenAITranscriptionTester, transcribeOnly };