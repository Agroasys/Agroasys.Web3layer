import dotenv from 'dotenv';
import { strict as assert } from 'assert';
import { normalizeAddressOrThrow } from './utils/address';

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
  notificationsEnabled: boolean;
  notificationsWebhookUrl?: string;
  notificationsCooldownMs: number;
  notificationsRequestTimeoutMs: number;
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

function envAddress(name: string): string {
  const value = env(name);
  return normalizeAddressOrThrow(value, name);
}

function envUrl(name: string): string {
  const value = env(name);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL, received "${value}"`);
  }

  assert(
    parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'ws:' || parsed.protocol === 'wss:',
    `${name} must use http, https, ws, or wss protocol`,
  );

  return value;
}

export function loadConfig(): ReconciliationConfig {
  const notificationsEnabled = envBool('NOTIFICATIONS_ENABLED', false);
  const notificationsWebhookUrl = process.env.NOTIFICATIONS_WEBHOOK_URL;

  if (notificationsEnabled) {
    assert(notificationsWebhookUrl, 'NOTIFICATIONS_WEBHOOK_URL is required when NOTIFICATIONS_ENABLED=true');
  }

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
    rpcUrl: envUrl('RPC_URL'),
    chainId: envNumber('CHAIN_ID'),
    escrowAddress: envAddress('ESCROW_ADDRESS'),
    usdcAddress: envAddress('USDC_ADDRESS'),
    indexerGraphqlUrl: envUrl('INDEXER_GRAPHQL_URL'),
    notificationsEnabled,
    notificationsWebhookUrl,
    notificationsCooldownMs: envNumber('NOTIFICATIONS_COOLDOWN_MS', 300000),
    notificationsRequestTimeoutMs: envNumber('NOTIFICATIONS_REQUEST_TIMEOUT_MS', 5000),
  };

  assert(config.daemonIntervalMs >= 1000, 'RECONCILIATION_DAEMON_INTERVAL_MS must be >= 1000');
  assert(config.batchSize > 0, 'RECONCILIATION_BATCH_SIZE must be > 0');
  assert(config.maxTradesPerRun > 0, 'RECONCILIATION_MAX_TRADES_PER_RUN must be > 0');
  assert(config.notificationsCooldownMs >= 0, 'NOTIFICATIONS_COOLDOWN_MS must be >= 0');
  assert(config.notificationsRequestTimeoutMs >= 1000, 'NOTIFICATIONS_REQUEST_TIMEOUT_MS must be >= 1000');

  return config;
}

export const config = loadConfig();
