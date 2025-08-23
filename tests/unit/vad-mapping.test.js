/* eslint-disable no-undef */
const { mapOpenAITurnDetection, mapGeminiRealtimeInputConfig } = require('../../src/utils/vad');

describe('VAD mapping', () => {
  test('OpenAI server_vad defaults and overrides', () => {
    expect(mapOpenAITurnDetection(undefined)).toEqual({ type: 'server_vad', silence_duration_ms: 500, prefix_padding_ms: 300 });
    expect(mapOpenAITurnDetection({ type: 'server_vad', silence_duration_ms: 250, prefix_padding_ms: 100 })).toEqual({ type: 'server_vad', silence_duration_ms: 250, prefix_padding_ms: 100 });
  });

  test('OpenAI manual disables turn detection', () => {
    expect(mapOpenAITurnDetection({ type: 'manual' })).toEqual({ type: 'none' });
  });

  test('Gemini server_vad maps to automaticActivityDetection with sensitivity', () => {
    const cfg = mapGeminiRealtimeInputConfig({ type: 'server_vad', start_sensitivity: 'HIGH', end_sensitivity: 'LOW', prefix_padding_ms: 200, silence_duration_ms: 600 });
    expect(cfg).toEqual({
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
        endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
        prefixPaddingMs: 200,
        silenceDurationMs: 600,
      },
    });
  });

  test('Gemini manual disables automaticActivityDetection', () => {
    expect(mapGeminiRealtimeInputConfig({ type: 'manual' })).toEqual({ automaticActivityDetection: { disabled: true } });
  });
});
