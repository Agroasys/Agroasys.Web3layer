import dotenv from 'dotenv';
import { strict as assert } from 'assert';
import { parseServiceApiKeys, ServiceApiKey } from './auth/serviceAuth';

dotenv.config();

export interface TreasuryConfig {
  port: number;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  indexerGraphqlUrl: string;
  ingestBatchSize: number;
  ingestMaxEvents: number;
  authEnabled: boolean;
  apiKeys: ServiceApiKey[];
  authMaxSkewSeconds: number;
  authNonceTtlSeconds: number;
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

export function loadConfig(): TreasuryConfig {
  const authEnabled = envBool('AUTH_ENABLED', false);
  const apiKeys = parseServiceApiKeys(process.env.API_KEYS_JSON);

  if (authEnabled) {
    assert(apiKeys.length > 0, 'API_KEYS_JSON must contain at least one API key when AUTH_ENABLED=true');
  }

  const config: TreasuryConfig = {
    port: envNumber('PORT'),
    dbHost: env('DB_HOST'),
    dbPort: envNumber('DB_PORT'),
    dbName: env('DB_NAME'),
    dbUser: env('DB_USER'),
    dbPassword: env('DB_PASSWORD'),
    indexerGraphqlUrl: env('INDEXER_GRAPHQL_URL'),
    ingestBatchSize: envNumber('TREASURY_INGEST_BATCH_SIZE', 100),
    ingestMaxEvents: envNumber('TREASURY_INGEST_MAX_EVENTS', 2000),
    authEnabled,
    apiKeys,
    authMaxSkewSeconds: envNumber('AUTH_MAX_SKEW_SECONDS', 300),
    authNonceTtlSeconds: envNumber('AUTH_NONCE_TTL_SECONDS', 600),
  };

  assert(config.ingestBatchSize > 0, 'TREASURY_INGEST_BATCH_SIZE must be > 0');
  assert(config.ingestMaxEvents > 0, 'TREASURY_INGEST_MAX_EVENTS must be > 0');
  assert(config.authMaxSkewSeconds > 0, 'AUTH_MAX_SKEW_SECONDS must be > 0');
  assert(config.authNonceTtlSeconds > 0, 'AUTH_NONCE_TTL_SECONDS must be > 0');

  return config;
}

export const config = loadConfig();
