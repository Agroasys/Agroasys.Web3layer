import { SDKClient, BlockchainResult } from '../blockchain/sdk-client';
import { StateValidator } from './state-validator';
import {Trigger,TriggerType,TriggerStatus,CreateTriggerData,} from '../types/trigger';
import {createTrigger,getTriggerByIdempotencyKey,updateTrigger,} from '../database/queries';
import {generateIdempotencyKey,calculateBackoff,} from '../utils/crypto';
import {classifyError,determineNextStatus,OracleError,} from '../utils/errors';
import { Logger } from '../utils/logger';

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

export interface TriggerRequest {
    tradeId: string;
    requestId: string;
    triggerType: TriggerType;
    requestHash?: string;
}

export interface TriggerResponse {
    idempotencyKey: string;
    status: TriggerStatus;
    txHash?: string;
    blockNumber?: number;
    message: string;
}

export class TriggerManager {
    constructor(private sdkClient: SDKClient) {}

    async executeTrigger(request: TriggerRequest): Promise<TriggerResponse> {
        StateValidator.validateTradeId(request.tradeId);

        Logger.info('Processing trigger request', {
            tradeId: request.tradeId,
            requestId: request.requestId,
            triggerType: request.triggerType,
        });

        const trade = await this.sdkClient.getTrade(request.tradeId);
        StateValidator.validateTradeState(trade, request.triggerType);

        const idempotencyKey = generateIdempotencyKey(
            request.triggerType,
            request.tradeId
        );

        Logger.info('Trade state validated, checking idempotency', {
            tradeId: request.tradeId,
            triggerType: request.triggerType,
            tradeStatus: trade.status,
            idempotencyKey: idempotencyKey.substring(0, 16) + '...',
        });

        const existing = await getTriggerByIdempotencyKey(idempotencyKey);
        
        if (existing) {
            return this.handleExistingTrigger(existing);
        }

        const trigger = await this.createNewTrigger(request, idempotencyKey);

        return await this.executeWithRetry(trigger);
    }

    private handleExistingTrigger(trigger: Trigger): TriggerResponse {
        Logger.info('Found existing trigger (idempotent)', {
            idempotencyKey: trigger.idempotency_key.substring(0, 16) + '...',
            status: trigger.status,
            txHash: trigger.tx_hash,
        });

        if (
            trigger.status === TriggerStatus.CONFIRMED ||
            trigger.status === TriggerStatus.SUBMITTED
        ) {
            return {
                idempotencyKey: trigger.idempotency_key,
                status: trigger.status,
                txHash: trigger.tx_hash || undefined,
                blockNumber: trigger.block_number 
                    ? Number(trigger.block_number) 
                    : undefined,
                message: 'Trigger already executed (idempotent)',
            };
        }

        if (
            trigger.status === TriggerStatus.TERMINAL_FAILURE ||
            trigger.status === TriggerStatus.RETRY_EXHAUSTED
        ) {
            return {
                idempotencyKey: trigger.idempotency_key,
                status: trigger.status,
                message: trigger.last_error || 'Trigger failed',
            };
        }

        return {
            idempotencyKey: trigger.idempotency_key,
            status: trigger.status,
            message: 'Trigger in progress',
        };
    }

    private async createNewTrigger(request: TriggerRequest,idempotencyKey: string): Promise<Trigger> {
        const data: CreateTriggerData = {
            idempotencyKey,
            requestId: request.requestId,
            tradeId: request.tradeId,
            triggerType: request.triggerType,
            requestHash: request.requestHash || null,
            status: TriggerStatus.PENDING,
        };

        return await createTrigger(data);
    }

    private async executeWithRetry(trigger: Trigger): Promise<TriggerResponse> {
        let attempt = 1;

        while (attempt <= MAX_ATTEMPTS) {
            try {
                Logger.info('Executing trigger attempt', {
                    idempotencyKey: trigger.idempotency_key.substring(0, 16) + '...',
                    attempt,
                    maxAttempts: MAX_ATTEMPTS,
                });

                const trade = await this.sdkClient.getTrade(trigger.trade_id);
                StateValidator.validateTradeState(trade, trigger.trigger_type);

                await updateTrigger(trigger.idempotency_key, {
                    status: TriggerStatus.EXECUTING,
                    attempt_count: attempt,
                });

                const result = await this.executeBlockchainAction(
                    trigger.trigger_type,
                    trigger.trade_id
                );

                await updateTrigger(trigger.idempotency_key, {
                    status: TriggerStatus.SUBMITTED,
                    tx_hash: result.txHash,
                    block_number: BigInt(result.blockNumber),
                    submitted_at: new Date(),
                });

                Logger.info('Trigger submitted successfully', {
                    idempotencyKey: trigger.idempotency_key.substring(0, 16) + '...',
                    txHash: result.txHash,
                    blockNumber: result.blockNumber,
                });

                return {
                    idempotencyKey: trigger.idempotency_key,
                    status: TriggerStatus.SUBMITTED,
                    txHash: result.txHash,
                    blockNumber: result.blockNumber,
                    message: 'Transaction submitted, awaiting confirmation',
                };

            } catch (error: any) {
                const oracleError = classifyError(error);

                Logger.error('Trigger execution failed', {
                    idempotencyKey: trigger.idempotency_key.substring(0, 16) + '...',
                    attempt,
                    errorType: oracleError.errorType,
                    isTerminal: oracleError.isTerminal,
                    message: oracleError.message,
                });

                const nextStatus = determineNextStatus(
                    oracleError,
                    attempt,
                    MAX_ATTEMPTS
                );

                await updateTrigger(trigger.idempotency_key, {
                    status: nextStatus,
                    attempt_count: attempt,
                    last_error: oracleError.message,
                    error_type: oracleError.errorType,
                });

                if (nextStatus === TriggerStatus.TERMINAL_FAILURE) {
                    return {
                        idempotencyKey: trigger.idempotency_key,
                        status: nextStatus,
                        message: oracleError.message,
                    };
                }

                if (nextStatus === TriggerStatus.RETRY_EXHAUSTED) {
                    return {
                        idempotencyKey: trigger.idempotency_key,
                        status: nextStatus,
                        message: `Failed after ${MAX_ATTEMPTS} attempts: ${oracleError.message}`,
                    };
                }

                if (attempt < MAX_ATTEMPTS && !oracleError.isTerminal) {
                    const backoffMs = calculateBackoff(attempt, BASE_DELAY_MS);
                    Logger.info('Retrying after backoff', {
                        idempotencyKey: trigger.idempotency_key.substring(0, 16) + '...',
                        backoffMs,
                        nextAttempt: attempt + 1,
                    });
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    attempt++;
                    continue;
                }

                throw error;
            }
        }

        throw new Error('Unexpected retry loop exit');
    }

    private async executeBlockchainAction(triggerType: TriggerType,tradeId: string): Promise<BlockchainResult> {
        switch (triggerType) {
            case TriggerType.RELEASE_STAGE_1:
                return await this.sdkClient.releaseFundsStage1(tradeId);

            case TriggerType.CONFIRM_ARRIVAL:
                return await this.sdkClient.confirmArrival(tradeId);

            case TriggerType.FINALIZE_TRADE:
                return await this.sdkClient.finalizeTrade(tradeId);

            default:
                throw new Error(`Unknown trigger type: ${triggerType}`);
        }
    }
}