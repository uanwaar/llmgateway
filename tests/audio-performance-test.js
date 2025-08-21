/* eslint-disable no-console */
/* eslint-disable quotes */
/* eslint-disable max-len */
/* eslint-disable comma-dangle */
/* eslint-disable indent */
/**
 * Audio Performance Test Runner
 * Tests the 3 audio files in tests/audio-files directory
 */

const fs = require('fs');
const path = require('path');
// Use Node 18+ undici's built-in FormData/Blob

// Configuration
const GATEWAY_URL = 'http://localhost:8080/v1';
const API_KEY = 'your-api-key-here';
const AUDIO_FILES_DIR = path.join(__dirname, 'audio-files');
const RESULTS_FILE = path.join(__dirname, 'audio_test_results.json');

// Test configuration  
const TEST_CONFIG = {
    useAuth: false, // Set to true to use Authorization header, false for .env setup
    delayBetweenTests: 2000, // 2s between tests
    timeout: 300000, // 5 minutes timeout
};

/**
 * Get audio duration using ffprobe if available
 */
async function getAudioDuration(filePath) {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`;
        const { stdout } = await execAsync(command);
        const duration = parseFloat(stdout.trim());
        return isNaN(duration) ? 'unknown' : duration;
    } catch (error) {
        return 'unknown';
    }
}

/**
 * Get file size in MB
 */
function getFileStats(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return {
            sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
            exists: true
        };
    } catch (error) {
        return { sizeMB: 0, exists: false, error: error.message };
    }
}

/**
 * Test single audio transcription with timing
 */
async function testTranscription(filePath, testName) {
    const fileName = path.basename(filePath);
    console.log(`\n🔄 Testing: ${fileName}`);
    
    const fileStats = getFileStats(filePath);
    if (!fileStats.exists) {
        return {
            test: testName,
            file: fileName,
            status: 'error',
            error: 'File not found',
            timestamp: new Date().toISOString()
        };
    }
    
    const fileDuration = await getAudioDuration(filePath);
    console.log(`   File info: ${fileDuration}s duration, ${fileStats.sizeMB}MB`);
    
    try {
        // Prepare form data
        const formData = new FormData();
        // Create a Blob from the file buffer so undici can compute boundaries/length
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.wav' ? 'audio/wav'
          : ext === '.mp3' ? 'audio/mpeg'
          : ext === '.m4a' ? 'audio/m4a'
          : ext === '.webm' ? 'audio/webm'
          : 'application/octet-stream';
        const fileBuffer = fs.readFileSync(filePath);
        const fileBlob = new Blob([fileBuffer], { type: mime });
        formData.append('file', fileBlob, path.basename(filePath));
        formData.append('model', 'gpt-4o-mini-transcribe');
        formData.append('language', 'en');
        formData.append('response_format', 'json');
        
        const headers = {};
        if (TEST_CONFIG.useAuth) {
            headers['Authorization'] = `Bearer ${API_KEY}`;
        }
        
        // Timing measurement
        const startTime = process.hrtime.bigint();
        const startTimestamp = Date.now();
        
        console.log(`   Starting transcription at ${new Date().toLocaleTimeString()}`);
        
        // Make request
        const response = await fetch(`${GATEWAY_URL}/audio/transcriptions`, {
            method: 'POST',
            headers,
            body: formData,
            signal: AbortSignal.timeout(TEST_CONFIG.timeout)
        });
        
        const endTime = process.hrtime.bigint();
        const endTimestamp = Date.now();
        
        // Calculate timing
        const processingTimeMs = Number(endTime - startTime) / 1_000_000;
        const processingTimeSeconds = processingTimeMs / 1000;
        
        console.log(`   Completed at ${new Date().toLocaleTimeString()}`);
        console.log(`   Processing time: ${processingTimeSeconds.toFixed(3)}s`);
        
        // Parse response
        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            result = { text: responseText };
        }
        
        // Build result object
        const testResult = {
            test: testName,
            file: fileName,
            file_duration_seconds: fileDuration,
            file_size_mb: fileStats.sizeMB,
            http_status: response.status,
            processing_time_ms: Math.round(processingTimeMs),
            processing_time_seconds: processingTimeSeconds.toFixed(3),
            response_size_bytes: responseText.length,
            start_timestamp: new Date(startTimestamp).toISOString(),
            end_timestamp: new Date(endTimestamp).toISOString(),
            timestamp: new Date().toISOString()
        };
        
        if (response.ok && result.text) {
            const transcribedText = result.text;
            const characterCount = transcribedText.length;
            const wordCount = transcribedText.split(/\s+/).length;
            
            testResult.status = 'success';
            testResult.transcribed_text = transcribedText;
            testResult.character_count = characterCount;
            testResult.word_count = wordCount;
            
            // Calculate efficiency metrics
            if (typeof fileDuration === 'number' && fileDuration > 0) {
                testResult.processing_ratio = (processingTimeSeconds / fileDuration).toFixed(3);
                testResult.real_time_factor = `${(processingTimeSeconds / fileDuration).toFixed(2)}x`;
                testResult.words_per_second = (wordCount / fileDuration).toFixed(2);
            }
            
            console.log(`✅ Success: ${characterCount} chars, ${wordCount} words`);
            if (testResult.processing_ratio) {
                console.log(`   Efficiency: ${testResult.real_time_factor} real-time`);
                console.log(`   Speech rate: ${testResult.words_per_second} words/second`);
            }
            
            // Show first 100 characters of transcription
            const preview = transcribedText.substring(0, 100);
            console.log(`   Preview: "${preview}${transcribedText.length > 100 ? '...' : ''}"`);
            
        } else {
            let errorMessage = `HTTP ${response.status}`;
            if (result.error?.message) {
                errorMessage = result.error.message;
            }
            
            testResult.status = 'error';
            testResult.error = errorMessage;
            
            console.log(`❌ Failed: ${errorMessage}`);
        }
        
        return testResult;
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        
        return {
            test: testName,
            file: fileName,
            file_duration_seconds: fileDuration,
            file_size_mb: fileStats.sizeMB,
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Analyze and display results
 */
function analyzeResults(results) {
    console.log('\n📊 Performance Analysis');
    console.log('========================');
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'error');
    
    console.log(`\nTest Summary:`);
    console.log(`  Total tests: ${results.length}`);
    console.log(`  Successful: ${successful.length}`);
    console.log(`  Failed: ${failed.length}`);
    console.log(`  Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);
    
    if (successful.length === 0) {
        console.log('\n⚠️  No successful tests to analyze');
        if (failed.length > 0) {
            console.log('\nErrors encountered:');
            failed.forEach(f => console.log(`  - ${f.file}: ${f.error}`));
        }
        return;
    }
    
    // Processing time analysis
    console.log('\n⏱️  Processing Time Analysis:');
    successful.forEach(r => {
        const duration = typeof r.file_duration_seconds === 'number' ? `${r.file_duration_seconds}s` : r.file_duration_seconds;
        console.log(`  ${r.file}:`);
        console.log(`    Audio duration: ${duration}`);
        console.log(`    Processing time: ${r.processing_time_seconds}s`);
        console.log(`    File size: ${r.file_size_mb}MB`);
        if (r.processing_ratio) {
            console.log(`    Efficiency: ${r.real_time_factor} real-time`);
        }
        if (r.word_count) {
            console.log(`    Content: ${r.word_count} words, ${r.character_count} characters`);
        }
        console.log('');
    });
    
    // Overall statistics
    const processingTimes = successful
        .map(r => parseFloat(r.processing_time_seconds))
        .filter(t => !isNaN(t));
    
    if (processingTimes.length > 0) {
        const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
        const minTime = Math.min(...processingTimes);
        const maxTime = Math.max(...processingTimes);
        
        console.log('📈 Overall Statistics:');
        console.log(`  Average processing time: ${avgTime.toFixed(3)}s`);
        console.log(`  Fastest: ${minTime.toFixed(3)}s`);
        console.log(`  Slowest: ${maxTime.toFixed(3)}s`);
    }
    
    // Efficiency analysis
    const efficiencyData = successful
        .filter(r => r.processing_ratio && !isNaN(parseFloat(r.processing_ratio)))
        .map(r => ({
            file: r.file,
            ratio: parseFloat(r.processing_ratio),
            audioDuration: r.file_duration_seconds,
            processingTime: parseFloat(r.processing_time_seconds)
        }));
    
    if (efficiencyData.length > 0) {
        const avgRatio = efficiencyData.reduce((sum, d) => sum + d.ratio, 0) / efficiencyData.length;
        
        console.log(`\n⚡ Efficiency Summary:`);
        console.log(`  Average efficiency: ${avgRatio.toFixed(3)}x real-time`);
        
        if (avgRatio < 0.5) {
            console.log('  🚀 Excellent: Much faster than real-time!');
        } else if (avgRatio < 1.0) {
            console.log('  🚀 Great: Faster than real-time processing');
        } else if (avgRatio < 2.0) {
            console.log('  ✅ Good: Reasonable processing speed');
        } else {
            console.log('  ⚠️  Slow: Consider optimizing or using shorter files');
        }
        
        console.log('\n📏 Duration vs Processing Time Pattern:');
        efficiencyData.forEach(d => {
            console.log(`  ${d.file}: ${d.audioDuration}s audio → ${d.processingTime}s processing (${d.ratio}x)`);
        });
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('🎤 LLM Gateway Audio Transcription Performance Test');
    console.log('===================================================');
    console.log(`Gateway URL: ${GATEWAY_URL}`);
    console.log(`Audio files directory: ${AUDIO_FILES_DIR}`);
    console.log(`Using Authorization: ${TEST_CONFIG.useAuth ? 'Yes' : 'No (.env setup)'}`);
    console.log(`Test started at: ${new Date().toLocaleString()}`);
    
    // Check if audio directory exists
    if (!fs.existsSync(AUDIO_FILES_DIR)) {
        console.log(`❌ Audio files directory not found: ${AUDIO_FILES_DIR}`);
        return;
    }
    
    // Get audio files
    const audioFiles = fs.readdirSync(AUDIO_FILES_DIR)
        .filter(file => /\.(mp3|wav|m4a|mp4|webm)$/i.test(file))
        .map(file => path.join(AUDIO_FILES_DIR, file));
    
    if (audioFiles.length === 0) {
        console.log(`❌ No audio files found in: ${AUDIO_FILES_DIR}`);
        return;
    }
    
    console.log(`\nFound ${audioFiles.length} audio files:`);
    for (const filePath of audioFiles) {
        const stats = getFileStats(filePath);
        console.log(`  - ${path.basename(filePath)} (${stats.sizeMB}MB)`);
    }
    
    // Run tests
    console.log('\n🚀 Starting Tests...');
    console.log('====================');
    
    const results = [];
    
    for (let i = 0; i < audioFiles.length; i++) {
        const testName = `audio_test_${i + 1}`;
        const result = await testTranscription(audioFiles[i], testName);
        results.push(result);
        
        // Delay between tests (except for last one)
        if (i < audioFiles.length - 1) {
            console.log(`\n⏳ Waiting ${TEST_CONFIG.delayBetweenTests / 1000}s before next test...`);
            await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenTests));
        }
    }
    
    // Save results
    try {
        fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
        console.log(`\n💾 Results saved to: ${RESULTS_FILE}`);
    } catch (error) {
        console.log(`❌ Failed to save results: ${error.message}`);
    }
    
    // Analyze results
    analyzeResults(results);
    
    console.log('\n✅ Testing completed!');
    console.log(`Final results saved to: ${RESULTS_FILE}`);
    console.log(`Test completed at: ${new Date().toLocaleString()}`);
}

// Run tests
if (require.main === module) {
    runTests().catch(error => {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    });
}

module.exports = { runTests, testTranscription, analyzeResults };