import { TradeStatus, type Trade } from '@agroasys/sdk';
import type { CompareInput, DriftFinding } from '../types';

function statusLabel(status: TradeStatus): string {
  switch (status) {
    case TradeStatus.LOCKED:
      return 'LOCKED';
    case TradeStatus.IN_TRANSIT:
      return 'IN_TRANSIT';
    case TradeStatus.ARRIVAL_CONFIRMED:
      return 'ARRIVAL_CONFIRMED';
    case TradeStatus.FROZEN:
      return 'FROZEN';
    case TradeStatus.CLOSED:
      return 'CLOSED';
    default:
      return `UNKNOWN_${status}`;
  }
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function bigintToString(value: bigint): string {
  return value.toString();
}

function isZeroAddress(address: string): boolean {
  return normalizeAddress(address) === '0x0000000000000000000000000000000000000000';
}

function compareAmounts(indexed: CompareInput['indexedTrade'], onchain: Trade): DriftFinding[] {
  const mismatches: DriftFinding[] = [];

  const amountFields: Array<{
    field: keyof Pick<Trade, 'totalAmountLocked' | 'logisticsAmount' | 'platformFeesAmount' | 'supplierFirstTranche' | 'supplierSecondTranche'>;
    indexedValue: bigint;
  }> = [
    { field: 'totalAmountLocked', indexedValue: indexed.totalAmountLocked },
    { field: 'logisticsAmount', indexedValue: indexed.logisticsAmount },
    { field: 'platformFeesAmount', indexedValue: indexed.platformFeesAmount },
    { field: 'supplierFirstTranche', indexedValue: indexed.supplierFirstTranche },
    { field: 'supplierSecondTranche', indexedValue: indexed.supplierSecondTranche },
  ];

  for (const field of amountFields) {
    const onchainValue = onchain[field.field];
    if (onchainValue !== field.indexedValue) {
      mismatches.push({
        tradeId: indexed.tradeId,
        severity: 'CRITICAL',
        mismatchCode: 'AMOUNT_MISMATCH',
        onchainValue: bigintToString(onchainValue),
        indexedValue: bigintToString(field.indexedValue),
        details: {
          field: field.field,
          impact: 'financial',
        },
      });
    }
  }

  return mismatches;
}

export function classifyDrifts(input: CompareInput): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const { indexedTrade, onchainTrade, onchainReadError } = input;

  if (onchainReadError) {
    return [
      {
        tradeId: indexedTrade.tradeId,
        severity: 'CRITICAL',
        mismatchCode: 'ONCHAIN_READ_ERROR',
        onchainValue: null,
        indexedValue: indexedTrade.status,
        details: {
          error: onchainReadError,
        },
      },
    ];
  }

  if (!onchainTrade || isZeroAddress(onchainTrade.buyer)) {
    return [
      {
        tradeId: indexedTrade.tradeId,
        severity: 'CRITICAL',
        mismatchCode: 'ONCHAIN_TRADE_MISSING',
        onchainValue: null,
        indexedValue: indexedTrade.tradeId,
        details: {
          reason: 'trade not found on-chain',
        },
      },
    ];
  }

  const onchainStatus = statusLabel(onchainTrade.status);
  if (onchainStatus !== indexedTrade.status) {
    findings.push({
      tradeId: indexedTrade.tradeId,
      severity: 'HIGH',
      mismatchCode: 'STATUS_MISMATCH',
      onchainValue: onchainStatus,
      indexedValue: indexedTrade.status,
      details: {
        impact: 'workflow divergence',
      },
    });
  }

  if (normalizeAddress(onchainTrade.buyer) !== normalizeAddress(indexedTrade.buyer)) {
    findings.push({
      tradeId: indexedTrade.tradeId,
      severity: 'CRITICAL',
      mismatchCode: 'PARTICIPANT_MISMATCH',
      onchainValue: onchainTrade.buyer,
      indexedValue: indexedTrade.buyer,
      details: {
        field: 'buyer',
      },
    });
  }

  if (normalizeAddress(onchainTrade.supplier) !== normalizeAddress(indexedTrade.supplier)) {
    findings.push({
      tradeId: indexedTrade.tradeId,
      severity: 'CRITICAL',
      mismatchCode: 'PARTICIPANT_MISMATCH',
      onchainValue: onchainTrade.supplier,
      indexedValue: indexedTrade.supplier,
      details: {
        field: 'supplier',
      },
    });
  }

  findings.push(...compareAmounts(indexedTrade, onchainTrade));

  if (onchainTrade.ricardianHash.toLowerCase() !== indexedTrade.ricardianHash.toLowerCase()) {
    findings.push({
      tradeId: indexedTrade.tradeId,
      severity: 'CRITICAL',
      mismatchCode: 'HASH_MISMATCH',
      onchainValue: onchainTrade.ricardianHash,
      indexedValue: indexedTrade.ricardianHash,
      details: {
        impact: 'legal linkage divergence',
      },
    });
  }

  const onchainArrivalIso = onchainTrade.arrivalTimestamp ? onchainTrade.arrivalTimestamp.toISOString() : null;
  const indexedArrivalIso = indexedTrade.arrivalTimestamp ? indexedTrade.arrivalTimestamp.toISOString() : null;

  if (onchainArrivalIso !== indexedArrivalIso) {
    findings.push({
      tradeId: indexedTrade.tradeId,
      severity: 'MEDIUM',
      mismatchCode: 'ARRIVAL_TIMESTAMP_MISMATCH',
      onchainValue: onchainArrivalIso,
      indexedValue: indexedArrivalIso,
      details: {
        impact: 'timeline divergence',
      },
    });
  }

  return findings;
}
