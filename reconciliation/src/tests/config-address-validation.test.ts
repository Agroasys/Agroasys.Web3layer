import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

const BASE_ENV: Record<string, string> = {
  RECONCILIATION_ENABLED: 'true',
  RECONCILIATION_DAEMON_INTERVAL_MS: '60000',
  RECONCILIATION_BATCH_SIZE: '100',
  RECONCILIATION_MAX_TRADES_PER_RUN: '1000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'agroasys_reconciliation',
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  RPC_URL: 'http://127.0.0.1:8545',
  CHAIN_ID: '31337',
  ESCROW_ADDRESS: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  USDC_ADDRESS: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  INDEXER_GRAPHQL_URL: 'http://127.0.0.1:4350/graphql',
  NOTIFICATIONS_ENABLED: 'false',
  NOTIFICATIONS_WEBHOOK_URL: '',
  NOTIFICATIONS_COOLDOWN_MS: '300000',
  NOTIFICATIONS_REQUEST_TIMEOUT_MS: '5000',
};

function withEnv(overrides: Record<string, string>, fn: () => void): void {
  const snapshot = { ...process.env };

  for (const key of Object.keys(BASE_ENV)) {
    delete process.env[key];
  }

  Object.assign(process.env, BASE_ENV, overrides);

  try {
    fn();
  } finally {
    process.env = snapshot;
  }
}

function loadConfigModule(): typeof import('../config') {
  const modulePath = path.resolve(__dirname, '../config');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath) as typeof import('../config');
}

test('invalid address in config fails with explicit field-level error', () => {
  withEnv({ ESCROW_ADDRESS: 'invalid-address' }, () => {
    assert.throws(
      () => loadConfigModule(),
      /ESCROW_ADDRESS must be a valid EVM address, received "invalid-address"/,
    );
  });
});

test('valid lowercase config addresses are normalized and accepted', () => {
  withEnv({}, () => {
    const { loadConfig } = loadConfigModule();
    const config = loadConfig();

    assert.equal(config.escrowAddress, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    assert.equal(config.usdcAddress, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  });
});
