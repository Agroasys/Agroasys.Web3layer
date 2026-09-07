import assert from 'node:assert/strict';
import test from 'node:test';

import { QuarantineStore } from '../lib/quarantine.js';

function fakeExecutor(responses = []) {
  const calls = [];
  let index = 0;
  return {
    calls,
    query(text, values) {
      calls.push({ text, values });
      const response = responses[index] ?? { rows: [] };
      index += 1;
      return Promise.resolve(response);
    },
  };
}

const ENTRY = {
  blockNumber: 991,
  blockHash: '0xblock',
  txHash: '0xtx',
  logIndex: 2,
  transactionIndex: 1,
  contractAddress: '0xcontract',
  topics: ['0xtopic0'],
  data: '0xdata',
  reason: 'UNDECODABLE',
  errorMessage: 'boom',
  abiFingerprint: 'b'.repeat(64),
  eventName: null,
};

test('recording a poison log writes every raw field', async () => {
  const executor = fakeExecutor();
  await new QuarantineStore(executor).recordPoisonLog(ENTRY);

  assert.equal(executor.calls.length, 1);
  assert.deepEqual(executor.calls[0].values, [
    991,
    '0xblock',
    '0xtx',
    2,
    1,
    '0xcontract',
    ['0xtopic0'],
    '0xdata',
    'UNDECODABLE',
    'boom',
    'b'.repeat(64),
    null,
  ]);
});

test('recording is idempotent on the block, tx, and log index identity', async () => {
  const executor = fakeExecutor();
  await new QuarantineStore(executor).recordPoisonLog(ENTRY);
  const { text } = executor.calls[0];

  assert.match(text, /ON CONFLICT \("?block_number"?, "?tx_hash"?, "?log_index"?\) DO UPDATE/);
  assert.match(text, /occurrences = indexer_quarantined_log\.occurrences \+ 1/);
});

test('a recurrence reopens a row an operator had resolved', async () => {
  const executor = fakeExecutor();
  await new QuarantineStore(executor).recordPoisonLog(ENTRY);
  const { text } = executor.calls[0];

  assert.match(text, /status = 'UNRESOLVED'/);
  assert.match(text, /resolved_at = NULL/);
  assert.match(text, /resolution_note = NULL/);
});

test('unresolved count drives the startup gate', async () => {
  const executor = fakeExecutor([{ rows: [{ count: 3 }] }]);
  assert.equal(await new QuarantineStore(executor).countUnresolved(), 3);

  const empty = fakeExecutor([{ rows: [{ count: 0 }] }]);
  assert.equal(await new QuarantineStore(empty).countUnresolved(), 0);
});

test('a bigint count returned as text is still numeric', async () => {
  const executor = fakeExecutor([{ rows: [{ count: '7' }] }]);
  assert.equal(await new QuarantineStore(executor).countUnresolved(), 7);
});

test('an empty result set counts as zero rather than NaN', async () => {
  const executor = fakeExecutor([{ rows: [] }]);
  assert.equal(await new QuarantineStore(executor).countUnresolved(), 0);
});

test('listing unresolved rows exposes the operator triage fields', async () => {
  const executor = fakeExecutor([
    {
      rows: [
        {
          block_number: '991',
          tx_hash: '0xtx',
          log_index: 2,
          reason: 'HANDLER_FAILURE',
          error_message: 'boom',
          event_name: 'TradeLocked',
          occurrences: 4,
          first_seen_at: '2026-09-07T00:00:00Z',
          last_seen_at: '2026-09-07T01:00:00Z',
        },
      ],
    },
  ]);

  const rows = await new QuarantineStore(executor).listUnresolved(25);

  assert.equal(executor.calls[0].values[0], 25);
  assert.deepEqual(rows, [
    {
      blockNumber: '991',
      txHash: '0xtx',
      logIndex: 2,
      reason: 'HANDLER_FAILURE',
      errorMessage: 'boom',
      eventName: 'TradeLocked',
      occurrences: 4,
      firstSeenAt: '2026-09-07T00:00:00Z',
      lastSeenAt: '2026-09-07T01:00:00Z',
    },
  ]);
});

test('resolving requires the full log identity and records the note', async () => {
  const executor = fakeExecutor();
  await new QuarantineStore(executor).resolve({
    blockNumber: 991,
    txHash: '0xtx',
    logIndex: 2,
    note: 'ABI regenerated from the deployed contract',
  });

  assert.deepEqual(executor.calls[0].values, [
    991,
    '0xtx',
    2,
    'ABI regenerated from the deployed contract',
  ]);
  assert.match(executor.calls[0].text, /status = 'RESOLVED'/);
  assert.match(executor.calls[0].text, /AND status = 'UNRESOLVED'/);
});
