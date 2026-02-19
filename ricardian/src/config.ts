import dotenv from 'dotenv';
import { strict as assert } from 'assert';
import { parseServiceApiKeys, ServiceApiKey } from './auth/serviceAuth';

dotenv.config();

export interface RicardianConfig {
  port: number;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  authEnabled: boolean;
  apiKeys: ServiceApiKey[];
  hmacSecret?: string;
  authMaxSkewSeconds: number;
  authNonceTtlSeconds: number;
  rateLimitEnabled: boolean;
  rateLimitRedisUrl?: string;
  rateLimitWriteBurstLimit: number;
  rateLimitWriteBurstWindowSeconds: number;
  rateLimitWriteSustainedLimit: number;
  rateLimitWriteSustainedWindowSeconds: number;
  rateLimitReadBurstLimit: number;
  rateLimitReadBurstWindowSeconds: number;
  rateLimitReadSustainedLimit: number;
  rateLimitReadSustainedWindowSeconds: number;
}

function env(name: string): string {
  const value = process.env[name];
  assert(value, `${name} is missing`);
  return value;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  if (raw.toLowerCase() === 'true') {
    return true;
  }

  if (raw.toLowerCase() === 'false') {
    return false;
  }

  throw new Error(`${name} must be true or false`);
}

function envNumber(name: string, fallback?: number): number {
  const raw = process.env[name];
  if ((raw === undefined || raw === '') && fallback !== undefined) {
    return fallback;
  }

  const value = raw ?? env(name);
  const parsed = Number.parseInt(value, 10);
  assert(!Number.isNaN(parsed), `${name} must be a number`);
  return parsed;
}

export function loadConfig(): RicardianConfig {
  const authEnabled = envBool('AUTH_ENABLED', false);
  const apiKeys = parseServiceApiKeys(process.env.API_KEYS_JSON);
  const hmacSecret = process.env.HMAC_SECRET?.trim();

  if (authEnabled) {
    assert(
      apiKeys.length > 0 || Boolean(hmacSecret),
      'AUTH_ENABLED=true requires either API_KEYS_JSON entries or HMAC_SECRET'
    );
  }

  const rateLimitEnabled = envBool('RATE_LIMIT_ENABLED', false);

  const config: RicardianConfig = {
    port: envNumber('PORT'),
    dbHost: env('DB_HOST'),
    dbPort: envNumber('DB_PORT'),
    dbName: env('DB_NAME'),
    dbUser: env('DB_USER'),
    dbPassword: env('DB_PASSWORD'),
    authEnabled,
    apiKeys,
    hmacSecret,
    authMaxSkewSeconds: envNumber('AUTH_MAX_SKEW_SECONDS', 300),
    authNonceTtlSeconds: envNumber('AUTH_NONCE_TTL_SECONDS', 600),
    rateLimitEnabled,
    rateLimitRedisUrl: process.env.RATE_LIMIT_REDIS_URL,
    rateLimitWriteBurstLimit: envNumber('RATE_LIMIT_WRITE_BURST_LIMIT', 10),
    rateLimitWriteBurstWindowSeconds: envNumber('RATE_LIMIT_WRITE_BURST_WINDOW_SECONDS', 10),
    rateLimitWriteSustainedLimit: envNumber('RATE_LIMIT_WRITE_SUSTAINED_LIMIT', 120),
    rateLimitWriteSustainedWindowSeconds: envNumber('RATE_LIMIT_WRITE_SUSTAINED_WINDOW_SECONDS', 60),
    rateLimitReadBurstLimit: envNumber('RATE_LIMIT_READ_BURST_LIMIT', 30),
    rateLimitReadBurstWindowSeconds: envNumber('RATE_LIMIT_READ_BURST_WINDOW_SECONDS', 10),
    rateLimitReadSustainedLimit: envNumber('RATE_LIMIT_READ_SUSTAINED_LIMIT', 600),
    rateLimitReadSustainedWindowSeconds: envNumber('RATE_LIMIT_READ_SUSTAINED_WINDOW_SECONDS', 60),
  };

  assert(config.authMaxSkewSeconds > 0, 'AUTH_MAX_SKEW_SECONDS must be > 0');
  assert(config.authNonceTtlSeconds > 0, 'AUTH_NONCE_TTL_SECONDS must be > 0');
  assert(config.rateLimitWriteBurstLimit > 0, 'RATE_LIMIT_WRITE_BURST_LIMIT must be > 0');
  assert(config.rateLimitWriteBurstWindowSeconds > 0, 'RATE_LIMIT_WRITE_BURST_WINDOW_SECONDS must be > 0');
  assert(config.rateLimitWriteSustainedLimit > 0, 'RATE_LIMIT_WRITE_SUSTAINED_LIMIT must be > 0');
  assert(config.rateLimitWriteSustainedWindowSeconds > 0, 'RATE_LIMIT_WRITE_SUSTAINED_WINDOW_SECONDS must be > 0');
  assert(config.rateLimitReadBurstLimit > 0, 'RATE_LIMIT_READ_BURST_LIMIT must be > 0');
  assert(config.rateLimitReadBurstWindowSeconds > 0, 'RATE_LIMIT_READ_BURST_WINDOW_SECONDS must be > 0');
  assert(config.rateLimitReadSustainedLimit > 0, 'RATE_LIMIT_READ_SUSTAINED_LIMIT must be > 0');
  assert(config.rateLimitReadSustainedWindowSeconds > 0, 'RATE_LIMIT_READ_SUSTAINED_WINDOW_SECONDS must be > 0');

  return config;
}

export const config = loadConfig();
