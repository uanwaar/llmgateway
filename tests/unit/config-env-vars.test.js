const path = require('path');

// Load the config manager singleton
const configModule = require('../../src/config');
const manager = configModule.manager;

describe('Configuration env var overrides', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    // Restore environment and reload
    process.env = { ...origEnv };
    manager.reload();
  });

  test('GATEWAY_PORT overrides server.port', async () => {
    process.env.GATEWAY_PORT = '12345';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.server.port).toBe(12345);
  });

  test('PORT fallback overrides server.port', async () => {
    delete process.env.GATEWAY_PORT;
    process.env.PORT = '23456';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.server.port).toBe(23456);
  });

  test('GATEWAY_HOST overrides server.host', async () => {
    process.env.GATEWAY_HOST = '127.0.0.1';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.server.host).toBe('127.0.0.1');
  });

  test('OPENAI_API_KEY sets providers.openai.apiKey', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.providers.openai.apiKey).toBe('sk-test-openai');
  });

  test('GEMINI_API_KEY sets providers.gemini.apiKey', async () => {
    process.env.GEMINI_API_KEY = 'g-test-gemini';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.providers.gemini.apiKey).toBe('g-test-gemini');
  });

  test('OPENAI_USE_RESPONSES_API toggles openai.useResponsesAPI', async () => {
    process.env.OPENAI_USE_RESPONSES_API = 'false';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.providers.openai.useResponsesAPI).toBe(false);
  });

  test('CACHE_ENABLED toggles cache.enabled', async () => {
    process.env.CACHE_ENABLED = 'false';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.cache.enabled).toBe(false);
  });

  test('RATE_LIMITING_ENABLED toggles server.rateLimitingEnabled', async () => {
    process.env.RATE_LIMITING_ENABLED = 'false';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.server.rateLimitingEnabled).toBe(false);
  });

  test('CACHE_TTL overrides cache.ttl', async () => {
    process.env.CACHE_TTL = '7200';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.cache.ttl).toBe(7200);
  });

  test('CACHE_BACKEND overrides cache.backend', async () => {
    process.env.CACHE_BACKEND = 'redis';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.cache.backend).toBe('redis');
  });

  test('REDIS_URL sets cache.redis.url', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379/1';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.cache.redis.url).toBe('redis://127.0.0.1:6379/1');
  });

  test('LOG_LEVEL overrides logging.level', async () => {
    process.env.LOG_LEVEL = 'debug';
    manager.reload();
    const cfg = manager.getAll();
    expect(cfg.logging.level).toBe('debug');
  });
});
