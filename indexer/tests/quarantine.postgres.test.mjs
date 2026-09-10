import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { QuarantineStore } = require('../lib/quarantine');
const { assertNoUnresolvedQuarantine, UnresolvedQuarantineError } = require('../lib/preflight');
const IndexerQuarantineMigration = require('../db/migrations/1785600000000-IndexerQuarantine.js');
const {
  createAdminPool,
  dockerAvailable,
  runSql,
  withPostgresContainer,
} = require('../../shared-db/postgres-test-support');

const ENTRY = {
  blockNumber: 4242,
  blockHash: '0xblockhash',
  txHash: '0xtxhash',
  logIndex: 2,
  transactionIndex: 1,
  contractAddress: '0x00000000000000000000000000000000000000aa',
  topics: ['0xtopic0', '0xtopic1'],
  data: '0xdeadbeef',
  reason: 'UNDECODABLE',
  errorMessage: 'no matching event',
  abiFingerprint: 'd'.repeat(64),
  eventName: null,
};

/** Apply the real migration file through the same `db.query` shim TypeORM uses. */
async function applyQuarantineMigration(pool) {
  await new IndexerQuarantineMigration().up({
    query: (sql, values) => runSql(pool, sql, values),
  });
}

/** Stand-in for what Subsquid commits in one transaction: entities + checkpoint. */
async function createProjectionFixtures(pool) {
  await runSql(pool, `CREATE SCHEMA squid_processor`);
  await runSql(
    pool,
    `CREATE TABLE squid_processor.status (id int primary key, height int not null, hash text not null, nonce int not null default 0)`,
  );
  await runSql(
    pool,
    `INSERT INTO squid_processor.status (id, height, hash) VALUES (0, 4241, '0xprev')`,
  );
  await runSql(pool, `CREATE TABLE trade (id text primary key)`);
}

const noopAlerts = { unresolvedQuarantineOnStartup: async () => {} };
const noopLogger = { error: () => {} };

test(
  'a quarantined log survives the batch rollback that holds the checkpoint',
  { timeout: 180000, skip: !dockerAvailable },
  async () => {
    await withPostgresContainer(async ({ port }) => {
      const adminPool = await createAdminPool(port);
      const quarantinePool = await createAdminPool(port);

      try {
        await applyQuarantineMigration(adminPool);
        await createProjectionFixtures(adminPool);

        const store = new QuarantineStore(quarantinePool);

        // The Subsquid batch transaction: entity write + checkpoint advance.
        const batch = await adminPool.connect();
        try {
          await batch.query('BEGIN');
          await batch.query(`INSERT INTO trade (id) VALUES ('trade-1')`);
          await batch.query(
            `UPDATE squid_processor.status SET height = 4242, hash = '0xnext' WHERE id = 0`,
          );

          // The poison-log response, on its own connection.
          await store.recordPoisonLog(ENTRY);

          // The halt: nothing from this batch is allowed to commit.
          await batch.query('ROLLBACK');
        } finally {
          batch.release();
        }

        const projection = await runSql(adminPool, `SELECT id FROM trade`);
        assert.equal(projection.rows.length, 0, 'the rolled-back projection must be gone');

        const checkpoint = await runSql(
          adminPool,
          `SELECT height, hash FROM squid_processor.status WHERE id = 0`,
        );
        assert.equal(checkpoint.rows[0].height, 4241, 'the checkpoint must not advance');
        assert.equal(checkpoint.rows[0].hash, '0xprev');

        const quarantined = await runSql(
          adminPool,
          `SELECT block_number::text AS block_number, topics, data, status, occurrences
           FROM indexer_quarantined_log`,
        );
        assert.equal(quarantined.rows.length, 1, 'the raw evidence must outlive the rollback');
        assert.equal(quarantined.rows[0].block_number, '4242');
        assert.deepEqual(quarantined.rows[0].topics, ENTRY.topics);
        assert.equal(quarantined.rows[0].data, '0xdeadbeef');
        assert.equal(quarantined.rows[0].status, 'UNRESOLVED');
        assert.equal(quarantined.rows[0].occurrences, 1);
      } finally {
        await quarantinePool.end();
        await adminPool.end();
      }
    });
  },
);

test(
  'the startup gate holds until an operator resolves the quarantined log',
  { timeout: 180000, skip: !dockerAvailable },
  async () => {
    await withPostgresContainer(async ({ port }) => {
      const pool = await createAdminPool(port);

      try {
        await applyQuarantineMigration(pool);
        const store = new QuarantineStore(pool);
        const gate = { quarantine: store, alerts: noopAlerts, logger: noopLogger };

        // Clean start.
        await assertNoUnresolvedQuarantine(gate);

        await store.recordPoisonLog(ENTRY);
        await assert.rejects(() => assertNoUnresolvedQuarantine(gate), UnresolvedQuarantineError);

        // The crash-loop restart re-touches one row rather than adding another.
        await store.recordPoisonLog(ENTRY);
        const afterRetry = await runSql(pool, `SELECT occurrences FROM indexer_quarantined_log`);
        assert.equal(afterRetry.rows.length, 1);
        assert.equal(afterRetry.rows[0].occurrences, 2);

        const listed = await store.listUnresolved();
        assert.equal(listed.length, 1);
        assert.equal(listed[0].blockNumber, '4242');
        assert.equal(listed[0].reason, 'UNDECODABLE');

        await store.resolve({
          blockNumber: ENTRY.blockNumber,
          txHash: ENTRY.txHash,
          logIndex: ENTRY.logIndex,
          note: 'ABI regenerated from the deployed contract',
        });

        assert.equal(await store.countUnresolved(), 0);
        await assertNoUnresolvedQuarantine(gate);

        // A recurrence after resolution reopens the hold.
        await store.recordPoisonLog(ENTRY);
        await assert.rejects(() => assertNoUnresolvedQuarantine(gate), UnresolvedQuarantineError);
        const reopened = await runSql(
          pool,
          `SELECT status, resolved_at, resolution_note FROM indexer_quarantined_log`,
        );
        assert.equal(reopened.rows[0].status, 'UNRESOLVED');
        assert.equal(reopened.rows[0].resolved_at, null);
        assert.equal(reopened.rows[0].resolution_note, null);
      } finally {
        await pool.end();
      }
    });
  },
);

test(
  'the migration refuses to drop unresolved quarantine evidence',
  { timeout: 180000, skip: !dockerAvailable },
  async () => {
    await withPostgresContainer(async ({ port }) => {
      const pool = await createAdminPool(port);
      const db = { query: (sql, values) => runSql(pool, sql, values) };

      try {
        await applyQuarantineMigration(pool);
        const store = new QuarantineStore(pool);
        await store.recordPoisonLog(ENTRY);

        await assert.rejects(
          () => new IndexerQuarantineMigration().down(db),
          /Refusing to drop indexer_quarantined_log while 1 quarantined log\(s\) are unresolved/,
        );

        await store.resolve({
          blockNumber: ENTRY.blockNumber,
          txHash: ENTRY.txHash,
          logIndex: ENTRY.logIndex,
          note: 'resolved for teardown',
        });
        await new IndexerQuarantineMigration().down(db);

        const table = await runSql(
          pool,
          `SELECT to_regclass('public.indexer_quarantined_log') AS t`,
        );
        assert.equal(table.rows[0].t, null);
      } finally {
        await pool.end();
      }
    });
  },
);
