/* eslint-disable no-console */
/* eslint-disable max-len */
/**
 * Performance Benchmarking Suite for LLM Gateway
 * 
 * This module provides comprehensive benchmarking capabilities to compare
 * performance across different providers, models, and configurations.
 */

const axios = require('axios');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class PerformanceBenchmark {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:8080';
    this.outputDir = options.outputDir || './benchmark-results';
    this.providers = options.providers || ['openai', 'gemini'];
    this.models = options.models || {
      openai: ['gpt-4o-mini'],
      gemini: ['gemini-1.5-flash'],
    };
    this.testCases = this.generateTestCases();
    this.results = {};
  }

  /**
   * Generate comprehensive test cases for benchmarking
   */
  generateTestCases() {
    return {
      // Quick response tests
      simple: {
        name: 'Simple Query',
        prompt: 'What is 2 + 2?',
        maxTokens: 10,
        expectedLatency: '<500ms',
      },
      
      // Medium complexity
      explanation: {
        name: 'Technical Explanation',
        prompt: 'Explain how machine learning algorithms work in simple terms.',
        maxTokens: 200,
        expectedLatency: '<2000ms',
      },
      
      // High complexity
      codeGeneration: {
        name: 'Code Generation',
        prompt: 'Write a Python function that implements a binary search algorithm with proper error handling and documentation.',
        maxTokens: 500,
        expectedLatency: '<5000ms',
      },
      
      // Creative writing
      storytelling: {
        name: 'Creative Writing',
        prompt: 'Write a short science fiction story about AI and humans working together to solve climate change.',
        maxTokens: 800,
        expectedLatency: '<8000ms',
      },
      
      // Reasoning
      reasoning: {
        name: 'Complex Reasoning',
        prompt: 'Analyze the pros and cons of renewable energy adoption from economic, environmental, and social perspectives.',
        maxTokens: 600,
        expectedLatency: '<6000ms',
      },
      
      // Multimodal (text-only baseline)
      analysis: {
        name: 'Data Analysis',
        prompt: 'Given a dataset with columns: date, temperature, humidity, pressure, predict the weather pattern and explain your reasoning.',
        maxTokens: 400,
        expectedLatency: '<4000ms',
      },
    };
  }

  /**
   * Execute a benchmark request
   */
  async executeBenchmarkRequest(model, testCase, iterations = 5) {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const requestId = crypto.randomUUID();
      
      try {
        const response = await axios.post(`${this.baseURL}/v1/chat/completions`, {
          model,
          messages: [{
            role: 'user',
            content: testCase.prompt,
          }],
          max_tokens: testCase.maxTokens,
          temperature: 0.7,
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key',
            'X-Request-ID': requestId,
          },
          timeout: 30000,
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        const usage = response.data.usage || {};
        const content = response.data.choices?.[0]?.message?.content || '';
        
        results.push({
          success: true,
          responseTime,
          tokensGenerated: content.split(' ').length,
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
          requestId,
          iteration: i + 1,
        });
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        results.push({
          success: false,
          responseTime,
          error: error.message,
          statusCode: error.response?.status || 0,
          requestId,
          iteration: i + 1,
        });
      }
    }
    
    return this.calculateBenchmarkMetrics(results, model, testCase);
  }

  /**
   * Calculate comprehensive benchmark metrics
   */
  calculateBenchmarkMetrics(results, model, testCase) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length === 0) {
      return {
        model,
        testCase: testCase.name,
        status: 'FAILED',
        successRate: 0,
        error: 'All requests failed',
      };
    }
    
    const responseTimes = successful.map(r => r.responseTime);
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    
    const tokens = successful.map(r => r.completionTokens).filter(t => t > 0);
    const tokensPerSecond = tokens.length > 0 ? 
      tokens.map((tokens, i) => tokens / (responseTimes[i] / 1000)) : [];
    
    return {
      model,
      testCase: testCase.name,
      prompt: `${testCase.prompt.substring(0, 100)}...`,
      expectedLatency: testCase.expectedLatency,
      status: 'SUCCESS',
      iterations: results.length,
      successRate: `${(successful.length / results.length * 100).toFixed(1)}%`,
      
      // Response time metrics
      avgResponseTime: (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2),
      minResponseTime: Math.min(...responseTimes).toFixed(2),
      maxResponseTime: Math.max(...responseTimes).toFixed(2),
      medianResponseTime: sortedTimes[Math.floor(sortedTimes.length / 2)].toFixed(2),
      p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)].toFixed(2),
      p99ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)].toFixed(2),
      
      // Token metrics
      avgTokensGenerated: tokens.length > 0 ? (tokens.reduce((a, b) => a + b, 0) / tokens.length).toFixed(1) : 0,
      avgTokensPerSecond: tokensPerSecond.length > 0 ? (tokensPerSecond.reduce((a, b) => a + b, 0) / tokensPerSecond.length).toFixed(1) : 0,
      maxTokensPerSecond: tokensPerSecond.length > 0 ? Math.max(...tokensPerSecond).toFixed(1) : 0,
      
      // Consistency metrics
      responseTimeStdDev: this.calculateStandardDeviation(responseTimes).toFixed(2),
      consistencyScore: this.calculateConsistencyScore(responseTimes).toFixed(1),
      
      // Detailed results for analysis
      detailedResults: results,
      errors: failed.map(f => f.error),
    };
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculate consistency score (0-100, higher is more consistent)
   */
  calculateConsistencyScore(responseTimes) {
    if (responseTimes.length < 2) return 100;
    
    const mean = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const stdDev = this.calculateStandardDeviation(responseTimes);
    const coefficientOfVariation = stdDev / mean;
    
    // Convert to 0-100 scale (lower CV = higher consistency)
    return Math.max(0, 100 - (coefficientOfVariation * 100));
  }

  /**
   * Run benchmarks for a specific provider
   */
  async benchmarkProvider(provider) {
    console.log(`\n🔍 Benchmarking ${provider.toUpperCase()} Provider...`);
    
    const providerModels = this.models[provider] || [];
    const providerResults = {};
    
    for (const model of providerModels) {
      console.log(`\n  Testing model: ${model}`);
      providerResults[model] = {};
      
      for (const [testKey, testCase] of Object.entries(this.testCases)) {
        console.log(`    Running test: ${testCase.name}...`);
        
        try {
          const result = await this.executeBenchmarkRequest(model, testCase);
          providerResults[model][testKey] = result;
          
          // Print quick result
          if (result.status === 'SUCCESS') {
            console.log(`      ✅ ${result.avgResponseTime}ms avg, ${result.avgTokensPerSecond} tokens/sec`);
          } else {
            console.log(`      ❌ Failed: ${result.error}`);
          }
          
        } catch (error) {
          console.log(`      ❌ Error: ${error.message}`);
          providerResults[model][testKey] = {
            model,
            testCase: testCase.name,
            status: 'ERROR',
            error: error.message,
          };
        }
        
        // Cool down between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return providerResults;
  }

  /**
   * Run comprehensive benchmarks across all providers
   */
  async runComprehensiveBenchmark() {
    console.log('🏁 Starting Comprehensive Performance Benchmark');
    console.log('Target:', this.baseURL);
    console.log('Providers:', this.providers.join(', '));
    
    // Health check
    try {
      const response = await axios.get(`${this.baseURL}/health`);
      console.log('✅ Gateway health check passed');
    } catch (error) {
      console.error('❌ Gateway health check failed:', error.message);
      return;
    }
    
    const allResults = {};
    const startTime = Date.now();
    
    for (const provider of this.providers) {
      try {
        allResults[provider] = await this.benchmarkProvider(provider);
      } catch (error) {
        console.error(`Failed to benchmark ${provider}:`, error.message);
        allResults[provider] = { error: error.message };
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // Generate comprehensive report
    const report = this.generateBenchmarkReport(allResults, totalTime);
    
    // Save results
    await this.saveBenchmarkResults(report);
    
    // Print summary
    this.printBenchmarkSummary(report);
    
    return report;
  }

  /**
   * Generate comprehensive benchmark report
   */
  generateBenchmarkReport(results, totalTime) {
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        gatewayUrl: this.baseURL,
        totalDuration: totalTime,
        testCases: Object.keys(this.testCases).length,
        providers: this.providers,
      },
      results,
      analysis: this.analyzeResults(results),
      recommendations: this.generateRecommendations(results),
    };
    
    return report;
  }

  /**
   * Analyze benchmark results for insights
   */
  analyzeResults(results) {
    const analysis = {
      fastestProvider: null,
      mostConsistent: null,
      bestTokenThroughput: null,
      modelPerformance: {},
      testCaseInsights: {},
    };
    
    // Find fastest provider overall
    const avgResponseTimes = {};
    for (const [provider, providerResults] of Object.entries(results)) {
      if (providerResults.error) continue;
      
      const allTimes = [];
      for (const modelResults of Object.values(providerResults)) {
        for (const testResult of Object.values(modelResults)) {
          if (testResult.status === 'SUCCESS') {
            allTimes.push(parseFloat(testResult.avgResponseTime));
          }
        }
      }
      
      if (allTimes.length > 0) {
        avgResponseTimes[provider] = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
      }
    }
    
    analysis.fastestProvider = Object.entries(avgResponseTimes)
      .sort(([,a], [,b]) => a - b)[0]?.[0];
    
    // Find most consistent provider
    const consistencyScores = {};
    for (const [provider, providerResults] of Object.entries(results)) {
      if (providerResults.error) continue;
      
      const allScores = [];
      for (const modelResults of Object.values(providerResults)) {
        for (const testResult of Object.values(modelResults)) {
          if (testResult.status === 'SUCCESS' && testResult.consistencyScore) {
            allScores.push(parseFloat(testResult.consistencyScore));
          }
        }
      }
      
      if (allScores.length > 0) {
        consistencyScores[provider] = allScores.reduce((a, b) => a + b, 0) / allScores.length;
      }
    }
    
    analysis.mostConsistent = Object.entries(consistencyScores)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    return analysis;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];
    
    // Analyze response times
    const highLatencyModels = [];
    for (const [provider, providerResults] of Object.entries(results)) {
      if (providerResults.error) continue;
      
      for (const [model, modelResults] of Object.entries(providerResults)) {
        for (const testResult of Object.values(modelResults)) {
          if (testResult.status === 'SUCCESS' && parseFloat(testResult.avgResponseTime) > 5000) {
            highLatencyModels.push(`${provider}/${model}`);
          }
        }
      }
    }
    
    if (highLatencyModels.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'High Latency Models Detected',
        description: `Models with >5s average response time: ${highLatencyModels.join(', ')}`,
        action: 'Consider implementing request timeouts or provider fallbacks for these models',
      });
    }
    
    // Check token throughput
    const lowThroughputModels = [];
    for (const [provider, providerResults] of Object.entries(results)) {
      if (providerResults.error) continue;
      
      for (const [model, modelResults] of Object.entries(providerResults)) {
        for (const testResult of Object.values(modelResults)) {
          if (testResult.status === 'SUCCESS' && parseFloat(testResult.avgTokensPerSecond) < 10) {
            lowThroughputModels.push(`${provider}/${model}`);
          }
        }
      }
    }
    
    if (lowThroughputModels.length > 0) {
      recommendations.push({
        type: 'throughput',
        priority: 'medium',
        title: 'Low Token Throughput Models',
        description: `Models with <10 tokens/sec: ${lowThroughputModels.join(', ')}`,
        action: 'Consider using these models for non-real-time applications only',
      });
    }
    
    return recommendations;
  }

  /**
   * Save benchmark results to file
   */
  async saveBenchmarkResults(report) {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `benchmark-${timestamp}.json`;
      const filepath = path.join(this.outputDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      console.log(`\n💾 Results saved to: ${filepath}`);
      
      // Also save a latest.json for easy access
      await fs.writeFile(path.join(this.outputDir, 'latest.json'), JSON.stringify(report, null, 2));
      
    } catch (error) {
      console.error('Failed to save results:', error.message);
    }
  }

  /**
   * Print benchmark summary
   */
  printBenchmarkSummary(report) {
    console.log('\n🏆 BENCHMARK SUMMARY');
    console.log('═'.repeat(60));
    
    console.log(`Test Duration: ${(report.metadata.totalDuration / 1000).toFixed(1)}s`);
    console.log(`Test Cases: ${report.metadata.testCases}`);
    console.log(`Providers: ${report.metadata.providers.join(', ')}`);
    
    if (report.analysis.fastestProvider) {
      console.log(`\n🚀 Fastest Provider: ${report.analysis.fastestProvider.toUpperCase()}`);
    }
    
    if (report.analysis.mostConsistent) {
      console.log(`🎯 Most Consistent: ${report.analysis.mostConsistent.toUpperCase()}`);
    }
    
    // Print provider comparison
    console.log('\n📊 Provider Performance:');
    for (const [provider, providerResults] of Object.entries(report.results)) {
      if (providerResults.error) {
        console.log(`  ${provider}: ❌ Error - ${providerResults.error}`);
        continue;
      }
      
      let totalTests = 0;
      let successfulTests = 0;
      const avgTimes = [];
      
      for (const modelResults of Object.values(providerResults)) {
        for (const testResult of Object.values(modelResults)) {
          totalTests++;
          if (testResult.status === 'SUCCESS') {
            successfulTests++;
            avgTimes.push(parseFloat(testResult.avgResponseTime));
          }
        }
      }
      
      const successRate = (successfulTests / totalTests * 100).toFixed(1);
      const avgResponseTime = avgTimes.length > 0 ? 
        (avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length).toFixed(1) : 'N/A';
      
      console.log(`  ${provider}: ${successRate}% success, ${avgResponseTime}ms avg`);
    }
    
    // Print recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`  [${rec.priority.toUpperCase()}] ${rec.title}`);
        console.log(`    ${rec.description}`);
        console.log(`    Action: ${rec.action}`);
      });
    }
    
    console.log('═'.repeat(60));
  }
}

// Export for use in other modules
module.exports = PerformanceBenchmark;

// CLI execution
if (require.main === module) {
  const config = {
    baseURL: process.env.GATEWAY_URL || 'http://localhost:8080',
    outputDir: process.env.BENCHMARK_OUTPUT_DIR || './benchmark-results',
    providers: process.env.BENCHMARK_PROVIDERS ? 
      process.env.BENCHMARK_PROVIDERS.split(',') : 
      ['openai', 'gemini'],
  };

  const benchmark = new PerformanceBenchmark(config);
  benchmark.runComprehensiveBenchmark().catch(console.error);
}