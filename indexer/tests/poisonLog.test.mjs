import assert from 'node:assert/strict';
import test from 'node:test';

import { buildQuarantinedLogEntry, haltOnPoisonLog, PoisonLogHaltError } from '../lib/poisonLog.js';

const RAW_LOG = {
  address: '0xAbCdEf0000000000000000000000000000000001',
  topics: [
    '0x1111111111111111111111111111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222222222222222222222222222',
  ],
  data: '0xdeadbeef',
  logIndex: 7,
  transactionIndex: 3,
};

function poisonInput(overrides = {}) {
  return {
    reason: 'UNDECODABLE',
    error: new Error('no matching event'),
    abiFingerprint: 'a'.repeat(64),
    blockNumber: 4242,
    blockHash: '0xblock',
    txHash: '0xtx',
    log: RAW_LOG,
    ...overrides,
  };
}

function recordingDeps({ recordError = null, alertError = null } = {}) {
  const recorded = [];
  const alerted = [];
  const logged = [];
  return {
    recorded,
    alerted,
    logged,
    deps: {
      quarantine: {
        async recordPoisonLog(entry) {
          recorded.push(entry);
          if (recordError) throw recordError;
        },
      },
      alerts: {
        async poisonLogDetected(entry) {
          alerted.push(entry);
          if (alertError) throw alertError;
        },
      },
      logger: {
        error(message, meta) {
          logged.push({ message, meta });
        },
      },
    },
  };
}

test('quarantine entry preserves the complete raw log', () => {
  const entry = buildQuarantinedLogEntry(poisonInput());

  assert.equal(entry.blockNumber, 4242);
  assert.equal(entry.blockHash, '0xblock');
  assert.equal(entry.txHash, '0xtx');
  assert.equal(entry.logIndex, 7);
  assert.equal(entry.transactionIndex, 3);
  assert.deepEqual(entry.topics, RAW_LOG.topics);
  assert.equal(entry.data, '0xdeadbeef');
  assert.equal(entry.reason, 'UNDECODABLE');
  assert.equal(entry.errorMessage, 'no matching event');
  assert.equal(entry.abiFingerprint, 'a'.repeat(64));
  assert.equal(entry.eventName, null);
  // Normalized so it compares against the configured contract address.
  assert.equal(entry.contractAddress, RAW_LOG.address.toLowerCase());
});

test('quarantine entry copies topics rather than aliasing the chain log', () => {
  const topics = [...RAW_LOG.topics];
  const entry = buildQuarantinedLogEntry(poisonInput({ log: { ...RAW_LOG, topics } }));
  topics.push('0xmutated');

  assert.equal(entry.topics.length, 2);
});

test('a poison log is quarantined, alerted, and halts the batch', async () => {
  const { deps, recorded, alerted } = recordingDeps();

  const error = await assert.rejects(
    () =>
      haltOnPoisonLog(deps, poisonInput({ reason: 'HANDLER_FAILURE', eventName: 'TradeLocked' })),
    PoisonLogHaltError,
  );

  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].reason, 'HANDLER_FAILURE');
  assert.equal(recorded[0].eventName, 'TradeLocked');
  assert.equal(alerted.length, 1);
  assert.deepEqual(alerted[0], recorded[0]);
  assert.equal(error, undefined);
});

test('the halt carries the entry so the caller can report the held block', async () => {
  const { deps } = recordingDeps();

  await assert.rejects(
    () => haltOnPoisonLog(deps, poisonInput()),
    (error) => {
      assert.ok(error instanceof PoisonLogHaltError);
      assert.equal(error.entry.blockNumber, 4242);
      assert.match(error.message, /block 4242/);
      assert.match(error.message, /log index 7/);
      return true;
    },
  );
});

test('a failed quarantine write still halts the batch', async () => {
  const { deps, logged } = recordingDeps({ recordError: new Error('database down') });

  await assert.rejects(() => haltOnPoisonLog(deps, poisonInput()), PoisonLogHaltError);
  assert.ok(
    logged.some((entry) => entry.message.includes('Failed to durably quarantine')),
    'the lost evidence must be reported',
  );
});

test('a failed alert still halts the batch', async () => {
  const { deps, recorded, logged } = recordingDeps({ alertError: new Error('webhook down') });

  await assert.rejects(() => haltOnPoisonLog(deps, poisonInput()), PoisonLogHaltError);
  assert.equal(recorded.length, 1);
  assert.ok(logged.some((entry) => entry.message.includes('Failed to raise poison-log alert')));
});

test('non-Error causes are still described', () => {
  const entry = buildQuarantinedLogEntry(poisonInput({ error: 'plain string failure' }));
  assert.equal(entry.errorMessage, 'plain string failure');
});
