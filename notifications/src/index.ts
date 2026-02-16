export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface NotificationEvent {
  source: 'oracle' | 'reconciliation' | string;
  type: string;
  severity: NotificationSeverity;
  dedupKey: string;
  message: string;
  correlation: {
    tradeId?: string;
    actionKey?: string;
    requestId?: string;
    txHash?: string;
    runKey?: string;
    mismatchCode?: string;
  };
  metadata?: Record<string, string | number | boolean | null>;
}

export interface WebhookNotifierConfig {
  enabled: boolean;
  webhookUrl?: string;
  cooldownMs: number;
  requestTimeoutMs?: number;
  logger?: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
}

interface SlackPayload {
  text: string;
  attachments: Array<{
    color: string;
    fields: Array<{
      title: string;
      value: string;
      short: boolean;
    }>;
  }>;
}

const DEFAULT_TIMEOUT_MS = 5000;

export class WebhookNotifier {
  private readonly dedupCache = new Map<string, number>();

  constructor(private readonly config: WebhookNotifierConfig) {}

  private logInfo(message: string, meta?: Record<string, unknown>): void {
    if (this.config.logger) {
      this.config.logger.info(message, meta);
      return;
    }

    console.log(JSON.stringify({ level: 'info', message, ...meta }));
  }

  private logWarn(message: string, meta?: Record<string, unknown>): void {
    if (this.config.logger) {
      this.config.logger.warn(message, meta);
      return;
    }

    console.warn(JSON.stringify({ level: 'warn', message, ...meta }));
  }

  private logError(message: string, meta?: Record<string, unknown>): void {
    if (this.config.logger) {
      this.config.logger.error(message, meta);
      return;
    }

    console.error(JSON.stringify({ level: 'error', message, ...meta }));
  }

  private colorForSeverity(severity: NotificationSeverity): string {
    if (severity === 'critical') return '#d32f2f';
    if (severity === 'warning') return '#f57c00';
    return '#1976d2';
  }

  private shouldSend(dedupKey: string): boolean {
    const now = Date.now();
    const previousTimestamp = this.dedupCache.get(dedupKey);

    if (previousTimestamp && now - previousTimestamp < this.config.cooldownMs) {
      return false;
    }

    this.dedupCache.set(dedupKey, now);
    return true;
  }

  private toSlackPayload(event: NotificationEvent): SlackPayload {
    const correlationRows: Array<[string, string | undefined]> = [
      ['tradeId', event.correlation.tradeId],
      ['actionKey', event.correlation.actionKey],
      ['requestId', event.correlation.requestId],
      ['txHash', event.correlation.txHash],
      ['runKey', event.correlation.runKey],
      ['mismatchCode', event.correlation.mismatchCode],
    ];

    const fields = correlationRows
      .filter(([, value]) => Boolean(value))
      .map(([title, value]) => ({
        title,
        value: value as string,
        short: true,
      }));

    return {
      text: `[${event.source}] ${event.type} (${event.severity})`,
      attachments: [
        {
          color: this.colorForSeverity(event.severity),
          fields: [
            { title: 'message', value: event.message, short: false },
            ...fields,
          ],
        },
      ],
    };
  }

  async notify(event: NotificationEvent): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    if (!this.config.webhookUrl) {
      this.logWarn('Notification dropped because webhook URL is not configured', {
        source: event.source,
        type: event.type,
      });
      return false;
    }

    if (!this.shouldSend(event.dedupKey)) {
      this.logInfo('Notification suppressed by cooldown dedup', {
        dedupKey: event.dedupKey,
        cooldownMs: this.config.cooldownMs,
      });
      return false;
    }

    const payload = this.toSlackPayload(event);
    const timeoutMs = this.config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;

    const timeoutController = new AbortController();
    const timeoutHandle = setTimeout(() => {
      timeoutController.abort();
    }, timeoutMs);

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: timeoutController.signal,
      });

      if (!response.ok) {
        this.logError('Notification webhook request failed', {
          status: response.status,
          statusText: response.statusText,
          source: event.source,
          type: event.type,
        });
        return false;
      }

      this.logInfo('Notification sent', {
        source: event.source,
        type: event.type,
        severity: event.severity,
      });

      return true;
    } catch (error: any) {
      this.logError('Notification webhook request errored', {
        error: error?.message || error,
        source: event.source,
        type: event.type,
      });
      return false;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
