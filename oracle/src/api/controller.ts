import { Request, Response } from 'express';
import { Logger } from '../utils/logger';
import {ReleaseStage1Request,ConfirmArrivalRequest,FinalizeTradeRequest,OracleResponse,ErrorResponse} from '../types';
import { TriggerManager } from '../core/trigger-manager';
import { TriggerType } from '../types/trigger';
import { ValidationError } from '../utils/errors';

export class OracleController {
    constructor(private triggerManager: TriggerManager) {}

    async releaseStage1(
        req: Request<{}, {}, ReleaseStage1Request>,
        res: Response<OracleResponse | ErrorResponse>
    ): Promise<void> {
        try {
            const { tradeId, requestId } = req.body;

            if (!tradeId || !requestId) {
                res.status(400).json({
                    success: false,
                    error: 'ValidationError',
                    message: 'tradeId and requestId are required',
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            const result = await this.triggerManager.executeTrigger({
                tradeId,
                requestId,
                triggerType: TriggerType.RELEASE_STAGE_1,
                requestHash: req.hmacSignature,
            });

            res.status(200).json({
                success: true,
                idempotencyKey: result.idempotencyKey,
                actionKey: result.actionKey,
                status: result.status,
                txHash: result.txHash,
                blockNumber: result.blockNumber,
                message: result.message,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            Logger.error('Controller error in releaseStage1', error);
            
            const statusCode = error instanceof ValidationError ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                error: error.name || 'ContractError',
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    async confirmArrival(
        req: Request<{}, {}, ConfirmArrivalRequest>,
        res: Response<OracleResponse | ErrorResponse>
    ): Promise<void> {
        try {
            const { tradeId, requestId } = req.body;

            if (!tradeId || !requestId) {
                res.status(400).json({
                    success: false,
                    error: 'ValidationError',
                    message: 'tradeId and requestId are required',
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            const result = await this.triggerManager.executeTrigger({
                tradeId,
                requestId,
                triggerType: TriggerType.CONFIRM_ARRIVAL,
                requestHash: req.hmacSignature,
            });

            res.status(200).json({
                success: true,
                idempotencyKey: result.idempotencyKey,
                actionKey: result.actionKey,
                status: result.status,
                txHash: result.txHash,
                blockNumber: result.blockNumber,
                message: result.message,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            Logger.error('Controller error in confirmArrival', error);
            
            const statusCode = error instanceof ValidationError ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                error: error.name || 'ContractError',
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    async finalizeTrade(
        req: Request<{}, {}, FinalizeTradeRequest>,
        res: Response<OracleResponse | ErrorResponse>
    ): Promise<void> {
        try {
            const { tradeId, requestId } = req.body;

            if (!tradeId || !requestId) {
                res.status(400).json({
                    success: false,
                    error: 'ValidationError',
                    message: 'tradeId and requestId are required',
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            const result = await this.triggerManager.executeTrigger({
                tradeId,
                requestId,
                triggerType: TriggerType.FINALIZE_TRADE,
                requestHash: req.hmacSignature,
            });

            res.status(200).json({
                success: true,
                idempotencyKey: result.idempotencyKey,
                actionKey: result.actionKey,
                status: result.status,
                txHash: result.txHash,
                blockNumber: result.blockNumber,
                message: result.message,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            Logger.error('Controller error in finalizeTrade', error);
            
            const statusCode = error instanceof ValidationError ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                error: error.name || 'ContractError',
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    async redriveTrigger(
        req: Request<{}, {}, { tradeId: string; triggerType: TriggerType; requestId: string }>,
        res: Response<OracleResponse | ErrorResponse>
    ): Promise<void> {
        try {
            const { tradeId, triggerType, requestId } = req.body;

            if (!tradeId || !triggerType || !requestId) {
                res.status(400).json({
                    success: false,
                    error: 'ValidationError',
                    message: 'tradeId, triggerType, and requestId are required',
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            Logger.info('Re-drive request received', {
                tradeId,
                triggerType,
                requestId,
            });

            const result = await this.triggerManager.executeTrigger({
                tradeId,
                requestId,
                triggerType,
                requestHash: req.hmacSignature,
                isRedrive: true,
            });

            res.status(200).json({
                success: true,
                idempotencyKey: result.idempotencyKey,
                actionKey: result.actionKey,
                status: result.status,
                txHash: result.txHash,
                blockNumber: result.blockNumber,
                message: result.message,
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            Logger.error('Controller error in redriveTrigger', error);
            
            const statusCode = error instanceof ValidationError ? 400 : 500;
            res.status(statusCode).json({
                success: false,
                error: error.name || 'ContractError',
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }
}