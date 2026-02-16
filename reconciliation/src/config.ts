import dotenv from 'dotenv';
import { strict as assert } from 'assert';

dotenv.config();

export interface ReconciliationConfig {
  enabled: boolean;
  daemonIntervalMs: number;
  batchSize: number;
  maxTradesPerRun: number;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  rpcUrl: string;
  chainId: number;
  escrowAddress: string;
  usdcAddress: string;
  indexerGraphqlUrl: string;
}

function env(name: string): string {
  const value = process.env[name];
  assert(value, `${name} is missing`);
  return value;
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

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return raw.toLowerCase() === 'true';
}

export function loadConfig(): ReconciliationConfig {
  const config: ReconciliationConfig = {
    enabled: envBool('RECONCILIATION_ENABLED', false),
    daemonIntervalMs: envNumber('RECONCILIATION_DAEMON_INTERVAL_MS', 60000),
    batchSize: envNumber('RECONCILIATION_BATCH_SIZE', 100),
    maxTradesPerRun: envNumber('RECONCILIATION_MAX_TRADES_PER_RUN', 1000),
    dbHost: env('DB_HOST'),
    dbPort: envNumber('DB_PORT'),
    dbName: env('DB_NAME'),
    dbUser: env('DB_USER'),
    dbPassword: env('DB_PASSWORD'),
    rpcUrl: env('RPC_URL'),
    chainId: envNumber('CHAIN_ID'),
    escrowAddress: env('ESCROW_ADDRESS').toLowerCase(),
    usdcAddress: env('USDC_ADDRESS').toLowerCase(),
    indexerGraphqlUrl: env('INDEXER_GRAPHQL_URL'),
  };

  assert(config.daemonIntervalMs >= 1000, 'RECONCILIATION_DAEMON_INTERVAL_MS must be >= 1000');
  assert(config.batchSize > 0, 'RECONCILIATION_BATCH_SIZE must be > 0');
  assert(config.maxTradesPerRun > 0, 'RECONCILIATION_MAX_TRADES_PER_RUN must be > 0');

  return config;
}

export const config = loadConfig();
