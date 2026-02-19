const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3100',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'agroasys_ricardian',
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  AUTH_ENABLED: 'false',
  API_KEYS_JSON: '[]',
  HMAC_SECRET: '',
  AUTH_MAX_SKEW_SECONDS: '300',
  AUTH_NONCE_TTL_SECONDS: '600',
  RATE_LIMIT_ENABLED: 'false',
  RATE_LIMIT_REDIS_URL: '',
};

function withEnv(overrides: Record<string, string | undefined>, run: () => void): void {
  const original = process.env;
  process.env = { ...original, ...BASE_ENV };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    process.env = original;
    jest.resetModules();
  }
}

function loadConfigModule() {
  jest.resetModules();
  return require('../src/config') as typeof import('../src/config');
}

describe('ricardian nonce store config', () => {
  test('production rejects in-memory nonce store', () => {
    withEnv({ NODE_ENV: 'production', NONCE_STORE: 'inmemory' }, () => {
      expect(() => loadConfigModule()).toThrow('NONCE_STORE=inmemory is not allowed when NODE_ENV=production');
    });
  });

  test('production defaults to postgres when REDIS_URL is not set', () => {
    withEnv({ NODE_ENV: 'production', NONCE_STORE: undefined, REDIS_URL: undefined }, () => {
      const { loadConfig } = loadConfigModule();
      const config = loadConfig();
      expect(config.nonceStore).toBe('postgres');
    });
  });

  test('production defaults to redis when REDIS_URL is set', () => {
    withEnv({ NODE_ENV: 'production', NONCE_STORE: undefined, REDIS_URL: 'redis://localhost:6379' }, () => {
      const { loadConfig } = loadConfigModule();
      const config = loadConfig();
      expect(config.nonceStore).toBe('redis');
      expect(config.nonceRedisUrl).toBe('redis://localhost:6379');
    });
  });

  test('redis mode requires REDIS_URL', () => {
    withEnv({ NODE_ENV: 'production', NONCE_STORE: 'redis', REDIS_URL: '' }, () => {
      expect(() => loadConfigModule()).toThrow('REDIS_URL is required when NONCE_STORE=redis');
    });
  });
});
