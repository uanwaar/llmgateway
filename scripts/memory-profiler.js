/**
 * Memory Profiling and Optimization Script for LLM Gateway
 * 
 * This script provides memory profiling, leak detection, and optimization
 * recommendations for the LLM Gateway application.
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

class MemoryProfiler {
  constructor(options = {}) {
    this.profilingInterval = options.profilingInterval || 5000; // 5 seconds
    this.maxSnapshots = options.maxSnapshots || 100;
    this.outputDir = options.outputDir || './memory-profiles';
    this.alertThresholds = {
      heapUsed: options.heapThreshold || 500 * 1024 * 1024, // 500MB
      rss: options.rssThreshold || 1024 * 1024 * 1024, // 1GB
      heapGrowthRate: options.growthRateThreshold || 50 * 1024 * 1024, // 50MB/min
      ...options.alertThresholds
    };
    
    this.snapshots = [];
    this.isProfiler = false;
    this.profilingTimer = null;
    this.gcStats = [];
    this.memoryLeaks = [];
  }

  /**
   * Start memory profiling
   */
  async startProfiling() {
    if (this.isProfiler) {
      console.log('⚠️  Memory profiling is already running');
      return;
    }

    console.log('🧠 Starting Memory Profiling...');
    console.log(`Interval: ${this.profilingInterval}ms`);
    console.log('Thresholds:', this.alertThresholds);

    this.isProfiler = true;
    
    // Create output directory
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // Enable garbage collection monitoring if available
    this.enableGCMonitoring();
    
    // Start profiling loop
    this.profilingTimer = setInterval(() => {
      this.captureMemorySnapshot();
    }, this.profilingInterval);

    console.log('✅ Memory profiling started');
  }

  /**
   * Stop memory profiling
   */
  async stopProfiling() {
    if (!this.isProfiler) {
      console.log('⚠️  Memory profiling is not running');
      return;
    }

    if (this.profilingTimer) {
      clearInterval(this.profilingTimer);
      this.profilingTimer = null;
    }

    this.isProfiler = false;
    
    // Generate final report
    const report = await this.generateMemoryReport();
    await this.saveMemoryReport(report);
    
    console.log('🛑 Memory profiling stopped');
    return report;
  }

  /**
   * Enable garbage collection monitoring
   */
  enableGCMonitoring() {
    if (global.gc) {
      console.log('✅ GC monitoring enabled');
      
      // Hook into garbage collection events if available
      process.on('beforeExit', () => {
        this.recordGCEvent('beforeExit');
      });
      
    } else {
      console.log('⚠️  GC monitoring not available (run with --expose-gc flag)');
    }
  }

  /**
   * Capture memory snapshot
   */
  captureMemorySnapshot() {
    const timestamp = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const snapshot = {
      timestamp,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers || 0
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      nodeVersion: process.version
    };

    // Add heap statistics if available
    if (global.gc && typeof process.getHeapSnapshot === 'function') {
      try {
        const heapStats = this.getHeapStatistics();
        snapshot.heap = heapStats;
      } catch (error) {
        // Heap statistics not available
      }
    }

    this.snapshots.push(snapshot);
    
    // Limit snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Check for memory alerts
    this.checkMemoryAlerts(snapshot);
    
    // Analyze for memory leaks
    this.analyzeMemoryLeaks();

    // Log current memory usage
    this.logMemoryUsage(snapshot);
  }

  /**
   * Get heap statistics
   */
  getHeapStatistics() {
    try {
      if (typeof v8 !== 'undefined' && v8.getHeapStatistics) {
        return v8.getHeapStatistics();
      }
      
      // Fallback heap information
      const usage = process.memoryUsage();
      return {
        total_heap_size: usage.heapTotal,
        used_heap_size: usage.heapUsed,
        heap_size_limit: usage.heapTotal * 2, // Estimate
        malloced_memory: usage.external,
        peak_malloced_memory: usage.external
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Record garbage collection event
   */
  recordGCEvent(type, duration = 0) {
    this.gcStats.push({
      timestamp: Date.now(),
      type,
      duration,
      memoryBefore: process.memoryUsage(),
      memoryAfter: null // Would be filled after GC
    });

    // Limit GC stats
    if (this.gcStats.length > 500) {
      this.gcStats.shift();
    }
  }

  /**
   * Check for memory alerts
   */
  checkMemoryAlerts(snapshot) {
    const alerts = [];

    // Check heap usage
    if (snapshot.memory.heapUsed > this.alertThresholds.heapUsed) {
      alerts.push({
        type: 'HIGH_HEAP_USAGE',
        severity: 'WARNING',
        message: `Heap usage (${(snapshot.memory.heapUsed / 1024 / 1024).toFixed(0)}MB) exceeds threshold (${(this.alertThresholds.heapUsed / 1024 / 1024).toFixed(0)}MB)`,
        value: snapshot.memory.heapUsed,
        threshold: this.alertThresholds.heapUsed
      });
    }

    // Check RSS usage
    if (snapshot.memory.rss > this.alertThresholds.rss) {
      alerts.push({
        type: 'HIGH_RSS_USAGE',
        severity: 'CRITICAL',
        message: `RSS usage (${(snapshot.memory.rss / 1024 / 1024).toFixed(0)}MB) exceeds threshold (${(this.alertThresholds.rss / 1024 / 1024).toFixed(0)}MB)`,
        value: snapshot.memory.rss,
        threshold: this.alertThresholds.rss
      });
    }

    // Check growth rate (if we have enough snapshots)
    if (this.snapshots.length >= 12) { // 1 minute of data at 5-second intervals
      const growthRate = this.calculateGrowthRate();
      if (growthRate > this.alertThresholds.heapGrowthRate) {
        alerts.push({
          type: 'HIGH_MEMORY_GROWTH',
          severity: 'WARNING',
          message: `Memory growth rate (${(growthRate / 1024 / 1024).toFixed(1)}MB/min) exceeds threshold (${(this.alertThresholds.heapGrowthRate / 1024 / 1024).toFixed(1)}MB/min)`,
          value: growthRate,
          threshold: this.alertThresholds.heapGrowthRate
        });
      }
    }

    // Process alerts
    alerts.forEach(alert => this.processMemoryAlert(alert));
  }

  /**
   * Calculate memory growth rate
   */
  calculateGrowthRate() {
    if (this.snapshots.length < 12) return 0;

    const recent = this.snapshots.slice(-12);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const timeDiff = newest.timestamp - oldest.timestamp;
    const memoryDiff = newest.memory.heapUsed - oldest.memory.heapUsed;
    
    // Convert to per-minute rate
    return (memoryDiff / timeDiff) * 60000;
  }

  /**
   * Process memory alert
   */
  processMemoryAlert(alert) {
    console.log(`\n🚨 MEMORY ALERT [${alert.severity}]: ${alert.type}`);
    console.log(`   ${alert.message}`);
    console.log(`   Time: ${new Date().toISOString()}`);
    
    // Trigger garbage collection if possible
    if (alert.severity === 'CRITICAL' && global.gc) {
      console.log('🗑️  Triggering garbage collection...');
      global.gc();
    }
    
    // Auto-generate heap snapshot for critical alerts
    if (alert.severity === 'CRITICAL') {
      this.generateHeapSnapshot().catch(console.error);
    }
  }

  /**
   * Analyze for memory leaks
   */
  analyzeMemoryLeaks() {
    if (this.snapshots.length < 20) return; // Need enough data

    const recent20 = this.snapshots.slice(-20);
    const heapUsages = recent20.map(s => s.memory.heapUsed);
    
    // Check for consistent upward trend
    let increasingCount = 0;
    for (let i = 1; i < heapUsages.length; i++) {
      if (heapUsages[i] > heapUsages[i - 1]) {
        increasingCount++;
      }
    }

    const increasingPercentage = (increasingCount / (heapUsages.length - 1)) * 100;
    
    if (increasingPercentage > 80) { // 80% of measurements are increasing
      const potentialLeak = {
        timestamp: Date.now(),
        type: 'POTENTIAL_MEMORY_LEAK',
        severity: 'HIGH',
        message: `Detected potential memory leak: ${increasingPercentage.toFixed(1)}% of recent measurements show increasing heap usage`,
        trendPercentage: increasingPercentage,
        startHeap: heapUsages[0],
        endHeap: heapUsages[heapUsages.length - 1],
        growth: heapUsages[heapUsages.length - 1] - heapUsages[0]
      };
      
      this.memoryLeaks.push(potentialLeak);
      console.log(`\n🔍 ${potentialLeak.message}`);
      console.log(`   Growth: ${(potentialLeak.growth / 1024 / 1024).toFixed(1)}MB over ${recent20.length * this.profilingInterval / 1000}s`);
    }
  }

  /**
   * Generate heap snapshot
   */
  async generateHeapSnapshot() {
    try {
      if (typeof process.getHeapSnapshot !== 'function') {
        console.log('⚠️  Heap snapshots not available in this Node.js version');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `heap-snapshot-${timestamp}.heapsnapshot`;
      const filepath = path.join(this.outputDir, filename);
      
      console.log('📸 Generating heap snapshot...');
      
      const heapSnapshot = process.getHeapSnapshot();
      const writeStream = require('fs').createWriteStream(filepath);
      
      heapSnapshot.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      console.log(`💾 Heap snapshot saved: ${filename}`);
      return filepath;
      
    } catch (error) {
      console.error('Failed to generate heap snapshot:', error.message);
    }
  }

  /**
   * Log current memory usage
   */
  logMemoryUsage(snapshot) {
    const timestamp = new Date(snapshot.timestamp).toLocaleTimeString();
    const heapMB = (snapshot.memory.heapUsed / 1024 / 1024).toFixed(1);
    const rssMB = (snapshot.memory.rss / 1024 / 1024).toFixed(1);
    const externalMB = (snapshot.memory.external / 1024 / 1024).toFixed(1);
    
    console.log(`\n🧠 [${timestamp}] Memory Usage:`);
    console.log(`  Heap Used: ${heapMB}MB`);
    console.log(`  RSS: ${rssMB}MB`);
    console.log(`  External: ${externalMB}MB`);
    console.log(`  Uptime: ${(snapshot.uptime / 60).toFixed(1)}min`);
  }

  /**
   * Generate comprehensive memory report
   */
  async generateMemoryReport() {
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: this.snapshots.length > 0 ? 
          this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp : 0,
        snapshotCount: this.snapshots.length,
        nodeVersion: process.version
      },
      summary: this.generateMemorySummary(),
      analysis: this.generateMemoryAnalysis(),
      recommendations: this.generateOptimizationRecommendations(),
      leaks: this.memoryLeaks,
      gcStats: this.gcStats.slice(-50), // Last 50 GC events
      snapshots: this.snapshots.slice(-20) // Last 20 snapshots for analysis
    };

    return report;
  }

  /**
   * Generate memory usage summary
   */
  generateMemorySummary() {
    if (this.snapshots.length === 0) return null;

    const heapUsages = this.snapshots.map(s => s.memory.heapUsed);
    const rssUsages = this.snapshots.map(s => s.memory.rss);
    
    return {
      heap: {
        min: Math.min(...heapUsages),
        max: Math.max(...heapUsages),
        avg: heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length,
        current: heapUsages[heapUsages.length - 1],
        growth: heapUsages[heapUsages.length - 1] - heapUsages[0]
      },
      rss: {
        min: Math.min(...rssUsages),
        max: Math.max(...rssUsages),
        avg: rssUsages.reduce((a, b) => a + b, 0) / rssUsages.length,
        current: rssUsages[rssUsages.length - 1],
        growth: rssUsages[rssUsages.length - 1] - rssUsages[0]
      },
      growthRate: this.calculateGrowthRate()
    };
  }

  /**
   * Generate memory analysis
   */
  generateMemoryAnalysis() {
    const analysis = {
      stability: 'unknown',
      trends: [],
      issues: []
    };

    if (this.snapshots.length < 10) {
      analysis.stability = 'insufficient_data';
      return analysis;
    }

    const summary = this.generateMemorySummary();
    const growthRate = Math.abs(summary.growthRate);

    // Stability analysis
    if (growthRate < 1024 * 1024) { // < 1MB/min
      analysis.stability = 'stable';
    } else if (growthRate < 10 * 1024 * 1024) { // < 10MB/min
      analysis.stability = 'moderate_growth';
    } else {
      analysis.stability = 'high_growth';
    }

    // Trend analysis
    if (summary.heap.growth > 50 * 1024 * 1024) { // > 50MB growth
      analysis.trends.push('increasing_heap_usage');
    }
    
    if (summary.rss.growth > 100 * 1024 * 1024) { // > 100MB growth
      analysis.trends.push('increasing_rss_usage');
    }

    // Issue detection
    if (this.memoryLeaks.length > 0) {
      analysis.issues.push('potential_memory_leaks');
    }
    
    if (summary.heap.max > 500 * 1024 * 1024) { // > 500MB
      analysis.issues.push('high_memory_usage');
    }

    return analysis;
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations() {
    const recommendations = [];
    const summary = this.generateMemorySummary();
    
    if (!summary) return recommendations;

    // High memory usage recommendations
    if (summary.heap.max > 500 * 1024 * 1024) {
      recommendations.push({
        type: 'memory_optimization',
        priority: 'high',
        title: 'High Memory Usage Detected',
        description: `Peak heap usage: ${(summary.heap.max / 1024 / 1024).toFixed(0)}MB`,
        actions: [
          'Review object caching strategies and implement TTL',
          'Optimize data structures and reduce object retention',
          'Consider using streaming for large data processing',
          'Implement connection pooling for external services'
        ]
      });
    }

    // Memory growth recommendations
    if (summary.growthRate > 10 * 1024 * 1024) { // > 10MB/min
      recommendations.push({
        type: 'memory_leak',
        priority: 'critical',
        title: 'Rapid Memory Growth Detected',
        description: `Growth rate: ${(summary.growthRate / 1024 / 1024).toFixed(1)}MB/min`,
        actions: [
          'Investigate potential memory leaks in request handlers',
          'Review event listener cleanup and unsubscription',
          'Check for circular references in object graphs',
          'Implement proper cleanup in error handling paths'
        ]
      });
    }

    // GC recommendations
    if (this.gcStats.length > 0) {
      const avgGCDuration = this.gcStats.reduce((sum, gc) => sum + gc.duration, 0) / this.gcStats.length;
      if (avgGCDuration > 100) { // > 100ms average
        recommendations.push({
          type: 'gc_optimization',
          priority: 'medium',
          title: 'GC Performance Issues',
          description: `Average GC duration: ${avgGCDuration.toFixed(1)}ms`,
          actions: [
            'Optimize object allocation patterns',
            'Reduce object churn in hot code paths',
            'Consider adjusting Node.js heap size limits',
            'Implement object pooling for frequently created objects'
          ]
        });
      }
    }

    return recommendations;
  }

  /**
   * Save memory report to file
   */
  async saveMemoryReport(report) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `memory-report-${timestamp}.json`;
      const filepath = path.join(this.outputDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      console.log(`\n📋 Memory report saved: ${filename}`);
      
      // Also save a latest.json for easy access
      await fs.writeFile(path.join(this.outputDir, 'latest.json'), JSON.stringify(report, null, 2));
      
      // Print summary
      this.printMemoryReportSummary(report);
      
    } catch (error) {
      console.error('Failed to save memory report:', error.message);
    }
  }

  /**
   * Print memory report summary
   */
  printMemoryReportSummary(report) {
    console.log('\n🧠 MEMORY PROFILING REPORT');
    console.log('═'.repeat(50));
    
    if (report.summary) {
      console.log(`Duration: ${(report.metadata.duration / 1000 / 60).toFixed(1)} minutes`);
      console.log(`Snapshots: ${report.metadata.snapshotCount}`);
      
      console.log(`\n📊 Heap Usage:`);
      console.log(`  Current: ${(report.summary.heap.current / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Peak: ${(report.summary.heap.max / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Growth: ${(report.summary.heap.growth / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  Growth Rate: ${(report.summary.growthRate / 1024 / 1024).toFixed(1)}MB/min`);
      
      console.log(`\n📈 Analysis:`);
      console.log(`  Stability: ${report.analysis.stability}`);
      if (report.analysis.trends.length > 0) {
        console.log(`  Trends: ${report.analysis.trends.join(', ')}`);
      }
      if (report.analysis.issues.length > 0) {
        console.log(`  Issues: ${report.analysis.issues.join(', ')}`);
      }
    }
    
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        console.log(`     ${rec.description}`);
      });
    }
    
    console.log('═'.repeat(50));
  }

  /**
   * Force garbage collection and measure impact
   */
  async forceGarbageCollection() {
    if (!global.gc) {
      console.log('⚠️  Garbage collection not available (run with --expose-gc flag)');
      return null;
    }

    const beforeMemory = process.memoryUsage();
    const startTime = performance.now();
    
    global.gc();
    
    const endTime = performance.now();
    const afterMemory = process.memoryUsage();
    
    const result = {
      duration: endTime - startTime,
      beforeMemory,
      afterMemory,
      freed: {
        heap: beforeMemory.heapUsed - afterMemory.heapUsed,
        rss: beforeMemory.rss - afterMemory.rss,
        external: beforeMemory.external - afterMemory.external
      }
    };
    
    console.log('\n🗑️  Forced Garbage Collection:');
    console.log(`  Duration: ${result.duration.toFixed(1)}ms`);
    console.log(`  Heap freed: ${(result.freed.heap / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  RSS freed: ${(result.freed.rss / 1024 / 1024).toFixed(1)}MB`);
    
    return result;
  }
}

// Export for use in other modules
module.exports = MemoryProfiler;

// CLI execution
if (require.main === module) {
  const config = {
    profilingInterval: parseInt(process.env.MEMORY_PROFILE_INTERVAL) || 5000,
    maxSnapshots: parseInt(process.env.MEMORY_MAX_SNAPSHOTS) || 100,
    outputDir: process.env.MEMORY_OUTPUT_DIR || './memory-profiles',
    alertThresholds: {
      heapUsed: parseInt(process.env.MEMORY_HEAP_THRESHOLD) || 500 * 1024 * 1024,
      rss: parseInt(process.env.MEMORY_RSS_THRESHOLD) || 1024 * 1024 * 1024,
      heapGrowthRate: parseInt(process.env.MEMORY_GROWTH_THRESHOLD) || 50 * 1024 * 1024
    }
  };

  const profiler = new MemoryProfiler(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down memory profiler...');
    await profiler.stopProfiling();
    process.exit(0);
  });
  
  // Handle GC flag recommendation
  if (!global.gc) {
    console.log('💡 Tip: Run with --expose-gc flag for enhanced GC monitoring');
  }
  
  // Start profiling
  profiler.startProfiling().catch(console.error);
}