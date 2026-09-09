import { WebhookNotifier } from '@agroasys/notifications';
import type { QuarantinedLogEntry } from './quarantine';

export interface IndexerAlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  cooldownMs: number;
  requestTimeoutMs?: number;
}

export interface IndexerAlertLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface IndexerAlerts {
  poisonLogDetected(entry: QuarantinedLogEntry): Promise<void>;
  unresolvedQuarantineOnStartup(count: number): Promise<void>;
}

/**
 * Critical routing for the poison-log control. The payload carries the log
 * coordinates an operator needs to find the quarantined row, and never the raw
 * `data` payload or RPC credentials.
 */
export class WebhookIndexerAlerts implements IndexerAlerts {
  private readonly notifier: WebhookNotifier;

  constructor(config: IndexerAlertConfig, logger?: IndexerAlertLogger) {
    this.notifier = new WebhookNotifier({
      enabled: config.enabled,
      webhookUrl: config.webhookUrl,
      cooldownMs: config.cooldownMs,
      requestTimeoutMs: config.requestTimeoutMs,
      logger,
    });
  }

  async poisonLogDetected(entry: QuarantinedLogEntry): Promise<void> {
    await this.notifier.notify({
      source: 'indexer',
      type: 'INDEXER_POISON_LOG',
      severity: 'critical',
      dedupKey: `indexer:poison:${entry.txHash}:${entry.logIndex}`,
      message:
        'Indexer quarantined an unprojectable escrow log and held the checkpoint. Settlement projection is stale until the cause is corrected and the range is replayed.',
      correlation: {
        txHash: entry.txHash,
      },
      metadata: {
        reason: entry.reason,
        blockNumber: entry.blockNumber,
        logIndex: entry.logIndex,
        contractAddress: entry.contractAddress,
        eventName: entry.eventName,
        abiFingerprint: entry.abiFingerprint,
        errorMessage: entry.errorMessage,
      },
    });
  }

  async unresolvedQuarantineOnStartup(count: number): Promise<void> {
    await this.notifier.notify({
      source: 'indexer',
      type: 'INDEXER_POISON_LOG',
      severity: 'critical',
      dedupKey: 'indexer:poison:startup-blocked',
      message:
        'Indexer startup blocked: quarantined escrow logs are unresolved, so the checkpoint stays held.',
      correlation: {},
      metadata: {
        unresolvedCount: count,
      },
    });
  }
}
