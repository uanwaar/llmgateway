/**
 * Stress Testing Suite for LLM Gateway
 * 
 * This module implements aggressive stress testing to identify breaking points,
 * memory leaks, and system stability under extreme load conditions.
 */

const axios = require('axios');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const cluster = require('cluster');
const os = require('os');

class StressTester {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:8080';
    this.maxConcurrency = options.maxConcurrency || 100;
    this.rampUpDuration = options.rampUpDuration || 60000; // 1 minute
    this.sustainDuration = options.sustainDuration || 300000; // 5 minutes
    this.rampDownDuration = options.rampDownDuration || 30000; // 30 seconds
    this.workers = options.workers || os.cpus().length;
    this.breakingPointTest = options.breakingPointTest || false;
    
    this.metrics = {
      requests: [],
      errors: [],
      systemMetrics: [],
      phases: {}
    };
  }

  /**
   * Generate high-stress request payload
   */
  generateStressRequest() {
    const stressPatterns = [
      // Large prompt stress
      {
        type: 'large_prompt',
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: 'Analyze this data in detail: ' + 'data,'.repeat(1000) + ' and provide comprehensive insights.'
        }],
        max_tokens: 1000
      },
      
      // High token generation stress
      {
        type: 'high_tokens',
        model: 'gemini-pro',
        messages: [{
          role: 'user',
          content: 'Write a comprehensive 2000-word essay about artificial intelligence and its impact on society.'
        }],
        max_tokens: 2000
      },
      
      // Complex reasoning stress
      {
        type: 'complex_reasoning',
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: 'Solve this complex mathematical problem step by step and explain each step: ' +
                   'Find the optimal solution for a traveling salesman problem with 20 cities, ' +
                   'considering traffic patterns, fuel costs, and time constraints.'
        }],
        max_tokens: 1500
      },
      
      // Rapid-fire simple requests
      {
        type: 'rapid_simple',
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: 'What is ' + Math.floor(Math.random() * 1000) + ' + ' + Math.floor(Math.random() * 1000) + '?'
        }],
        max_tokens: 10
      },
      
      // Memory stress with conversation history
      {
        type: 'conversation_history',
        model: 'gemini-pro',
        messages: this.generateLongConversation(),
        max_tokens: 500
      }
    ];

    return stressPatterns[Math.floor(Math.random() * stressPatterns.length)];
  }

  /**
   * Generate long conversation history for memory stress testing
   */
  generateLongConversation() {
    const messages = [
      { role: 'user', content: 'Let\'s have a long conversation about various topics.' }
    ];
    
    const topics = [
      'artificial intelligence', 'climate change', 'space exploration', 
      'quantum computing', 'biotechnology', 'renewable energy'
    ];
    
    for (let i = 0; i < 20; i++) {
      const topic = topics[i % topics.length];
      messages.push({
        role: 'user',
        content: `Tell me more about ${topic} and how it relates to our previous discussion.`
      });
      messages.push({
        role: 'assistant',
        content: `This is a simulated response about ${topic}. ` + 'Content '.repeat(50)
      });
    }
    
    messages.push({
      role: 'user',
      content: 'Now summarize everything we\'ve discussed and provide your final thoughts.'
    });
    
    return messages;
  }

  /**
   * Execute stress test request with detailed tracking
   */
  async executeStressRequest(workerData) {
    const startTime = performance.now();
    const requestId = crypto.randomUUID();
    const request = this.generateStressRequest();
    
    try {
      const response = await axios.post(`${this.baseURL}/v1/chat/completions`, request, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer stress-test-key',
          'X-Request-ID': requestId,
          'X-Stress-Test': 'true',
          'X-Worker-ID': workerData.workerId || 'main'
        },
        timeout: 60000 // Extended timeout for stress testing
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      const usage = response.data.usage || {};
      
      return {
        success: true,
        responseTime,
        requestType: request.type,
        model: request.model,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        statusCode: response.status,
        requestId,
        timestamp: Date.now(),
        workerId: workerData.workerId
      };
      
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return {
        success: false,
        responseTime,
        requestType: request.type,
        model: request.model,
        error: error.message,
        statusCode: error.response?.status || 0,
        requestId,
        timestamp: Date.now(),
        workerId: workerData.workerId,
        errorCode: error.code
      };
    }
  }

  /**
   * Monitor system resources during stress test
   */
  startSystemMonitoring() {
    const interval = setInterval(() => {
      const usage = process.memoryUsage();
      const metric = {
        timestamp: Date.now(),
        memory: {
          rss: usage.rss / 1024 / 1024, // MB
          heapUsed: usage.heapUsed / 1024 / 1024, // MB
          heapTotal: usage.heapTotal / 1024 / 1024, // MB
          external: usage.external / 1024 / 1024 // MB
        },
        cpu: process.cpuUsage(),
        uptime: process.uptime()
      };
      
      this.metrics.systemMetrics.push(metric);
    }, 1000);
    
    return interval;
  }

  /**
   * Calculate stress test concurrency for current phase
   */
  calculateConcurrency(phase, elapsed, phaseDuration) {
    switch (phase) {
      case 'rampup':
        return Math.floor((elapsed / phaseDuration) * this.maxConcurrency);
      case 'sustain':
        return this.maxConcurrency;
      case 'rampdown':
        return Math.floor(((phaseDuration - elapsed) / phaseDuration) * this.maxConcurrency);
      default:
        return 1;
    }
  }

  /**
   * Run stress test worker
   */
  async runStressWorker(workerId, phase, targetConcurrency) {
    const workers = [];
    
    const workerFunction = async () => {
      while (true) {
        const result = await this.executeStressRequest({ workerId });
        this.metrics.requests.push(result);
        
        if (!result.success) {
          this.metrics.errors.push(result);
        }
        
        // Very small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };
    
    // Start workers based on target concurrency
    for (let i = 0; i < targetConcurrency; i++) {
      workers.push(workerFunction());
    }
    
    return workers;
  }

  /**
   * Run progressive stress test with ramp-up, sustain, and ramp-down phases
   */
  async runProgressiveStressTest() {
    console.log('🔥 Starting Progressive Stress Test');
    console.log(`Max Concurrency: ${this.maxConcurrency}`);
    console.log(`Ramp-up: ${this.rampUpDuration}ms, Sustain: ${this.sustainDuration}ms, Ramp-down: ${this.rampDownDuration}ms`);
    
    // Health check
    try {
      await axios.get(`${this.baseURL}/health`);
      console.log('✅ Gateway health check passed');
    } catch (error) {
      console.error('❌ Gateway health check failed:', error.message);
      return;
    }
    
    const monitoringInterval = this.startSystemMonitoring();
    const testStartTime = Date.now();
    
    try {
      // Phase 1: Ramp-up
      console.log('\n📈 Phase 1: Ramp-up');
      await this.runStressPhase('rampup', this.rampUpDuration);
      
      // Phase 2: Sustain
      console.log('\n🔥 Phase 2: Sustain Peak Load');
      await this.runStressPhase('sustain', this.sustainDuration);
      
      // Phase 3: Ramp-down
      console.log('\n📉 Phase 3: Ramp-down');
      await this.runStressPhase('rampdown', this.rampDownDuration);
      
    } finally {
      clearInterval(monitoringInterval);
    }
    
    const testEndTime = Date.now();
    const totalDuration = testEndTime - testStartTime;
    
    // Generate comprehensive stress test report
    const report = this.generateStressReport(totalDuration);
    
    this.printStressReport(report);
    return report;
  }

  /**
   * Run a specific stress test phase
   */
  async runStressPhase(phase, duration) {
    const phaseStartTime = Date.now();
    const phaseMetrics = {
      phase,
      duration,
      requests: [],
      errors: [],
      concurrencyLevels: []
    };
    
    let activeWorkers = [];
    let currentConcurrency = 0;
    
    const phaseController = setInterval(async () => {
      const elapsed = Date.now() - phaseStartTime;
      const targetConcurrency = this.calculateConcurrency(phase, elapsed, duration);
      
      if (targetConcurrency !== currentConcurrency) {
        // Adjust worker count
        if (targetConcurrency > currentConcurrency) {
          // Add workers
          const newWorkers = targetConcurrency - currentConcurrency;
          for (let i = 0; i < newWorkers; i++) {
            const worker = this.executeStressRequest({ workerId: `${phase}-${i}` });
            activeWorkers.push(worker);
          }
        } else {
          // Remove workers (let them complete naturally)
          const workersToRemove = currentConcurrency - targetConcurrency;
          activeWorkers = activeWorkers.slice(0, -workersToRemove);
        }
        
        currentConcurrency = targetConcurrency;
        phaseMetrics.concurrencyLevels.push({
          timestamp: Date.now(),
          concurrency: currentConcurrency
        });
        
        console.log(`  Concurrency: ${currentConcurrency}/${this.maxConcurrency}`);
      }
    }, 1000);
    
    // Wait for phase completion
    await new Promise(resolve => setTimeout(resolve, duration));
    
    clearInterval(phaseController);
    
    // Wait for remaining workers to complete
    try {
      await Promise.allSettled(activeWorkers);
    } catch (error) {
      console.log(`Some workers in ${phase} phase failed:`, error.message);
    }
    
    this.metrics.phases[phase] = phaseMetrics;
    console.log(`  ✅ ${phase} phase completed`);
  }

  /**
   * Run breaking point test to find system limits
   */
  async runBreakingPointTest() {
    console.log('💥 Starting Breaking Point Test');
    
    let currentConcurrency = 1;
    let consecutiveFailures = 0;
    const maxFailures = 10;
    const results = [];
    
    while (consecutiveFailures < maxFailures && currentConcurrency <= 1000) {
      console.log(`\nTesting concurrency level: ${currentConcurrency}`);
      
      const testResults = [];
      const workers = [];
      
      // Run test for 30 seconds at this concurrency level
      const testDuration = 30000;
      const startTime = Date.now();
      
      const workerFunction = async () => {
        while (Date.now() - startTime < testDuration) {
          const result = await this.executeStressRequest({ 
            workerId: `breaking-point-${currentConcurrency}` 
          });
          testResults.push(result);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      };
      
      // Start workers
      for (let i = 0; i < currentConcurrency; i++) {
        workers.push(workerFunction());
      }
      
      await Promise.allSettled(workers);
      
      // Analyze results
      const successful = testResults.filter(r => r.success).length;
      const failed = testResults.filter(r => !r.success).length;
      const successRate = successful / (successful + failed) * 100;
      const avgResponseTime = testResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.responseTime, 0) / successful;
      
      results.push({
        concurrency: currentConcurrency,
        totalRequests: testResults.length,
        successful,
        failed,
        successRate,
        avgResponseTime
      });
      
      console.log(`  Results: ${successRate.toFixed(1)}% success, ${avgResponseTime.toFixed(0)}ms avg response`);
      
      // Check if we've hit a breaking point
      if (successRate < 90 || avgResponseTime > 10000) {
        consecutiveFailures++;
        console.log(`  ⚠️  Performance degradation detected (${consecutiveFailures}/${maxFailures})`);
      } else {
        consecutiveFailures = 0;
      }
      
      // Increase concurrency exponentially initially, then linearly
      if (currentConcurrency < 20) {
        currentConcurrency *= 2;
      } else {
        currentConcurrency += 10;
      }
      
      // Cool down between tests
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    const breakingPoint = results[results.length - maxFailures] || results[results.length - 1];
    
    console.log(`\n💥 Breaking point identified at concurrency: ${breakingPoint.concurrency}`);
    console.log(`   Success rate: ${breakingPoint.successRate.toFixed(1)}%`);
    console.log(`   Avg response time: ${breakingPoint.avgResponseTime.toFixed(0)}ms`);
    
    return {
      breakingPoint,
      allResults: results
    };
  }

  /**
   * Generate comprehensive stress test report
   */
  generateStressReport(totalDuration) {
    const totalRequests = this.metrics.requests.length;
    const successfulRequests = this.metrics.requests.filter(r => r.success).length;
    const failedRequests = this.metrics.requests.filter(r => !r.success).length;
    
    const responseTimes = this.metrics.requests
      .filter(r => r.success)
      .map(r => r.responseTime);
    
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    
    // Memory analysis
    const memoryMetrics = this.metrics.systemMetrics.map(m => m.memory.heapUsed);
    const maxMemory = Math.max(...memoryMetrics);
    const minMemory = Math.min(...memoryMetrics);
    const avgMemory = memoryMetrics.reduce((a, b) => a + b, 0) / memoryMetrics.length;
    
    // Error analysis
    const errorTypes = {};
    this.metrics.errors.forEach(error => {
      const type = error.errorCode || 'HTTP_' + error.statusCode || 'UNKNOWN';
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });
    
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        totalDuration,
        maxConcurrency: this.maxConcurrency,
        phases: ['rampup', 'sustain', 'rampdown']
      },
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: (successfulRequests / totalRequests * 100).toFixed(2) + '%',
        avgResponseTime: (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2) + 'ms',
        maxResponseTime: Math.max(...responseTimes).toFixed(2) + 'ms',
        minResponseTime: Math.min(...responseTimes).toFixed(2) + 'ms',
        requestsPerSecond: (totalRequests / (totalDuration / 1000)).toFixed(2)
      },
      performance: {
        percentiles: {
          p50: sortedTimes[Math.floor(sortedTimes.length * 0.5)]?.toFixed(2) + 'ms',
          p90: sortedTimes[Math.floor(sortedTimes.length * 0.9)]?.toFixed(2) + 'ms',
          p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)]?.toFixed(2) + 'ms',
          p99: sortedTimes[Math.floor(sortedTimes.length * 0.99)]?.toFixed(2) + 'ms'
        }
      },
      stability: {
        memoryUsage: {
          min: minMemory.toFixed(2) + 'MB',
          max: maxMemory.toFixed(2) + 'MB',
          avg: avgMemory.toFixed(2) + 'MB',
          growth: ((maxMemory - minMemory) / minMemory * 100).toFixed(2) + '%'
        },
        errorTypes,
        crashDetected: false // Would need more sophisticated detection
      },
      phases: this.metrics.phases
    };
  }

  /**
   * Print stress test report
   */
  printStressReport(report) {
    console.log('\n💥 STRESS TEST REPORT');
    console.log('═'.repeat(60));
    
    console.log(`Test Duration: ${(report.metadata.totalDuration / 1000).toFixed(1)}s`);
    console.log(`Max Concurrency: ${report.metadata.maxConcurrency}`);
    
    console.log('\n📊 Summary:');
    console.log(`  Total Requests: ${report.summary.totalRequests}`);
    console.log(`  Success Rate: ${report.summary.successRate}`);
    console.log(`  RPS: ${report.summary.requestsPerSecond}`);
    console.log(`  Avg Response: ${report.summary.avgResponseTime}`);
    
    console.log('\n⚡ Performance:');
    Object.entries(report.performance.percentiles).forEach(([percentile, value]) => {
      console.log(`  ${percentile.toUpperCase()}: ${value}`);
    });
    
    console.log('\n🧠 Memory:');
    console.log(`  Min: ${report.stability.memoryUsage.min}`);
    console.log(`  Max: ${report.stability.memoryUsage.max}`);
    console.log(`  Growth: ${report.stability.memoryUsage.growth}`);
    
    if (Object.keys(report.stability.errorTypes).length > 0) {
      console.log('\n❌ Error Types:');
      Object.entries(report.stability.errorTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
    
    console.log('═'.repeat(60));
  }
}

// Export for use in other modules
module.exports = StressTester;

// CLI execution
if (require.main === module) {
  const config = {
    baseURL: process.env.GATEWAY_URL || 'http://localhost:8080',
    maxConcurrency: parseInt(process.env.STRESS_MAX_CONCURRENCY) || 50,
    sustainDuration: parseInt(process.env.STRESS_SUSTAIN_DURATION) || 120000,
    breakingPointTest: process.env.STRESS_BREAKING_POINT === 'true'
  };

  const tester = new StressTester(config);
  
  if (config.breakingPointTest) {
    tester.runBreakingPointTest().catch(console.error);
  } else {
    tester.runProgressiveStressTest().catch(console.error);
  }
}