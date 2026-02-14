import { IndexerClient } from '../blockchain/indexer-client';
import { getTriggersByStatus, updateTrigger } from '../database/queries';
import { TriggerStatus } from '../types/trigger';
import { Logger } from '../utils/logger';

const POLL_INTERVAL_MS = 10000; // 10 secs
const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes: soft timeout (warning)
const HARD_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes: hard timeout (moves to exhausted)
const BATCH_SIZE = 100;

export class ConfirmationWorker {
    private isRunning = false;
    private intervalId?: NodeJS.Timeout;

    constructor(private indexerClient: IndexerClient) {}

    start(): void {
        if (this.isRunning) {
            Logger.warn('ConfirmationWorker already running');
            return;
        }

        this.isRunning = true;
        Logger.info('ConfirmationWorker started', { 
            pollIntervalMs: POLL_INTERVAL_MS,
            batchSize: BATCH_SIZE,
            softTimeoutMinutes: CONFIRMATION_TIMEOUT_MS / 60000,
            hardTimeoutMinutes: HARD_TIMEOUT_MS / 60000,
        });

        this.intervalId = setInterval(
            () => this.pollConfirmations(),
            POLL_INTERVAL_MS
        );
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }

        Logger.info('ConfirmationWorker stopped');
    }

    private async pollConfirmations(): Promise<void> {
        try {
            const submittedTriggers = await getTriggersByStatus(
                TriggerStatus.SUBMITTED,
                BATCH_SIZE
            );

            if (submittedTriggers.length === 0) {
                return;
            }

            Logger.info('Polling confirmations', { 
                count: submittedTriggers.length,
                batchSize: BATCH_SIZE 
            });

            for (const trigger of submittedTriggers) {
                await this.checkConfirmation(trigger);
            }

        } catch (error: any) {
            Logger.error('Confirmation polling failed', { error });
        }
    }

    private async checkConfirmation(trigger: any): Promise<void> {
        try {
            if (!trigger.tx_hash) {
                Logger.warn('Trigger has no tx_hash', { 
                    idempotencyKey: trigger.idempotency_key.substring(0, 32),
                    actionKey: trigger.action_key,
                });
                return;
            }

            const submittedAt = new Date(trigger.submitted_at).getTime();
            const now = Date.now();
            const ageMs = now - submittedAt;
            const ageMinutes = ageMs / 60000;

            if (ageMs > CONFIRMATION_TIMEOUT_MS && ageMs <= HARD_TIMEOUT_MS) {
                Logger.warn('Confirmation taking longer than expected', {
                    idempotencyKey: trigger.idempotency_key.substring(0, 32),
                    actionKey: trigger.action_key,
                    txHash: trigger.tx_hash,
                    ageMinutes: ageMinutes.toFixed(1),
                    status: 'INDEXER_MAY_BE_LAGGING',
                    action: 'CONTINUE_MONITORING',
                });
            }

            if (ageMs > HARD_TIMEOUT_MS) {
                Logger.error('Confirmation hard timeout exceeded', {
                    idempotencyKey: trigger.idempotency_key.substring(0, 32),
                    actionKey: trigger.action_key,
                    txHash: trigger.tx_hash,
                    tradeId: trigger.trade_id,
                    ageMinutes: ageMinutes.toFixed(1),
                    status: 'TIMEOUT',
                    action: 'MOVING_TO_EXHAUSTED_NEEDS_REDRIVE',
                });

                await updateTrigger(trigger.idempotency_key, {
                    status: TriggerStatus.EXHAUSTED_NEEDS_REDRIVE,
                    last_error: `Confirmation timeout after ${ageMinutes.toFixed(1)} minutes. Transaction may have failed or indexer is lagging. Re-drive will verify on-chain status.`,
                    error_type: 'INDEXER_LAG' as any,
                });

                Logger.audit('CONFIRMATION_TIMEOUT_NEEDS_REDRIVE', trigger.trade_id, {
                    idempotencyKey: trigger.idempotency_key,
                    actionKey: trigger.action_key,
                    triggerType: trigger.trigger_type,
                    txHash: trigger.tx_hash,
                    ageMinutes: ageMinutes.toFixed(1),
                    severity: 'HIGH',
                    requiresRedrive: true,
                });

                return;
            }

            const event = await this.indexerClient.findConfirmationEvent(
                trigger.tx_hash,
                trigger.trade_id
            );

            if (event) {
                Logger.info('Transaction confirmed in indexer', {
                    idempotencyKey: trigger.idempotency_key.substring(0, 32),
                    actionKey: trigger.action_key,
                    txHash: trigger.tx_hash,
                    eventId: event.id,
                    eventName: event.eventName,
                    blockNumber: event.blockNumber,
                    confirmationTimeSeconds: (ageMs / 1000).toFixed(1),
                });

                await updateTrigger(trigger.idempotency_key, {
                    status: TriggerStatus.CONFIRMED,
                    indexer_confirmed: true,
                    indexer_confirmed_at: new Date(),
                    indexer_event_id: event.id,
                    confirmed_at: new Date(),
                });

                Logger.audit('TRIGGER_CONFIRMED', trigger.trade_id, {
                    idempotencyKey: trigger.idempotency_key.substring(0, 32),
                    actionKey: trigger.action_key,
                    triggerType: trigger.trigger_type,
                    txHash: trigger.tx_hash,
                    eventName: event.eventName,
                    blockNumber: event.blockNumber,
                    confirmationTimeSeconds: (ageMs / 1000).toFixed(1),
                });
            } else {
                Logger.info('Event not yet indexed, will retry', {
                    idempotencyKey: trigger.idempotency_key.substring(0, 32),
                    actionKey: trigger.action_key,
                    txHash: trigger.tx_hash,
                    ageSeconds: (ageMs / 1000).toFixed(0),
                    ageMinutes: ageMinutes.toFixed(1),
                });
            }

        } catch (error: any) {
            Logger.error('Failed to check confirmation', {
                idempotencyKey: trigger.idempotency_key.substring(0, 32),
                actionKey: trigger.action_key,
                error: error.message,
            });
        }
    }
}