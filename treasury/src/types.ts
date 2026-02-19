export type TreasuryComponent = 'LOGISTICS' | 'PLATFORM_FEE';

export type PayoutState =
  | 'PENDING_REVIEW'
  | 'READY_FOR_PAYOUT'
  | 'PROCESSING'
  | 'PAID'
  | 'CANCELLED';

export interface LedgerEntry {
  id: number;
  entry_key: string;
  trade_id: string;
  tx_hash: string;
  block_number: number;
  event_name: string;
  component_type: TreasuryComponent;
  amount_raw: string;
  source_timestamp: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface LedgerEntryWithState extends LedgerEntry {
  latest_state: PayoutState;
  latest_state_at: Date;
}

export interface PayoutLifecycleEvent {
  id: number;
  ledger_entry_id: number;
  state: PayoutState;
  note: string | null;
  actor: string | null;
  created_at: Date;
}

export interface IndexerTradeEvent {
  id: string;
  tradeId: string;
  eventName: string;
  txHash: string | null;
  extrinsicHash: string | null;
  blockNumber: number;
  timestamp: Date;
  releasedLogisticsAmount?: string | null;
  paidPlatformFees?: string | null;
}
