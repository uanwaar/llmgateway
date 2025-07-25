/**
 * JavaScript Audio Examples for LLM Gateway
 * 
 * This file demonstrates audio processing capabilities including:
 * - Audio transcription (speech-to-text)
 * - Audio translation (speech-to-text in English)
 * - Text-to-speech synthesis
 * - File format handling and validation
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Example 1: Basic audio transcription
async function basicTranscription() {
  console.log('=== Basic Audio Transcription ===');
  
  // Note: You'll need an actual audio file for this to work
  const audioFilePath = path.join(__dirname, 'sample-audio.mp3');
  
  // Check if audio file exists (create a placeholder message if not)
  if (!fs.existsSync(audioFilePath)) {
    console.log('Note: Audio file not found. Please add a sample audio file at:');
    console.log(audioFilePath);
    console.log('Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm\n');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Optional: specify language
    formData.append('response_format', 'json'); // json, text, srt, verbose_json, vtt

    const response = await fetch('http://localhost:8080/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer your-api-key-here',
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Transcription result:', result.text);
    
    if (result.segments) {
      console.log('Segments:', result.segments.length);
    }
  } catch (error) {
    console.error('Transcription error:', error.message);
  }
}

// Example 2: Audio transcription with detailed options
async function detailedTranscription() {
  console.log('\n=== Detailed Audio Transcription ===');
  
  const audioFilePath = path.join(__dirname, 'sample-audio.wav');
  
  if (!fs.existsSync(audioFilePath)) {
    console.log('Audio file not found, skipping detailed transcription example.');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'whisper-1');
    formData.append('prompt', 'This is a conversation about technology and AI.'); // Context prompt
    formData.append('response_format', 'verbose_json'); // Get detailed response
    formData.append('temperature', '0.2'); // Lower temperature for more accurate transcription
    formData.append('language', 'en');

    const response = await fetch('http://localhost:8080/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer your-api-key-here',
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const result = await response.json();
    
    console.log('Full transcription:', result.text);
    console.log('Language detected:', result.language);
    console.log('Duration:', result.duration, 'seconds');
    
    if (result.segments) {
      console.log('\nTimestamped segments:');
      result.segments.forEach((segment, index) => {
        console.log(`${index + 1}. [${segment.start.toFixed(2)}s - ` +
          `${segment.end.toFixed(2)}s]: ${segment.text}`);
      });
    }
  } catch (error) {
    console.error('Detailed transcription error:', error.message);
  }
}

// Example 3: Audio translation (non-English to English)
async function audioTranslation() {
  console.log('\n=== Audio Translation ===');
  
  const audioFilePath = path.join(__dirname, 'foreign-language-audio.mp3');
  
  if (!fs.existsSync(audioFilePath)) {
    console.log('Foreign language audio file not found, skipping translation example.');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'json');
    formData.append('temperature', '0.0'); // Most accurate translation

    const response = await fetch('http://localhost:8080/v1/audio/translations', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer your-api-key-here',
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const result = await response.json();
    console.log('Translated text (English):', result.text);
  } catch (error) {
    console.error('Translation error:', error.message);
  }
}

// Example 4: Text-to-speech synthesis
async function textToSpeech() {
  console.log('\n=== Text-to-Speech Synthesis ===');
  
  const textToSpeak = 'Hello! This is a demonstration of the text-to-speech ' +
    'functionality in the LLM Gateway. The AI can convert this text into natural-sounding speech.';
  
  try {
    const response = await fetch('http://localhost:8080/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key-here',
      },
      body: JSON.stringify({
        model: 'tts-1', // or 'tts-1-hd' for higher quality
        input: textToSpeak,
        voice: 'alloy', // alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3', // mp3, opus, aac, flac
        speed: 1.0, // 0.25 to 4.0
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the audio data as buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Save to file
    const outputPath = path.join(__dirname, 'generated-speech.mp3');
    fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
    
    console.log('Speech generated and saved to:', outputPath);
    console.log('File size:', audioBuffer.byteLength, 'bytes');
  } catch (error) {
    console.error('Text-to-speech error:', error.message);
  }
}

// Example 5: Advanced TTS with different voices and settings
async function advancedTTS() {
  console.log('\n=== Advanced Text-to-Speech ===');
  
  const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  // const speeds = [0.75, 1.0, 1.25];
  // const formats = ['mp3', 'opus', 'aac'];
  
  const sampleText = 'The future of artificial intelligence is bright and full of possibilities.';
  
  for (const voice of voices.slice(0, 2)) { // Test first 2 voices to save time
    console.log(`\nGenerating speech with voice: ${voice}`);
    
    try {
      const response = await fetch('http://localhost:8080/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your-api-key-here',
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          input: sampleText,
          voice,
          response_format: 'mp3',
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const outputPath = path.join(__dirname, `speech-${voice}.mp3`);
      fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
      
      console.log(`- Generated: ${outputPath} (${audioBuffer.byteLength} bytes)`);
    } catch (error) {
      console.error(`Error with voice ${voice}:`, error.message);
    }
  }
}

// Example 6: Audio file validation and format checking
function validateAudioFile(filePath) {
  console.log('\n=== Audio File Validation ===');
  
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist:', filePath);
    return false;
  }
  
  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);
  const maxSizeMB = 25; // OpenAI's current limit
  
  console.log(`File: ${path.basename(filePath)}`);
  console.log(`Size: ${fileSizeMB.toFixed(2)} MB`);
  
  if (fileSizeMB > maxSizeMB) {
    console.log(`⚠️  File too large! Maximum size is ${maxSizeMB} MB`);
    return false;
  }
  
  const supportedExtensions = [
    '.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm',
  ];
  const extension = path.extname(filePath).toLowerCase();
  
  if (!supportedExtensions.includes(extension)) {
    console.log(`⚠️  Unsupported format: ${extension}`);
    console.log(`Supported formats: ${supportedExtensions.join(', ')}`);
    return false;
  }
  
  console.log('✅ File validation passed');
  return true;
}

// Example 7: Batch audio processing
async function batchAudioProcessing() {
  console.log('\n=== Batch Audio Processing ===');
  
  const audioFiles = [
    'sample1.mp3',
    'sample2.wav',
    'sample3.m4a',
  ];
  
  const results = [];
  
  for (const filename of audioFiles) {
    const filePath = path.join(__dirname, filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${filename} - file not found`);
      continue;
    }
    
    console.log(`Processing ${filename}...`);
    
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');

      const response = await fetch('http://localhost:8080/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer your-api-key-here',
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        results.push({
          file: filename,
          text: result.text,
          success: true,
        });
        console.log(`✅ ${filename}: ${result.text.substring(0, 50)}...`);
      } else {
        results.push({
          file: filename,
          error: `HTTP ${response.status}`,
          success: false,
        });
        console.log(`❌ ${filename}: HTTP ${response.status}`);
      }
    } catch (error) {
      results.push({
        file: filename,
        error: error.message,
        success: false,
      });
      console.log(`❌ ${filename}: ${error.message}`);
    }
  }
  
  console.log('\nBatch processing results:');
  console.log(`Successful: ${results.filter(r => r.success).length}/${results.length}`);
  
  return results;
}

// Example 8: Real-time audio processing simulation
async function simulateRealTimeProcessing() {
  console.log('\n=== Simulated Real-time Processing ===');
  
  // This simulates processing audio chunks in real-time
  const audioChunks = [
    'chunk1.mp3',
    'chunk2.mp3',
    'chunk3.mp3',
  ];
  
  let fullTranscription = '';
  
  console.log('Processing audio chunks in sequence...');
  
  for (let i = 0; i < audioChunks.length; i++) {
    const chunkPath = path.join(__dirname, audioChunks[i]);
    
    if (!fs.existsSync(chunkPath)) {
      console.log(`Creating simulated chunk ${i + 1}...`);
      // In real scenario, this would be actual audio data
      continue;
    }
    
    console.log(`Processing chunk ${i + 1}/${audioChunks.length}...`);
    
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(chunkPath));
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');
      
      // Add context from previous chunks
      if (fullTranscription) {
        const contextPrompt = fullTranscription.split(' ').slice(-50).join(' ');
        formData.append('prompt', contextPrompt);
      }

      const response = await fetch('http://localhost:8080/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer your-api-key-here',
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        fullTranscription += ` ${result.text}`;
        console.log(`Chunk ${i + 1}: ${result.text}`);
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error.message);
    }
  }
  
  console.log('\nFull transcription:', fullTranscription.trim());
}

// Helper function to create sample audio files (placeholder)
function createSampleAudioFiles() {
  console.log('\n=== Creating Sample Audio Files ===');
  console.log('Note: This would create actual audio files in a real implementation.');
  console.log('For testing, please provide your own audio files in the following formats:');
  console.log('- sample-audio.mp3 (for basic transcription)');
  console.log('- sample-audio.wav (for detailed transcription)');
  console.log('- foreign-language-audio.mp3 (for translation)');
  console.log('- chunk1.mp3, chunk2.mp3, chunk3.mp3 (for batch processing)');
}

// Main execution function
async function runAudioExamples() {
  console.log('LLM Gateway Audio Processing Examples\n');
  console.log('These examples demonstrate audio transcription, translation, and TTS.');
  console.log('Make sure the LLM Gateway is running and configured with audio providers.\n');

  // Create sample files reminder
  createSampleAudioFiles();
  
  // Validate sample files
  const sampleFiles = ['sample-audio.mp3', 'sample-audio.wav'];
  sampleFiles.forEach(file => {
    validateAudioFile(path.join(__dirname, file));
  });

  // Run audio examples
  await basicTranscription();
  await detailedTranscription();
  await audioTranslation();
  await textToSpeech();
  await advancedTTS();
  await batchAudioProcessing();
  await simulateRealTimeProcessing();
  
  console.log('\n=== All audio examples completed ===');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAudioExamples().catch(console.error);
}

// Export functions for use in other files
module.exports = {
  basicTranscription,
  detailedTranscription,
  audioTranslation,
  textToSpeech,
  advancedTTS,
  validateAudioFile,
  batchAudioProcessing,
  simulateRealTimeProcessing,
  createSampleAudioFiles,
};

/**
 * Usage Instructions:
 * 
 * 1. Install dependencies:
 *    npm install form-data
 * 
 * 2. Set up environment variables:
 *    export OPENAI_API_KEY="your-openai-key"
 * 
 * 3. Prepare audio files:
 *    - Add sample audio files to the examples/javascript/ directory
 *    - Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
 *    - Maximum file size: 25 MB
 * 
 * 4. Start the LLM Gateway:
 *    npm run dev
 * 
 * 5. Run this example:
 *    node examples/javascript/audio-transcription.js
 * 
 * Key Features Demonstrated:
 * - Audio transcription with Whisper models
 * - Audio translation to English
 * - Text-to-speech synthesis with multiple voices
 * - File format validation
 * - Batch audio processing
 * - Real-time processing simulation
 * - Advanced TTS options (voice, speed, format)
 * - Error handling for audio operations
 * 
 * Expected Output:
 * - Transcribed text from audio files
 * - Generated speech audio files
 * - Processing statistics and validation results
 * - Batch processing summaries
 */