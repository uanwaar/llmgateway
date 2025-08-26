/**
 * VAD mapping utilities
 * Input VAD shape from session.update:
 * { type: 'server_vad' | 'manual', silence_duration_ms?, prefix_padding_ms?, start_sensitivity?, end_sensitivity? }
 */

function mapOpenAITurnDetection(vad) {
  // Defaults for server VAD
  const defaults = { type: 'server_vad', silence_duration_ms: 500, prefix_padding_ms: 300 };
  if (!vad || !vad.type || vad.type === 'server_vad') {
    return {
      type: 'server_vad',
      silence_duration_ms: isFinite(vad?.silence_duration_ms) ? vad.silence_duration_ms : defaults.silence_duration_ms,
      prefix_padding_ms: isFinite(vad?.prefix_padding_ms) ? vad.prefix_padding_ms : defaults.prefix_padding_ms,
    };
  }
  if (vad.type === 'manual') {
  // Disable provider VAD entirely; rely on client commit
  // OpenAI expects null to disable turn_detection
  return null;
  }
  return defaults;
}

function normalizeSensitivity(val, kind) {
  if (!val) return undefined;
  const v = String(val).toUpperCase();
  // Accept already-prefixed values
  if (v.startsWith('START_SENSITIVITY_') || v.startsWith('END_SENSITIVITY_')) return v;
  // Map common symbols to HIGH/MEDIUM/LOW
  const map = { H: 'HIGH', HIGH: 'HIGH', M: 'MEDIUM', MEDIUM: 'MEDIUM', L: 'LOW', LOW: 'LOW' };
  const key = map[v] || map[v[0]] || undefined;
  if (!key) return undefined;
  return `${kind === 'start' ? 'START' : 'END'}_SENSITIVITY_${key}`;
}

function mapGeminiRealtimeInputConfig(vad) {
  // Default: enable automatic detection with standard timings
  const defaults = {
    automaticActivityDetection: {
      disabled: false,
      startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
      endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
      prefixPaddingMs: 300,
      silenceDurationMs: 500,
    },
  };

  if (!vad || !vad.type || vad.type === 'server_vad') {
    return {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: normalizeSensitivity(vad?.start_sensitivity, 'start') || defaults.automaticActivityDetection.startOfSpeechSensitivity,
        endOfSpeechSensitivity: normalizeSensitivity(vad?.end_sensitivity, 'end') || defaults.automaticActivityDetection.endOfSpeechSensitivity,
        prefixPaddingMs: isFinite(vad?.prefix_padding_ms) ? vad.prefix_padding_ms : defaults.automaticActivityDetection.prefixPaddingMs,
        silenceDurationMs: isFinite(vad?.silence_duration_ms) ? vad.silence_duration_ms : defaults.automaticActivityDetection.silenceDurationMs,
      },
    };
  }

  if (vad.type === 'manual') {
    return { automaticActivityDetection: { disabled: true } };
  }

  return defaults;
}

module.exports = { mapOpenAITurnDetection, mapGeminiRealtimeInputConfig };
