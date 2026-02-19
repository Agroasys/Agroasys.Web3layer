import { keccak256 } from 'ethers';

export interface EventHashResolution {
  txHash: string | null;
  extrinsicHash: string | null;
}

export function extractEvmTxHash(extrinsic: unknown): string | null {
  try {
    const candidate = extrinsic as { call?: { name?: string; args?: { payload?: string } } };

    if (candidate?.call?.name === 'Revive.eth_transact') {
      const payload = candidate.call.args?.payload;
      if (payload) {
        return keccak256(payload);
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function resolveEventHashes(extrinsic: unknown): EventHashResolution {
  const txHash = extractEvmTxHash(extrinsic);
  const extrinsicHashCandidate = (extrinsic as { hash?: string })?.hash;
  const extrinsicHash = extrinsicHashCandidate && extrinsicHashCandidate !== 'unknown' ? extrinsicHashCandidate : null;

  return {
    txHash,
    extrinsicHash,
  };
}

export function assertNoExtrinsicFallbackAsTxHash(eventHashes: EventHashResolution): void {
  if (eventHashes.txHash && eventHashes.extrinsicHash && eventHashes.txHash === eventHashes.extrinsicHash) {
    throw new Error('Invariant violation: extrinsic hash must not be stored as txHash');
  }
}
