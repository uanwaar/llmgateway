#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable max-len */

/**
 * Simple Audio Transcription Test
 * Quick test using the short 20s.wav file for basic audio transcription functionality
 */

const fs = require('fs');
const path = require('path');
// Use Node 18+ undici's built-in FormData/Blob

// Configuration
const GATEWAY_URL = 'http://localhost:8080';
const TEST_FILES_DIR = path.join(__dirname, 'audio-files');

// Test file for quick testing
const TEST_FILE = 'short 20s.wav';

// Simple test configuration - just basic JSON response for quick testing
const TEST_CONFIG = {
  name: 'Basic JSON Response',
  params: {
    model: 'whisper-1',
    response_format: 'json',
    language: 'en',
  },
};

/**
 * Validate audio file
 */
function validateAudioFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'File does not exist' };
  }
  
  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);
  const maxSizeMB = 25; // OpenAI's limit
  
  if (fileSizeMB > maxSizeMB) {
    return { valid: false, error: `File too large: ${fileSizeMB.toFixed(2)}MB (max ${maxSizeMB}MB)` };
  }
  
  const supportedExtensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'];
  const extension = path.extname(filePath).toLowerCase();
  
  if (!supportedExtensions.includes(extension)) {
    return { valid: false, error: `Unsupported format: ${extension}` };
  }
  
  return { 
    valid: true, 
    size: fileSizeMB,
    extension, 
  };
}

/**
 * Test audio transcription endpoint
 */
async function testTranscription(audioFilePath, config) {
  const startTime = Date.now();
  
  try {
    const formData = new FormData();
    // Create a Blob from the file buffer so undici can compute boundaries/length
    const ext = path.extname(audioFilePath).toLowerCase();
    const mime = ext === '.wav' ? 'audio/wav'
      : ext === '.mp3' ? 'audio/mpeg'
        : ext === '.m4a' ? 'audio/m4a'
          : ext === '.webm' ? 'audio/webm'
            : 'application/octet-stream';
    const fileBuffer = fs.readFileSync(audioFilePath);
    const fileBlob = new Blob([fileBuffer], { type: mime });
    formData.append('file', fileBlob, path.basename(audioFilePath));
    
    // Add all config parameters
    Object.entries(config.params).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

    const response = await fetch(`${GATEWAY_URL}/v1/audio/transcriptions`, {
      method: 'POST',
      // Headers are set automatically for web-standard FormData
      // Duplex not necessary when body is FormData/Blob
      body: formData,
    });

    const responseTime = Date.now() - startTime;
    const status = response.status;
    const statusText = response.statusText;

    let result;
    let error = null;

    if (response.ok) {
      // Handle different response formats
      if (config.params.response_format === 'srt' || 
          config.params.response_format === 'vtt' ||
          config.params.response_format === 'text') {
        result = await response.text();
      } else {
        result = await response.json();
      }
    } else {
      error = `HTTP ${status}: ${statusText}`;
      try {
        const errorBody = await response.text();
        error += ` - ${errorBody}`;
      } catch (e) {
        // Ignore error reading response body
      }
    }

    return {
      success: response.ok,
      status,
      responseTime,
      result,
      error,
      config: config.name,
    };

  } catch (err) {
    return {
      success: false,
      status: 0,
      responseTime: Date.now() - startTime,
      result: null,
      error: err.message,
      config: config.name,
    };
  }
}

/**
 * Run simple test
 */
async function runSimpleTest() {
  console.log('🎵 Simple Audio Transcription Test');
  console.log('==================================\n');

  // Check if test file exists
  const testFilePath = path.join(TEST_FILES_DIR, TEST_FILE);
  console.log(`Test file: ${TEST_FILE}`);
  console.log(`Gateway URL: ${GATEWAY_URL}`);
  console.log();

  // Validate test file
  console.log('📁 Validating test file:');
  const validation = validateAudioFile(testFilePath);
  
  if (!validation.valid) {
    console.error(`❌ ${TEST_FILE} - ${validation.error}`);
    console.log('\nMake sure the test file exists in the audio-files directory.');
    return { success: false, error: validation.error };
  }

  console.log(`✅ ${TEST_FILE} - ${validation.size.toFixed(2)}MB ${validation.extension}`);
  console.log();

  // Run the test
  console.log('🎧 Testing audio transcription...');
  console.log(`   Configuration: ${TEST_CONFIG.name}`);
  console.log(`   Model: ${TEST_CONFIG.params.model}`);
  console.log(`   Format: ${TEST_CONFIG.params.response_format}`);
  console.log();

  const startTime = Date.now();
  const testResult = await testTranscription(testFilePath, TEST_CONFIG);
  const totalTime = Date.now() - startTime;

  // Display results
  if (testResult.success) {
    console.log(`✅ SUCCESS! (${testResult.responseTime}ms)`);
    console.log();
    
    if (testResult.result && testResult.result.text) {
      console.log('📝 Transcription Result:');
      console.log(`   "${testResult.result.text}"`);
      console.log();
      
      if (testResult.result.duration) {
        console.log(`⏱️  Audio Duration: ${testResult.result.duration}s`);
      }
      if (testResult.result.language) {
        console.log(`🌍 Detected Language: ${testResult.result.language}`);
      }
      
      console.log(`⚡ Response Time: ${testResult.responseTime}ms`);
      console.log(`📊 Characters: ${testResult.result.text.length}`);
      console.log(`📈 Words: ${testResult.result.text.split(/\s+/).length}`);
    }
  } else {
    console.log(`❌ FAILED (${testResult.responseTime}ms)`);
    console.log(`Error: ${testResult.error}`);
  }

  console.log();
  console.log('📈 Test Summary');
  console.log('===============');
  console.log(`File: ${TEST_FILE}`);
  console.log(`Status: ${testResult.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Response Time: ${testResult.responseTime}ms`);
  console.log(`Total Time: ${totalTime}ms`);

  // Save simple results
  const resultsFile = path.join(__dirname, 'simple-audio-test-results.json');
  const results = {
    timestamp: new Date().toISOString(),
    gateway_url: GATEWAY_URL,
    test_file: TEST_FILE,
    test_config: TEST_CONFIG,
    file_info: validation,
    result: testResult,
    total_time_ms: totalTime,
    success: testResult.success,
  };

  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${resultsFile}`);
  
  return {
    success: testResult.success,
    responseTime: testResult.responseTime,
    transcription: testResult.result?.text || null,
    error: testResult.error,
  };
}

// Check if gateway is running
async function checkGateway() {
  try {
    const response = await fetch(`${GATEWAY_URL}/health`);
    if (response.ok) {
      console.log('✅ Gateway is running');
      return true;
    } else {
      console.log('❌ Gateway health check failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot connect to gateway. Make sure it\'s running on', GATEWAY_URL);
    console.log('   Start with: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('Checking gateway connection...');
  const gatewayRunning = await checkGateway();
  console.log();

  if (!gatewayRunning) {
    console.log('Please start the LLM Gateway first:');
    console.log('  npm run dev');
    process.exit(1);
  }

  const results = await runSimpleTest();
  
  // Exit with error code if test failed
  if (results && !results.success) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test execution failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runSimpleTest, checkGateway, validateAudioFile };