import { config } from '../config';
import { IndexerClient } from '../indexer/client';
import { appendPayoutState, insertLedgerEntry } from '../database/queries';
import { Logger } from '../utils/logger';

function buildEntryKey(eventId: string, component: 'LOGISTICS' | 'PLATFORM_FEE'): string {
  return `${eventId}:${component.toLowerCase()}`;
}

export class TreasuryIngestionService {
  private readonly indexerClient = new IndexerClient(config.indexerGraphqlUrl);

  async ingestOnce(): Promise<{ fetched: number; inserted: number }> {
    let offset = 0;
    let fetched = 0;
    let inserted = 0;

    while (fetched < config.ingestMaxEvents) {
      const remaining = config.ingestMaxEvents - fetched;
      const limit = Math.min(config.ingestBatchSize, remaining);

      const events = await this.indexerClient.fetchTreasuryEvents(limit, offset);
      if (events.length === 0) {
        break;
      }

      for (const event of events) {
        fetched += 1;

        if (event.eventName === 'FundsReleasedStage1' && event.releasedLogisticsAmount) {
          const entry = await insertLedgerEntry({
            entryKey: buildEntryKey(event.id, 'LOGISTICS'),
            tradeId: event.tradeId,
            txHash: event.txHash,
            blockNumber: event.blockNumber,
            eventName: event.eventName,
            componentType: 'LOGISTICS',
            amountRaw: event.releasedLogisticsAmount,
            sourceTimestamp: event.timestamp,
            metadata: { sourceEventId: event.id },
          });

          if (entry) {
            await appendPayoutState({
              ledgerEntryId: entry.id,
              state: 'PENDING_REVIEW',
              note: 'Auto-created from indexer ingestion',
              actor: 'system:indexer-ingest',
            });
            inserted += 1;
          }
        }

        if (event.eventName === 'PlatformFeesPaidStage1' && event.paidPlatformFees) {
          const entry = await insertLedgerEntry({
            entryKey: buildEntryKey(event.id, 'PLATFORM_FEE'),
            tradeId: event.tradeId,
            txHash: event.txHash,
            blockNumber: event.blockNumber,
            eventName: event.eventName,
            componentType: 'PLATFORM_FEE',
            amountRaw: event.paidPlatformFees,
            sourceTimestamp: event.timestamp,
            metadata: { sourceEventId: event.id },
          });

          if (entry) {
            await appendPayoutState({
              ledgerEntryId: entry.id,
              state: 'PENDING_REVIEW',
              note: 'Auto-created from indexer ingestion',
              actor: 'system:indexer-ingest',
            });
            inserted += 1;
          }
        }
      }

      offset += events.length;
      if (events.length < limit) {
        break;
      }
    }

    Logger.info('Treasury ingestion run completed', { fetched, inserted });

    return { fetched, inserted };
  }
}
