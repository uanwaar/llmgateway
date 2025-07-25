/**
 * Performance Monitoring Script for LLM Gateway
 * 
 * This script provides real-time performance monitoring, alerting,
 * and automated performance analysis for the LLM Gateway.
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

class PerformanceMonitor {
  constructor(options = {}) {
    this.gatewayUrl = options.gatewayUrl || 'http://localhost:8080';
    this.monitoringInterval = options.monitoringInterval || 30000; // 30 seconds
    this.alertThresholds = {
      responseTime: options.responseTimeThreshold || 5000, // 5 seconds
      errorRate: options.errorRateThreshold || 5, // 5%
      memoryUsage: options.memoryThreshold || 500, // 500MB
      requestsPerSecond: options.rpsThreshold || 100,
      ...options.alertThresholds
    };
    
    this.metrics = {
      responseTime: [],
      errorRate: [],
      requestsPerSecond: [],
      memoryUsage: [],
      systemHealth: [],
      providerHealth: [],
      cacheMetrics: []
    };
    
    this.alerts = [];
    this.isMonitoring = false;
    this.monitoringTimer = null;
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️  Monitoring is already running');
      return;
    }

    console.log('🚀 Starting Performance Monitoring...');
    console.log(`Gateway: ${this.gatewayUrl}`);
    console.log(`Interval: ${this.monitoringInterval}ms`);
    console.log('Thresholds:', this.alertThresholds);

    this.isMonitoring = true;
    
    // Initial health check
    const isHealthy = await this.checkGatewayHealth();
    if (!isHealthy) {
      console.error('❌ Gateway is not healthy. Monitoring will continue but alerts may be triggered.');
    }

    // Start monitoring loop
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.analyzeMetrics();
        await this.checkAlerts();
      } catch (error) {
        console.error('Monitoring error:', error.message);
      }
    }, this.monitoringInterval);

    console.log('✅ Performance monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('⚠️  Monitoring is not running');
      return;
    }

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.isMonitoring = false;
    console.log('🛑 Performance monitoring stopped');
  }

  /**
   * Check gateway health
   */
  async checkGatewayHealth() {
    try {
      const response = await axios.get(`${this.gatewayUrl}/health`, {
        timeout: 10000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Collect comprehensive metrics
   */
  async collectMetrics() {
    const timestamp = Date.now();
    const metrics = {
      timestamp,
      responseTime: await this.measureResponseTime(),
      systemHealth: await this.getSystemHealth(),
      providerHealth: await this.getProviderHealth(),
      cacheMetrics: await this.getCacheMetrics(),
      errorRate: await this.calculateErrorRate(),
      requestsPerSecond: await this.calculateRequestsPerSecond()
    };

    // Store metrics
    Object.keys(metrics).forEach(key => {
      if (key !== 'timestamp' && this.metrics[key]) {
        this.metrics[key].push({
          timestamp,
          value: metrics[key]
        });
        
        // Keep only last 100 measurements
        if (this.metrics[key].length > 100) {
          this.metrics[key] = this.metrics[key].slice(-100);
        }
      }
    });

    // Log current metrics
    this.logCurrentMetrics(metrics);
  }

  /**
   * Measure response time with sample requests
   */
  async measureResponseTime() {
    const testRequests = [
      // Simple chat request
      {
        endpoint: '/v1/chat/completions',
        data: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10
        }
      },
      // Health check
      {
        endpoint: '/health',
        method: 'GET'
      },
      // Models endpoint
      {
        endpoint: '/v1/models',
        method: 'GET'
      }
    ];

    const responseTimes = [];

    for (const request of testRequests) {
      try {
        const startTime = performance.now();
        
        const config = {
          method: request.method || 'POST',
          url: `${this.gatewayUrl}${request.endpoint}`,
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer monitor-key'
          }
        };

        if (request.data) {
          config.data = request.data;
        }

        await axios(config);
        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
        
      } catch (error) {
        // Include error response times
        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      }
    }

    return responseTimes.length > 0 ? 
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth() {
    try {
      const response = await axios.get(`${this.gatewayUrl}/health/detailed`, {
        timeout: 5000,
        headers: { 'Authorization': 'Bearer monitor-key' }
      });
      
      return {
        status: response.data.status,
        uptime: response.data.uptime,
        memory: response.data.memory,
        version: response.data.version
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Get provider health metrics
   */
  async getProviderHealth() {
    try {
      const response = await axios.get(`${this.gatewayUrl}/health/providers`, {
        timeout: 5000,
        headers: { 'Authorization': 'Bearer monitor-key' }
      });
      
      return response.data;
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  /**
   * Get cache metrics
   */
  async getCacheMetrics() {
    try {
      const response = await axios.get(`${this.gatewayUrl}/metrics/cache`, {
        timeout: 5000,
        headers: { 'Authorization': 'Bearer monitor-key' }
      });
      
      return response.data;
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  /**
   * Calculate current error rate
   */
  async calculateErrorRate() {
    try {
      const response = await axios.get(`${this.gatewayUrl}/metrics/requests`, {
        timeout: 5000,
        headers: { 'Authorization': 'Bearer monitor-key' }
      });
      
      const metrics = response.data;
      if (metrics.totalRequests > 0) {
        return (metrics.errorRequests / metrics.totalRequests) * 100;
      }
      return 0;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate current requests per second
   */
  async calculateRequestsPerSecond() {
    try {
      const response = await axios.get(`${this.gatewayUrl}/metrics/throughput`, {
        timeout: 5000,
        headers: { 'Authorization': 'Bearer monitor-key' }
      });
      
      return response.data.requestsPerSecond || 0;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze metrics for trends and issues
   */
  async analyzeMetrics() {
    const analysis = {
      timestamp: Date.now(),
      trends: {},
      anomalies: [],
      recommendations: []
    };

    // Analyze response time trend
    if (this.metrics.responseTime.length >= 5) {
      const recentTimes = this.metrics.responseTime.slice(-5).map(m => m.value);
      const avgRecent = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
      const avgOverall = this.metrics.responseTime.slice(-20).map(m => m.value)
        .reduce((a, b) => a + b, 0) / Math.min(20, this.metrics.responseTime.length);
      
      const trend = ((avgRecent - avgOverall) / avgOverall) * 100;
      analysis.trends.responseTime = {
        direction: trend > 10 ? 'increasing' : trend < -10 ? 'decreasing' : 'stable',
        percentage: Math.abs(trend).toFixed(1) + '%'
      };

      if (Math.abs(trend) > 25) {
        analysis.anomalies.push({
          type: 'response_time_trend',
          severity: 'medium',
          message: `Response time has ${trend > 0 ? 'increased' : 'decreased'} by ${Math.abs(trend).toFixed(1)}%`
        });
      }
    }

    // Analyze error rate
    if (this.metrics.errorRate.length >= 3) {
      const recentErrors = this.metrics.errorRate.slice(-3).map(m => m.value).filter(v => v !== null);
      if (recentErrors.length > 0) {
        const avgErrorRate = recentErrors.reduce((a, b) => a + b, 0) / recentErrors.length;
        
        if (avgErrorRate > this.alertThresholds.errorRate) {
          analysis.anomalies.push({
            type: 'high_error_rate',
            severity: 'high',
            message: `Error rate is ${avgErrorRate.toFixed(1)}%, above threshold of ${this.alertThresholds.errorRate}%`
          });
        }
      }
    }

    // Store analysis
    this.lastAnalysis = analysis;
    
    return analysis;
  }

  /**
   * Check for alert conditions
   */
  async checkAlerts() {
    const activeAlerts = [];
    const currentTime = Date.now();

    // Response time alerts
    const recentResponseTimes = this.metrics.responseTime.slice(-3);
    if (recentResponseTimes.length >= 3) {
      const avgResponseTime = recentResponseTimes.reduce((sum, m) => sum + m.value, 0) / 3;
      
      if (avgResponseTime > this.alertThresholds.responseTime) {
        activeAlerts.push({
          type: 'HIGH_RESPONSE_TIME',
          severity: 'WARNING',
          message: `Average response time (${avgResponseTime.toFixed(0)}ms) exceeds threshold (${this.alertThresholds.responseTime}ms)`,
          value: avgResponseTime,
          threshold: this.alertThresholds.responseTime,
          timestamp: currentTime
        });
      }
    }

    // Error rate alerts
    const recentErrorRates = this.metrics.errorRate.slice(-2).filter(m => m.value !== null);
    if (recentErrorRates.length > 0) {
      const latestErrorRate = recentErrorRates[recentErrorRates.length - 1].value;
      
      if (latestErrorRate > this.alertThresholds.errorRate) {
        activeAlerts.push({
          type: 'HIGH_ERROR_RATE',
          severity: 'CRITICAL',
          message: `Error rate (${latestErrorRate.toFixed(1)}%) exceeds threshold (${this.alertThresholds.errorRate}%)`,
          value: latestErrorRate,
          threshold: this.alertThresholds.errorRate,
          timestamp: currentTime
        });
      }
    }

    // Memory usage alerts
    const recentSystemHealth = this.metrics.systemHealth.slice(-1);
    if (recentSystemHealth.length > 0 && recentSystemHealth[0].value.memory) {
      const memoryUsage = recentSystemHealth[0].value.memory.heapUsed / 1024 / 1024; // MB
      
      if (memoryUsage > this.alertThresholds.memoryUsage) {
        activeAlerts.push({
          type: 'HIGH_MEMORY_USAGE',
          severity: 'WARNING',
          message: `Memory usage (${memoryUsage.toFixed(0)}MB) exceeds threshold (${this.alertThresholds.memoryUsage}MB)`,
          value: memoryUsage,
          threshold: this.alertThresholds.memoryUsage,
          timestamp: currentTime
        });
      }
    }

    // Process new alerts
    for (const alert of activeAlerts) {
      await this.processAlert(alert);
    }

    // Clean up old alerts (older than 1 hour)
    this.alerts = this.alerts.filter(alert => 
      currentTime - alert.timestamp < 3600000
    );
  }

  /**
   * Process and handle alerts
   */
  async processAlert(alert) {
    // Check if this alert was recently triggered (within last 10 minutes)
    const recentAlert = this.alerts.find(a => 
      a.type === alert.type && 
      Date.now() - a.timestamp < 600000
    );

    if (recentAlert) {
      // Update existing alert
      recentAlert.count = (recentAlert.count || 1) + 1;
      recentAlert.lastSeen = alert.timestamp;
      return;
    }

    // New alert
    alert.id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    alert.count = 1;
    
    this.alerts.push(alert);
    
    // Log alert
    console.log(`\n🚨 ALERT [${alert.severity}]: ${alert.type}`);
    console.log(`   ${alert.message}`);
    console.log(`   Time: ${new Date(alert.timestamp).toISOString()}`);
    
    // Save alert to file
    await this.saveAlert(alert);
    
    // Trigger alert actions
    await this.triggerAlertActions(alert);
  }

  /**
   * Save alert to file for persistence
   */
  async saveAlert(alert) {
    try {
      const alertsDir = './monitoring/alerts';
      await fs.mkdir(alertsDir, { recursive: true });
      
      const filename = `alert-${alert.id}.json`;
      await fs.writeFile(
        path.join(alertsDir, filename),
        JSON.stringify(alert, null, 2)
      );
    } catch (error) {
      console.error('Failed to save alert:', error.message);
    }
  }

  /**
   * Trigger alert actions (notifications, auto-scaling, etc.)
   */
  async triggerAlertActions(alert) {
    // Log alert action
    console.log(`📧 Alert actions triggered for: ${alert.type}`);
    
    // Here you could implement:
    // - Email notifications
    // - Slack/Discord webhooks
    // - Auto-scaling triggers
    // - Restart unhealthy services
    // - etc.
    
    if (alert.severity === 'CRITICAL') {
      console.log('🔥 CRITICAL alert - consider immediate action');
    }
  }

  /**
   * Log current metrics to console
   */
  logCurrentMetrics(metrics) {
    const timestamp = new Date(metrics.timestamp).toLocaleTimeString();
    
    console.log(`\n📊 [${timestamp}] Performance Metrics:`);
    
    if (metrics.responseTime) {
      console.log(`  Response Time: ${metrics.responseTime.toFixed(0)}ms`);
    }
    
    if (metrics.errorRate !== null) {
      console.log(`  Error Rate: ${metrics.errorRate.toFixed(1)}%`);
    }
    
    if (metrics.requestsPerSecond !== null) {
      console.log(`  RPS: ${metrics.requestsPerSecond.toFixed(1)}`);
    }
    
    if (metrics.systemHealth && metrics.systemHealth.memory) {
      const memoryMB = metrics.systemHealth.memory.heapUsed / 1024 / 1024;
      console.log(`  Memory: ${memoryMB.toFixed(0)}MB`);
    }
    
    if (metrics.cacheMetrics && !metrics.cacheMetrics.error) {
      console.log(`  Cache Hit Rate: ${(metrics.cacheMetrics.hitRate * 100).toFixed(1)}%`);
    }
  }

  /**
   * Generate performance report
   */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      period: {
        start: this.metrics.responseTime[0]?.timestamp,
        end: this.metrics.responseTime[this.metrics.responseTime.length - 1]?.timestamp
      },
      summary: {
        averageResponseTime: this.calculateAverage(this.metrics.responseTime),
        maxResponseTime: this.calculateMax(this.metrics.responseTime),
        averageErrorRate: this.calculateAverage(this.metrics.errorRate),
        averageRPS: this.calculateAverage(this.metrics.requestsPerSecond)
      },
      alerts: {
        total: this.alerts.length,
        critical: this.alerts.filter(a => a.severity === 'CRITICAL').length,
        warning: this.alerts.filter(a => a.severity === 'WARNING').length
      },
      analysis: this.lastAnalysis
    };

    // Save report
    const reportsDir = './monitoring/reports';
    await fs.mkdir(reportsDir, { recursive: true });
    
    const filename = `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(
      path.join(reportsDir, filename),
      JSON.stringify(report, null, 2)
    );

    console.log(`📋 Performance report saved: ${filename}`);
    return report;
  }

  /**
   * Calculate average of metric values
   */
  calculateAverage(metrics) {
    if (!metrics || metrics.length === 0) return null;
    
    const values = metrics.map(m => m.value).filter(v => v !== null && !isNaN(v));
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }

  /**
   * Calculate maximum of metric values
   */
  calculateMax(metrics) {
    if (!metrics || metrics.length === 0) return null;
    
    const values = metrics.map(m => m.value).filter(v => v !== null && !isNaN(v));
    return values.length > 0 ? Math.max(...values) : null;
  }
}

// Export for use in other modules
module.exports = PerformanceMonitor;

// CLI execution
if (require.main === module) {
  const config = {
    gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:8080',
    monitoringInterval: parseInt(process.env.MONITOR_INTERVAL) || 30000,
    alertThresholds: {
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME) || 5000,
      errorRate: parseInt(process.env.ALERT_ERROR_RATE) || 5,
      memoryUsage: parseInt(process.env.ALERT_MEMORY_USAGE) || 500
    }
  };

  const monitor = new PerformanceMonitor(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down monitor...');
    monitor.stopMonitoring();
    
    // Generate final report
    await monitor.generateReport();
    process.exit(0);
  });
  
  // Start monitoring
  monitor.startMonitoring().catch(console.error);
}