/**
 * Load Testing Suite for LLM Gateway
 * 
 * This module implements comprehensive load testing scenarios to validate
 * the gateway's performance under realistic usage patterns.
 */

const axios = require('axios');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:8080';
    this.concurrency = options.concurrency || 2; // Reduced for rate limiting
    this.duration = options.duration || 20000; // 20 seconds
    this.warmupDuration = options.warmupDuration || 5000; // 5 seconds
    this.requests = [];
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: [],
      statusCodes: {},
      responseTimePercentiles: {}
    };
  }

  /**
   * Generate realistic chat completion request
   */
  generateChatRequest() {
    const prompts = [
      "Write a short story about a robot learning to paint.",
      "Explain quantum computing in simple terms.",
      "What are the benefits of renewable energy?",
      "How do neural networks work?",
      "Describe the process of photosynthesis.",
      "What is the history of the internet?",
      "Explain machine learning algorithms.",
      "Write a poem about the ocean.",
      "How does blockchain technology work?",
      "What are the principles of good design?"
    ];

    return {
      model: Math.random() > 0.5 ? 'gpt-4o-mini' : 'gemini-1.5-flash',
      messages: [
        {
          role: 'user',
          content: prompts[Math.floor(Math.random() * prompts.length)]
        }
      ],
      max_tokens: Math.floor(Math.random() * 500) + 100,
      temperature: Math.random() * 0.9 + 0.1
    };
  }

  /**
   * Generate audio transcription request
   */
  generateTranscriptionRequest() {
    // For load testing, we'll simulate transcription requests
    // In a real scenario, you'd upload actual audio files
    return {
      model: 'whisper-1',
      file: 'test-audio.mp3', // Simulated audio file
      language: 'en',
      response_format: 'json'
    };
  }

  /**
   * Execute a single request and measure performance
   */
  async executeRequest(requestConfig) {
    const startTime = performance.now();
    const requestId = crypto.randomUUID();
    
    try {
      const response = await axios({
        ...requestConfig,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
          'X-Request-ID': requestId,
          ...requestConfig.headers
        }
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      return {
        success: true,
        responseTime,
        statusCode: response.status,
        requestId,
        dataSize: JSON.stringify(response.data).length
      };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      return {
        success: false,
        responseTime,
        statusCode: error.response?.status || 0,
        error: error.message,
        requestId
      };
    }
  }

  /**
   * Run chat completions load test
   */
  async runChatLoadTest() {
    console.log('🚀 Starting Chat Completions Load Test...');
    console.log(`Concurrency: ${this.concurrency}, Duration: ${this.duration}ms`);

    const results = [];
    const workers = [];

    const runWorker = async () => {
      const startTime = Date.now();
      while (Date.now() - startTime < this.duration) {
        const request = this.generateChatRequest();
        const result = await this.executeRequest({
          method: 'POST',
          url: `${this.baseURL}/v1/chat/completions`,
          data: request
        });
        results.push(result);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    // Start concurrent workers
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
    return this.calculateMetrics(results, 'Chat Completions');
  }

  /**
   * Run transcription load test
   */
  async runTranscriptionLoadTest() {
    console.log('🎤 Starting Audio Transcription Load Test...');

    const results = [];
    const workers = [];

    const runWorker = async () => {
      const startTime = Date.now();
      while (Date.now() - startTime < this.duration) {
        const request = this.generateTranscriptionRequest();
        const result = await this.executeRequest({
          method: 'POST',
          url: `${this.baseURL}/v1/audio/transcriptions`,
          data: request,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        results.push(result);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    for (let i = 0; i < this.concurrency; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
    return this.calculateMetrics(results, 'Audio Transcription');
  }

  /**
   * Run mixed workload test
   */
  async runMixedWorkloadTest() {
    console.log('🔄 Starting Mixed Workload Load Test...');

    const results = [];
    const workers = [];

    const runWorker = async () => {
      const startTime = Date.now();
      while (Date.now() - startTime < this.duration) {
        const isChat = Math.random() > 0.2; // 80% chat, 20% transcription
        
        let request, url, headers = {};
        if (isChat) {
          request = this.generateChatRequest();
          url = `${this.baseURL}/v1/chat/completions`;
        } else {
          request = this.generateTranscriptionRequest();
          url = `${this.baseURL}/v1/audio/transcriptions`;
          headers = { 'Content-Type': 'multipart/form-data' };
        }

        const result = await this.executeRequest({
          method: 'POST',
          url,
          data: request,
          headers
        });
        results.push({ ...result, endpoint: isChat ? 'chat' : 'transcription' });
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    for (let i = 0; i < this.concurrency; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
    return this.calculateMetrics(results, 'Mixed Workload');
  }

  /**
   * Calculate performance metrics
   */
  calculateMetrics(results, testName) {
    const totalRequests = results.length;
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const responseTimes = results.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);

    // Calculate percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const percentiles = {
      p50: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
      p90: sortedTimes[Math.floor(sortedTimes.length * 0.9)],
      p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
      p99: sortedTimes[Math.floor(sortedTimes.length * 0.99)]
    };

    // Calculate requests per second
    const testDurationSeconds = this.duration / 1000;
    const requestsPerSecond = totalRequests / testDurationSeconds;

    // Group status codes
    const statusCodes = {};
    results.forEach(r => {
      statusCodes[r.statusCode] = (statusCodes[r.statusCode] || 0) + 1;
    });

    // Collect errors
    const errors = results.filter(r => !r.success).map(r => r.error);

    const metrics = {
      testName,
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: (successfulRequests / totalRequests * 100).toFixed(2) + '%',
      averageResponseTime: avgResponseTime.toFixed(2) + 'ms',
      minResponseTime: minResponseTime.toFixed(2) + 'ms',
      maxResponseTime: maxResponseTime.toFixed(2) + 'ms',
      requestsPerSecond: requestsPerSecond.toFixed(2),
      percentiles,
      statusCodes,
      errors: [...new Set(errors)], // Unique errors
      duration: this.duration,
      concurrency: this.concurrency
    };

    this.printMetrics(metrics);
    return metrics;
  }

  /**
   * Print formatted metrics
   */
  printMetrics(metrics) {
    console.log(`\n📊 ${metrics.testName} Results:`);
    console.log('═'.repeat(50));
    console.log(`Total Requests: ${metrics.totalRequests}`);
    console.log(`Successful: ${metrics.successfulRequests} (${metrics.successRate})`);
    console.log(`Failed: ${metrics.failedRequests}`);
    console.log(`\nPerformance:`);
    console.log(`  Requests/sec: ${metrics.requestsPerSecond}`);
    console.log(`  Avg Response: ${metrics.averageResponseTime}`);
    console.log(`  Min Response: ${metrics.minResponseTime}`);
    console.log(`  Max Response: ${metrics.maxResponseTime}`);
    console.log(`\nPercentiles:`);
    console.log(`  50th: ${metrics.percentiles.p50.toFixed(2)}ms`);
    console.log(`  90th: ${metrics.percentiles.p90.toFixed(2)}ms`);
    console.log(`  95th: ${metrics.percentiles.p95.toFixed(2)}ms`);
    console.log(`  99th: ${metrics.percentiles.p99.toFixed(2)}ms`);
    console.log(`\nStatus Codes:`);
    Object.entries(metrics.statusCodes).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
    if (metrics.errors.length > 0) {
      console.log(`\nErrors:`);
      metrics.errors.forEach(error => console.log(`  - ${error}`));
    }
    console.log('═'.repeat(50));
  }

  /**
   * Health check before running tests
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`);
      if (response.status === 200) {
        console.log('✅ Gateway health check passed');
        return true;
      }
    } catch (error) {
      console.error('❌ Gateway health check failed:', error.message);
      return false;
    }
  }

  /**
   * Run all load tests
   */
  async runAllTests() {
    console.log('🔥 LLM Gateway Load Testing Suite');
    console.log('Target:', this.baseURL);
    console.log('Configuration:', { 
      concurrency: this.concurrency, 
      duration: `${this.duration}ms` 
    });

    // Health check
    const isHealthy = await this.healthCheck();
    if (!isHealthy) {
      console.error('Gateway is not healthy. Aborting tests.');
      return;
    }

    const results = {};

    try {
      // Warmup
      console.log('\n🔥 Warming up...');
      const warmupTester = new LoadTester({
        ...this,
        duration: this.warmupDuration,
        concurrency: Math.min(this.concurrency, 3)
      });
      await warmupTester.runChatLoadTest();

      // Main tests
      results.chat = await this.runChatLoadTest();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Cool down
      
      // Skip transcription test for now (requires actual file uploads)
      console.log('🎤 Skipping Audio Transcription Test (requires file uploads)');
      
      // For mixed workload, just use chat completions
      console.log('🔄 Running Chat-Only Workload Test...');
      results.chatOnly = await this.runChatLoadTest();

      // Summary
      this.printSummary(results);
      
    } catch (error) {
      console.error('Load test failed:', error.message);
    }

    return results;
  }

  /**
   * Print test summary
   */
  printSummary(results) {
    console.log('\n🎯 LOAD TEST SUMMARY');
    console.log('═'.repeat(60));
    
    Object.values(results).forEach(result => {
      console.log(`${result.testName}:`);
      console.log(`  RPS: ${result.requestsPerSecond} | Success: ${result.successRate} | Avg: ${result.averageResponseTime}`);
    });
    
    console.log('═'.repeat(60));
  }
}

// Export for use in other modules
module.exports = LoadTester;

// CLI execution
if (require.main === module) {
  const config = {
    baseURL: process.env.GATEWAY_URL || 'http://localhost:8080',
    concurrency: parseInt(process.env.LOAD_TEST_CONCURRENCY) || 2,
    duration: parseInt(process.env.LOAD_TEST_DURATION) || 20000
  };

  const tester = new LoadTester(config);
  tester.runAllTests().catch(console.error);
}