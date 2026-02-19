import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveEventHashes,
  assertNoExtrinsicFallbackAsTxHash,
  extractEvmTxHash,
} from '../lib/utils/eventHashes.js';

test('resolveEventHashes sets txHash and extrinsicHash for EVM transactions', () => {
  const payload = '0x1234';
  const extrinsic = {
    hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    call: {
      name: 'Revive.eth_transact',
      args: { payload },
    },
  };

  const hashes = resolveEventHashes(extrinsic);

  assert.equal(
    hashes.txHash,
    '0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432',
  );
  assert.equal(hashes.extrinsicHash, extrinsic.hash);
});

test('resolveEventHashes keeps txHash null when EVM payload is unavailable', () => {
  const extrinsic = {
    hash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    call: {
      name: 'Balances.transfer',
    },
  };

  const hashes = resolveEventHashes(extrinsic);

  assert.equal(hashes.txHash, null);
  assert.equal(hashes.extrinsicHash, extrinsic.hash);
});

test('resolveEventHashes ignores placeholder extrinsic hash values', () => {
  const hashes = resolveEventHashes({ hash: 'unknown' });

  assert.equal(hashes.txHash, null);
  assert.equal(hashes.extrinsicHash, null);
});

test('extractEvmTxHash returns null for malformed extrinsics', () => {
  assert.equal(extractEvmTxHash({ call: { name: 'Revive.eth_transact' } }), null);
});

test('guardrail rejects assigning extrinsic hash into txHash', () => {
  assert.throws(
    () =>
      assertNoExtrinsicFallbackAsTxHash({
        txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        extrinsicHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      }),
    /Invariant violation/,
  );
});
