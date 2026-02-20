import dotenv from 'dotenv';
import { strict as assert } from 'assert';
import { parseServiceApiKeys, ServiceApiKey } from './auth/serviceAuth';

dotenv.config();

export type NonceStoreMode = 'redis' | 'postgres' | 'inmemory';

export interface TreasuryConfig {
  port: number;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  indexerGraphqlUrl: string;
  indexerGraphqlRequestTimeoutMs: number;
  ingestBatchSize: number;
  ingestMaxEvents: number;
  authEnabled: boolean;
  apiKeys: ServiceApiKey[];
  hmacSecret?: string;
  authMaxSkewSeconds: number;
  authNonceTtlSeconds: number;
  nonceStore: NonceStoreMode;
  nonceRedisUrl?: string;
  nonceTtlSeconds: number;
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

function resolveNonceStoreMode(nodeEnv: string): NonceStoreMode {
  const rawMode = process.env.NONCE_STORE?.trim().toLowerCase();

  if (!rawMode) {
    if (nodeEnv === 'production') {
      return process.env.REDIS_URL?.trim() ? 'redis' : 'postgres';
    }

    return 'inmemory';
  }

  if (rawMode === 'redis' || rawMode === 'postgres' || rawMode === 'inmemory') {
    return rawMode;
  }

  throw new Error('NONCE_STORE must be one of: redis, postgres, inmemory');
}

export function loadConfig(): TreasuryConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const authEnabled = envBool('AUTH_ENABLED', false);
  const apiKeys = parseServiceApiKeys(process.env.API_KEYS_JSON);
  const hmacSecret = process.env.HMAC_SECRET?.trim();
  const nonceStore = resolveNonceStoreMode(nodeEnv);
  const nonceRedisUrl = process.env.REDIS_URL?.trim() || undefined;
  const authNonceTtlSeconds = envNumber('AUTH_NONCE_TTL_SECONDS', 600);
  const nonceTtlSeconds = process.env.NONCE_TTL_SECONDS
    ? envNumber('NONCE_TTL_SECONDS')
    : authNonceTtlSeconds;
  const indexerGraphqlTimeoutMinMs = envNumber('INDEXER_GQL_TIMEOUT_MIN_MS', 1000);
  const indexerGraphqlTimeoutMaxMs = envNumber('INDEXER_GQL_TIMEOUT_MAX_MS', 60000);
  const indexerGraphqlRequestTimeoutMs = envNumber('INDEXER_GQL_TIMEOUT_MS', 10000);

  if (authEnabled) {
    assert(
      apiKeys.length > 0 || Boolean(hmacSecret),
      'AUTH_ENABLED=true requires either API_KEYS_JSON entries or HMAC_SECRET'
    );
  }

  if (nodeEnv === 'production' && nonceStore === 'inmemory') {
    throw new Error('NONCE_STORE=inmemory is not allowed when NODE_ENV=production');
  }

  if (nonceStore === 'redis') {
    assert(nonceRedisUrl, 'REDIS_URL is required when NONCE_STORE=redis');
  }

  assert(indexerGraphqlTimeoutMinMs >= 1000, 'INDEXER_GQL_TIMEOUT_MIN_MS must be >= 1000');
  assert(indexerGraphqlTimeoutMaxMs <= 60000, 'INDEXER_GQL_TIMEOUT_MAX_MS must be <= 60000');
  assert(
    indexerGraphqlTimeoutMinMs <= indexerGraphqlTimeoutMaxMs,
    'INDEXER_GQL_TIMEOUT_MIN_MS must be <= INDEXER_GQL_TIMEOUT_MAX_MS'
  );
  assert(
    indexerGraphqlRequestTimeoutMs >= indexerGraphqlTimeoutMinMs &&
      indexerGraphqlRequestTimeoutMs <= indexerGraphqlTimeoutMaxMs,
    `INDEXER_GQL_TIMEOUT_MS must be between ${indexerGraphqlTimeoutMinMs} and ${indexerGraphqlTimeoutMaxMs}`
  );

  const config: TreasuryConfig = {
    port: envNumber('PORT'),
    dbHost: env('DB_HOST'),
    dbPort: envNumber('DB_PORT'),
    dbName: env('DB_NAME'),
    dbUser: env('DB_USER'),
    dbPassword: env('DB_PASSWORD'),
    indexerGraphqlUrl: env('INDEXER_GRAPHQL_URL'),
    indexerGraphqlRequestTimeoutMs,
    ingestBatchSize: envNumber('TREASURY_INGEST_BATCH_SIZE', 100),
    ingestMaxEvents: envNumber('TREASURY_INGEST_MAX_EVENTS', 2000),
    authEnabled,
    apiKeys,
    hmacSecret,
    authMaxSkewSeconds: envNumber('AUTH_MAX_SKEW_SECONDS', 300),
    authNonceTtlSeconds,
    nonceStore,
    nonceRedisUrl,
    nonceTtlSeconds,
  };

  assert(config.ingestBatchSize > 0, 'TREASURY_INGEST_BATCH_SIZE must be > 0');
  assert(config.ingestMaxEvents > 0, 'TREASURY_INGEST_MAX_EVENTS must be > 0');
  assert(config.authMaxSkewSeconds > 0, 'AUTH_MAX_SKEW_SECONDS must be > 0');
  assert(config.authNonceTtlSeconds > 0, 'AUTH_NONCE_TTL_SECONDS must be > 0');
  assert(config.nonceTtlSeconds > 0, 'NONCE_TTL_SECONDS must be > 0');

  return config;
}

export const config = loadConfig();
