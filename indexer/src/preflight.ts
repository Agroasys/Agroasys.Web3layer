import { createHash } from 'node:crypto';
import { keccak256 } from 'ethers';
import { ESCROW_EVENT_SIGNATURES } from './eventTopics';
import { callRpc, redactRpcUrlForLogs } from './rpc-preflight';

const DEFAULT_TIMEOUT_MS = 3000;
const EMPTY_CODE = '0x';

/**
 * Identity of the event set this build can decode. It changes whenever an
 * event is added, removed, or its signature changes, which is precisely the
 * drift that turns previously-decodable logs into poison logs.
 */
export const ESCROW_ABI_FINGERPRINT = createHash('sha256')
  .update(ESCROW_EVENT_SIGNATURES.join('\n'))
  .digest('hex');

export class ContractPreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractPreflightError';
  }
}

export interface ContractPreflightInput {
  rpcUrl: string;
  contractAddress: string;
  startBlock: number;
  timeoutMs?: number;
  expectedCodehash?: string | null;
  expectedAbiFingerprint?: string | null;
  /** Historical `eth_getCode`; disable for non-archive endpoints. */
  verifyStartBlockCode?: boolean;
  abiFingerprint?: string;
}

export interface ContractPreflightLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface ContractPreflightResult {
  codehash: string;
  abiFingerprint: string;
  startBlockVerified: boolean;
}

function assertHexString(value: unknown, method: string): string {
  if (typeof value !== 'string' || !value.startsWith('0x')) {
    throw new ContractPreflightError(`Invalid ${method} result`);
  }
  return value;
}

/**
 * Refuse to start against an address, chain history, or ABI the build cannot
 * account for. Every failure throws: an indexer that starts against the wrong
 * contract silently produces a plausible but wrong projection.
 */
export async function assertContractPreflight(
  input: ContractPreflightInput,
  logger?: ContractPreflightLogger,
): Promise<ContractPreflightResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const abiFingerprint = input.abiFingerprint ?? ESCROW_ABI_FINGERPRINT;
  const address = input.contractAddress.toLowerCase();

  if (input.expectedAbiFingerprint && input.expectedAbiFingerprint !== abiFingerprint) {
    throw new ContractPreflightError(
      `Escrow ABI fingerprint drift: expected ${input.expectedAbiFingerprint}, built ${abiFingerprint}`,
    );
  }

  const headResult = assertHexString(
    await callRpc(input.rpcUrl, 'eth_blockNumber', [], timeoutMs),
    'eth_blockNumber',
  );
  const head = BigInt(headResult);
  if (BigInt(input.startBlock) > head) {
    throw new ContractPreflightError(
      `START_BLOCK ${input.startBlock} is ahead of chain head ${head.toString()} on ${redactRpcUrlForLogs(input.rpcUrl)}`,
    );
  }

  const latestCode = assertHexString(
    await callRpc(input.rpcUrl, 'eth_getCode', [address, 'latest'], timeoutMs),
    'eth_getCode',
  );
  if (latestCode === EMPTY_CODE) {
    throw new ContractPreflightError(`No contract code at ${address} on the configured chain`);
  }

  const codehash = keccak256(latestCode);
  if (input.expectedCodehash && input.expectedCodehash.toLowerCase() !== codehash.toLowerCase()) {
    throw new ContractPreflightError(
      `Contract codehash mismatch at ${address}: expected ${input.expectedCodehash}, found ${codehash}`,
    );
  }

  let startBlockVerified = false;
  if (input.verifyStartBlockCode !== false) {
    const startBlockTag = `0x${BigInt(input.startBlock).toString(16)}`;
    let startBlockCode: string;
    try {
      startBlockCode = assertHexString(
        await callRpc(input.rpcUrl, 'eth_getCode', [address, startBlockTag], timeoutMs),
        'eth_getCode',
      );
    } catch (error) {
      // A pruned or non-archive endpoint cannot answer this at all. That is a
      // gap in verification, not evidence of a bad start block, so warn rather
      // than block startup. An endpoint that *does* answer is trusted below.
      logger?.warn('Could not verify contract code at START_BLOCK', {
        rpcUrl: redactRpcUrlForLogs(input.rpcUrl),
        startBlock: input.startBlock,
        error: error instanceof Error ? error.message : String(error),
      });
      return { codehash, abiFingerprint, startBlockVerified };
    }

    if (startBlockCode === EMPTY_CODE) {
      throw new ContractPreflightError(
        `No contract code at ${address} at START_BLOCK ${input.startBlock}; the indexer would skip its own deployment history`,
      );
    }
    startBlockVerified = true;
  }

  return { codehash, abiFingerprint, startBlockVerified };
}

export interface QuarantineGateDeps {
  quarantine: { countUnresolved(): Promise<number> };
  alerts: { unresolvedQuarantineOnStartup(count: number): Promise<void> };
  logger: { error(message: string, meta?: Record<string, unknown>): void };
}

export class UnresolvedQuarantineError extends Error {
  readonly unresolvedCount: number;

  constructor(unresolvedCount: number) {
    super(
      `Indexer startup blocked: ${unresolvedCount} quarantined escrow log(s) are unresolved. Correct the cause, resolve the rows, rewind, and replay before restarting.`,
    );
    this.name = 'UnresolvedQuarantineError';
    this.unresolvedCount = unresolvedCount;
  }
}

/** Keep the checkpoint held across restarts until an operator clears the cause. */
export async function assertNoUnresolvedQuarantine(deps: QuarantineGateDeps): Promise<void> {
  const unresolvedCount = await deps.quarantine.countUnresolved();
  if (unresolvedCount === 0) {
    return;
  }

  deps.logger.error('Refusing to start with unresolved quarantined escrow logs', {
    unresolvedCount,
  });

  try {
    await deps.alerts.unresolvedQuarantineOnStartup(unresolvedCount);
  } catch {
    // Alert delivery must never soften the gate.
  }

  throw new UnresolvedQuarantineError(unresolvedCount);
}
