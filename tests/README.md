# Audio Transcription Performance Tests

This directory contains performance testing tools for the LLM Gateway's audio transcription endpoints.

## Test Files

### Audio Performance Tests
- **`audio-performance-test.js`** - Main Node.js test script for comprehensive audio performance testing
- **`audio-performance-detailed.js`** - Detailed JavaScript test with advanced metrics and analysis
- **`audio-response-time-test.sh`** - Bash script for command-line audio transcription testing

### Test Data
- **`audio-files/`** - Directory containing test audio files:
  - `1min.wav` - 1-minute audio sample (9.68MB)
  - `2min.mp3` - 2-minute audio sample (2.90MB) 
  - `3min.mp3` - 3-minute audio sample (4.58MB)

### Results
- **`audio_test_results.json`** - Latest test results in JSON format
- **`transcription_performance_results.json`** - Detailed performance analysis results

## Usage

### Quick Test (Node.js)
```bash
# Run the main performance test
node tests/audio-performance-test.js
```

### Detailed Analysis
```bash  
# Run comprehensive test with advanced metrics
node tests/audio-performance-detailed.js
```

### Bash Testing
```bash
# Run command-line tests
bash tests/audio-response-time-test.sh
```

## Prerequisites

1. **LLM Gateway running** on `http://localhost:8080`
2. **Environment setup**:
   - Option A (Recommended): Set `OPENAI_API_KEY` in `.env` file
   - Option B: Set `TEST_CONFIG.useAuth = true` and provide API key in scripts

3. **Dependencies**:
   ```bash
   npm install form-data
   ```

4. **Optional tools** for enhanced testing:
   - `ffmpeg` - For audio duration detection and sample creation
   - `jq` - For better JSON analysis in bash scripts

## Test Configuration

### Node.js Scripts
Modify `TEST_CONFIG` in the scripts:
```javascript
const TEST_CONFIG = {
    useAuth: false,           // Use .env setup vs manual API key
    delayBetweenTests: 2000,  // Delay between tests (ms)
    timeout: 300000,          // Request timeout (5 minutes)
};
```

### Bash Scripts
Modify configuration variables:
```bash
GATEWAY_URL="http://localhost:8080/v1"
API_KEY="your-api-key-here"
```

## Performance Metrics

The tests measure:

- **Processing Time** - Total time from request to response
- **Real-time Efficiency** - Processing time vs audio duration ratio
- **Response Patterns** - How performance scales with audio length
- **Error Rates** - Failure rates and types
- **Throughput** - Requests per second capabilities

## Expected Results

For optimal performance:
- **Efficiency ratio < 1.0x** - Processing faster than real-time
- **Efficiency ratio < 2.0x** - Acceptable performance
- **Success rate > 90%** - Reliable transcription service

## Troubleshooting

### Common Issues

1. **"Unexpected end of form" errors**
   - Check multipart form data handling in gateway
   - Verify file paths and permissions
   - Ensure gateway is properly started

2. **"body.file is required" validation errors**
   - Indicates form parsing issues in the gateway
   - Check gateway middleware configuration

3. **Port conflicts**
   - Ensure no other services on port 8080
   - Stop any existing gateway instances

4. **Authentication errors**
   - Verify API keys in `.env` file
   - Check `TEST_CONFIG.useAuth` setting

### Debug Mode

Enable detailed logging:
```bash
# Set log level to debug
export LOG_LEVEL=debug

# Run tests with verbose output
node tests/audio-performance-test.js
```

## Adding New Test Audio

To add more test files:

1. **Copy audio files** to `tests/audio-files/`
2. **Supported formats**: mp3, wav, m4a, mp4, webm (max 25MB)
3. **Naming convention**: Use descriptive names like `5min-speech.mp3`

The test scripts automatically discover and test all audio files in the directory.

## Performance Benchmarking

For consistent benchmarking:

1. **Use identical hardware** and network conditions
2. **Run multiple test iterations** to get averages
3. **Test with different audio types**:
   - Clear speech vs background noise
   - Different languages and accents
   - Various audio qualities and formats

4. **Monitor system resources** during tests
5. **Compare results** across different gateway configurations

## Results Analysis

The test results include:

- **Processing time per audio duration**
- **Efficiency ratios** (processing_time / audio_duration)
- **Error rates** and failure patterns
- **Performance trends** as audio length increases
- **Throughput measurements** for concurrent requests

Use these metrics to:
- Optimize gateway configuration
- Plan capacity requirements  
- Set realistic SLA targets
- Identify performance bottlenecks