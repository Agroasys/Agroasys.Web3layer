'use strict';

/**
 * Operator CLI for the indexer poison-log control.
 *
 * A quarantined log holds the checkpoint: the pipeline refuses to start while
 * any row is UNRESOLVED. This tool is the explicit, audited way to inspect the
 * held evidence and release the hold once the ABI, ordering, or handler cause
 * has actually been corrected. See
 * docs/runbooks/indexer-poison-log-recovery.md.
 */

const { createServicePool, parsePostgresSslMode } = require('@agroasys/shared-db');

const STATUS_SCHEMA = 'squid_processor';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function nonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument ${token}`);
    }
    const key = token.slice(2);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Option --${key} requires a value`);
    }
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

function loadStore() {
  let quarantineModule;
  try {
    quarantineModule = require('./lib/quarantine');
  } catch {
    throw new Error('indexer is not built; run "pnpm --filter indexer run build" first');
  }
  return quarantineModule;
}

function createPool() {
  const password = process.env.DB_PASSWORD?.trim() || requiredEnv('DB_PASS');
  return createServicePool({
    serviceName: 'indexer',
    connectionRole: 'runtime',
    host: requiredEnv('DB_HOST'),
    port: positiveInteger(requiredEnv('DB_PORT'), 'DB_PORT'),
    database: requiredEnv('DB_NAME'),
    user: requiredEnv('DB_USER'),
    password,
    sslMode: parsePostgresSslMode(process.env.DB_SSL_MODE),
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });
}

async function listCommand(store, options) {
  const limit = options.limit ? positiveInteger(options.limit, '--limit') : 100;
  const rows = await store.listUnresolved(limit);
  process.stdout.write(`${JSON.stringify({ unresolved: rows.length, rows }, null, 2)}\n`);
}

async function resolveCommand(store, options) {
  const blockNumber = nonNegativeInteger(options.block, '--block');
  const logIndex = nonNegativeInteger(options['log-index'], '--log-index');
  const txHash = options.tx ?? '';
  const note = options.note?.trim();
  if (!note) {
    throw new Error('--note is required and must record why the cause is corrected');
  }

  await store.resolve({ blockNumber, txHash, logIndex, note });
  process.stdout.write(
    `${JSON.stringify({ resolved: { blockNumber, txHash, logIndex, note } })}\n`,
  );
}

/**
 * Move the finalized checkpoint back so the next start re-derives the range.
 *
 * The hash sentinel '0x' is the runner's supported "resume without chain
 * continuity proof" marker; it logs a warning and continues, which is correct
 * here because we only ever rewind to a finalized height. Hot-block bookkeeping
 * is cleared because it describes blocks above the rewound head.
 */
async function rewindCommand(pool, options) {
  const target = nonNegativeInteger(options.block, '--block');
  const resumeFrom = target - 1;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${STATUS_SCHEMA}.hot_change_log`);
    await client.query(`DELETE FROM ${STATUS_SCHEMA}.hot_block`);
    const result = await client.query(
      `UPDATE ${STATUS_SCHEMA}.status
       SET height = $1, hash = '0x', nonce = nonce + 1
       WHERE id = 0`,
      [resumeFrom],
    );
    if (result.rowCount !== 1) {
      throw new Error('squid_processor.status has no row 0; the indexer has never run');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  process.stdout.write(`${JSON.stringify({ rewound: { replayFromBlock: target } })}\n`);
}

const USAGE = `Usage:
  node quarantine.js list [--limit N]
  node quarantine.js resolve --block N --tx 0x... --log-index N --note "why"
  node quarantine.js rewind --block N
`;

async function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArgs(argv);
  if (!command || command === 'help') {
    process.stdout.write(USAGE);
    return;
  }

  const pool = createPool();
  try {
    if (command === 'rewind') {
      await rewindCommand(pool, options);
      return;
    }

    const { QuarantineStore } = loadStore();
    const store = new QuarantineStore(pool);
    if (command === 'list') {
      await listCommand(store, options);
      return;
    }
    if (command === 'resolve') {
      await resolveCommand(store, options);
      return;
    }
    throw new Error(`Unknown command ${command}\n${USAGE}`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `Indexer quarantine command failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs, nonNegativeInteger, positiveInteger };
