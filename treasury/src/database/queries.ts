import { pool } from './connection';
import { LedgerEntry, LedgerEntryWithState, PayoutLifecycleEvent, PayoutState, TreasuryComponent } from '../types';
import { createPostgresNonceStore } from '@agroasys/shared-auth';

const INGESTION_CURSOR_NAME = 'trade_events';
const serviceAuthNonceStore = createPostgresNonceStore({
  tableName: 'treasury_auth_nonces',
  query: (sql, params) => pool.query(sql, params),
});

export async function getIngestionOffset(cursorName: string = INGESTION_CURSOR_NAME): Promise<number> {
  const result = await pool.query<{ next_offset: number }>(
    `SELECT next_offset
     FROM treasury_ingestion_state
     WHERE cursor_name = $1`,
    [cursorName]
  );

  if (result.rows[0]) {
    return Number(result.rows[0].next_offset);
  }

  await pool.query(
    `INSERT INTO treasury_ingestion_state (cursor_name, next_offset)
     VALUES ($1, 0)
     ON CONFLICT (cursor_name) DO NOTHING`,
    [cursorName]
  );

  return 0;
}

export async function setIngestionOffset(nextOffset: number, cursorName: string = INGESTION_CURSOR_NAME): Promise<void> {
  await pool.query(
    `INSERT INTO treasury_ingestion_state (cursor_name, next_offset, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (cursor_name)
     DO UPDATE SET
       next_offset = EXCLUDED.next_offset,
       updated_at = NOW()`,
    [cursorName, nextOffset]
  );
}

export async function consumeServiceAuthNonce(apiKey: string, nonce: string, ttlSeconds: number): Promise<boolean> {
  return serviceAuthNonceStore.consume(apiKey, nonce, ttlSeconds);
}

export async function upsertLedgerEntryWithInitialState(data: {
  entryKey: string;
  tradeId: string;
  txHash: string;
  blockNumber: number;
  eventName: string;
  componentType: TreasuryComponent;
  amountRaw: string;
  sourceTimestamp: Date;
  metadata: Record<string, unknown>;
  initialStateNote?: string;
  initialStateActor?: string;
}): Promise<{ entry: LedgerEntry; initialStateCreated: boolean }> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const entryResult = await client.query<LedgerEntry>(
      `INSERT INTO treasury_ledger_entries (
          entry_key,
          trade_id,
          tx_hash,
          block_number,
          event_name,
          component_type,
          amount_raw,
          source_timestamp,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (entry_key)
        DO UPDATE SET
          trade_id = EXCLUDED.trade_id,
          tx_hash = EXCLUDED.tx_hash,
          block_number = EXCLUDED.block_number,
          event_name = EXCLUDED.event_name,
          component_type = EXCLUDED.component_type,
          amount_raw = EXCLUDED.amount_raw,
          source_timestamp = EXCLUDED.source_timestamp,
          metadata = EXCLUDED.metadata
        RETURNING *`,
      [
        data.entryKey,
        data.tradeId,
        data.txHash,
        data.blockNumber,
        data.eventName,
        data.componentType,
        data.amountRaw,
        data.sourceTimestamp,
        JSON.stringify(data.metadata),
      ]
    );

    const entry = entryResult.rows[0];

    const initialStateResult = await client.query(
      `INSERT INTO payout_lifecycle_events (
          ledger_entry_id,
          state,
          note,
          actor
        )
        SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (
          SELECT 1
          FROM payout_lifecycle_events
          WHERE ledger_entry_id = $1
        )`,
      [
        entry.id,
        'PENDING_REVIEW',
        data.initialStateNote || 'Auto-created from indexer ingestion',
        data.initialStateActor || 'system:indexer-ingest',
      ]
    );

    await client.query('COMMIT');

    return {
      entry,
      initialStateCreated: (initialStateResult.rowCount ?? 0) > 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function appendPayoutState(data: {
  ledgerEntryId: number;
  state: PayoutState;
  note?: string;
  actor?: string;
}): Promise<PayoutLifecycleEvent> {
  const result = await pool.query<PayoutLifecycleEvent>(
    `INSERT INTO payout_lifecycle_events (
      ledger_entry_id,
      state,
      note,
      actor
    ) VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [data.ledgerEntryId, data.state, data.note || null, data.actor || null]
  );

  return result.rows[0];
}

export async function getLatestPayoutState(ledgerEntryId: number): Promise<PayoutLifecycleEvent | null> {
  const result = await pool.query<PayoutLifecycleEvent>(
    `SELECT *
     FROM payout_lifecycle_events
     WHERE ledger_entry_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [ledgerEntryId]
  );

  return result.rows[0] || null;
}

export async function getLedgerEntries(params: {
  tradeId?: string;
  state?: PayoutState;
  limit: number;
  offset: number;
}): Promise<LedgerEntryWithState[]> {
  const values: Array<string | number> = [];
  const filters: string[] = [];

  if (params.tradeId) {
    values.push(params.tradeId);
    filters.push(`e.trade_id = $${values.length}`);
  }

  if (params.state) {
    values.push(params.state);
    filters.push(`s.state = $${values.length}`);
  }

  values.push(params.limit);
  const limitParam = `$${values.length}`;

  values.push(params.offset);
  const offsetParam = `$${values.length}`;

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const result = await pool.query<LedgerEntryWithState>(
    `SELECT
        e.*,
        s.state AS latest_state,
        s.created_at AS latest_state_at
      FROM treasury_ledger_entries e
      JOIN LATERAL (
        SELECT p.state, p.created_at
        FROM payout_lifecycle_events p
        WHERE p.ledger_entry_id = e.id
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 1
      ) s ON TRUE
      ${whereClause}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values
  );

  return result.rows;
}

export async function getLedgerEntryById(entryId: number): Promise<LedgerEntry | null> {
  const result = await pool.query<LedgerEntry>(
    'SELECT * FROM treasury_ledger_entries WHERE id = $1',
    [entryId]
  );

  return result.rows[0] || null;
}
