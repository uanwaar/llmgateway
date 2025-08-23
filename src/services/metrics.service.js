/**
 * Metrics Service (Prometheus-compatible with safe fallback)
 * - Exposes counters/gauges/histograms for realtime transcription
 * - Uses prom-client if available, else keeps in-memory metrics and renders a plain text exposition
 */

const config = require('../config');
let promClient = null;
try {
  // Optional dependency; fallback gracefully if not installed
  promClient = require('prom-client');
} catch (_) {
  promClient = null;
}

const METRIC_NAMES = {
  sessionsActive: 'realtime_sessions_active',
  audioSecondsTotal: 'realtime_audio_seconds_total',
  transcriptTokensTotal: 'realtime_transcript_tokens_total',
  responseLatencyMs: 'realtime_response_latency_ms',
  errorsTotal: 'realtime_errors_total',
};

class MetricsService {
  constructor() {
    this.enabled = !!config.metrics?.enabled;

    if (promClient && this.enabled) {
      this.registry = new promClient.Registry();
      if (config.metrics?.collectDefaultMetrics) {
        promClient.collectDefaultMetrics({ register: this.registry });
      }

      this.sessionsActive = new promClient.Gauge({
        name: METRIC_NAMES.sessionsActive,
        help: 'Active realtime sessions',
        registers: [this.registry],
      });
      this.audioSecondsTotal = new promClient.Counter({
        name: METRIC_NAMES.audioSecondsTotal,
        help: 'Total audio seconds ingested to upstream providers',
        registers: [this.registry],
      });
      this.transcriptTokensTotal = new promClient.Counter({
        name: METRIC_NAMES.transcriptTokensTotal,
        help: 'Total transcript tokens produced (approximate)',
        registers: [this.registry],
      });
      this.responseLatencyMs = new promClient.Histogram({
        name: METRIC_NAMES.responseLatencyMs,
        help: 'Latency from input_audio.commit to first transcript.delta (ms)',
        buckets: [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000],
        registers: [this.registry],
      });
      this.errorsTotal = new promClient.Counter({
        name: METRIC_NAMES.errorsTotal,
        help: 'Total errors emitted by the realtime service',
        registers: [this.registry],
      });
    } else {
      // Fallback in-memory metrics
      this.registry = null;
      this._store = {
        sessionsActive: 0,
        audioSecondsTotal: 0,
        transcriptTokensTotal: 0,
        responseLatencySamples: [],
        errorsTotal: 0,
      };
    }
  }

  // Gauge
  setSessionsActive(value) {
    if (!this.enabled) return;
    if (this.sessionsActive) this.sessionsActive.set(value);
    else this._store.sessionsActive = value;
  }
  incSessions(delta = 1) {
    if (!this.enabled) return;
    if (this.sessionsActive) this.sessionsActive.inc(delta);
    else this._store.sessionsActive += delta;
  }

  // Counters
  incAudioSeconds(seconds = 0) {
    if (!this.enabled || !Number.isFinite(seconds) || seconds <= 0) return;
    if (this.audioSecondsTotal) this.audioSecondsTotal.inc(seconds);
    else this._store.audioSecondsTotal += seconds;
  }

  incTranscriptTokens(tokens = 0) {
    if (!this.enabled || !Number.isFinite(tokens) || tokens <= 0) return;
    if (this.transcriptTokensTotal) this.transcriptTokensTotal.inc(tokens);
    else this._store.transcriptTokensTotal += tokens;
  }

  incErrors(count = 1) {
    if (!this.enabled || !Number.isFinite(count) || count <= 0) return;
    if (this.errorsTotal) this.errorsTotal.inc(count);
    else this._store.errorsTotal += count;
  }

  // Histogram
  observeLatencyMs(ms) {
    if (!this.enabled || !Number.isFinite(ms) || ms < 0) return;
    if (this.responseLatencyMs) this.responseLatencyMs.observe(ms);
    else {
      this._store.responseLatencySamples.push(ms);
      if (this._store.responseLatencySamples.length > 5000) {
        this._store.responseLatencySamples = this._store.responseLatencySamples.slice(-2500);
      }
    }
  }

  // Exposition (optional endpoint integration)
  async renderPrometheus() {
    if (!this.enabled) return '';
    if (this.registry) {
      return await this.registry.metrics();
    }
    // Minimal text format for fallback store
    const s = this._store;
    const lines = [
      `# TYPE ${METRIC_NAMES.sessionsActive} gauge`,
      `${METRIC_NAMES.sessionsActive} ${s.sessionsActive}`,
      `# TYPE ${METRIC_NAMES.audioSecondsTotal} counter`,
      `${METRIC_NAMES.audioSecondsTotal} ${s.audioSecondsTotal}`,
      `# TYPE ${METRIC_NAMES.transcriptTokensTotal} counter`,
      `${METRIC_NAMES.transcriptTokensTotal} ${s.transcriptTokensTotal}`,
      `# TYPE ${METRIC_NAMES.errorsTotal} counter`,
      `${METRIC_NAMES.errorsTotal} ${s.errorsTotal}`,
    ];
    // For latency, output simple summary metrics
    if (s.responseLatencySamples.length) {
      const count = s.responseLatencySamples.length;
      const sum = s.responseLatencySamples.reduce((a, b) => a + b, 0);
      lines.push(`# TYPE ${METRIC_NAMES.responseLatencyMs}_sum gauge`);
      lines.push(`${METRIC_NAMES.responseLatencyMs}_sum ${sum}`);
      lines.push(`# TYPE ${METRIC_NAMES.responseLatencyMs}_count gauge`);
      lines.push(`${METRIC_NAMES.responseLatencyMs}_count ${count}`);
    }
    return lines.join('\n');
  }
}

module.exports = new MetricsService();
module.exports.METRIC_NAMES = METRIC_NAMES;
