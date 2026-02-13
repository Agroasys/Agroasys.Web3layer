import { Request, Response } from 'express';
import { OracleService } from './service';
import { Logger } from './logger';
import {ReleaseStage1Request,ConfirmArrivalRequest,FinalizeTradeRequest,OracleResponse,ErrorResponse} from './types/types';
import { storeIdempotencyResponse } from './idempotency';

const oracleService = new OracleService();

export class OracleController {
    static async releaseStage1(req: Request<{}, {}, ReleaseStage1Request>,res: Response<OracleResponse | ErrorResponse>): Promise<void> {
        try {
            const { tradeId } = req.body;
            const idempotencyKey = (req as any).idempotencyKey;

            if (!tradeId) {
                res.status(400).json({
                success: false,
                error: 'ValidationError',
                message: 'tradeId is required',
                timestamp: new Date().toISOString(),
                });
                return;
            }

            const result = await oracleService.releaseFundsStage1(tradeId);
            
            await storeIdempotencyResponse(idempotencyKey,tradeId,'RELEASE_STAGE_1',result);

            res.status(200).json(result);
        } catch (error: any) {
        Logger.error('Controller error in releaseStage1', error);
            res.status(500).json({
                success: false,
                error: 'ContractError',
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    static async confirmArrival(req: Request<{}, {}, ConfirmArrivalRequest>,res: Response<OracleResponse | ErrorResponse>): Promise<void> {
        try {
            const { tradeId } = req.body;
            const idempotencyKey = (req as any).idempotencyKey;

            if (!tradeId) {
                res.status(400).json({
                success: false,
                error: 'ValidationError',
                message: 'tradeId is required',
                timestamp: new Date().toISOString(),
                });
                return;
            }

            const result = await oracleService.confirmArrival(tradeId);
            
            await storeIdempotencyResponse(idempotencyKey,tradeId,'CONFIRM_ARRIVAL',result);

            res.status(200).json(result);
        } catch (error: any) {
            Logger.error('Controller error in confirmArrival', error);
            res.status(500).json({
                success: false,
                error: 'ContractError',
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }

    static async finalizeTrade(req: Request<{}, {}, FinalizeTradeRequest>,res: Response<OracleResponse | ErrorResponse>): Promise<void> {
        try {
            const { tradeId } = req.body;
            const idempotencyKey = (req as any).idempotencyKey;

            if (!tradeId) {
                res.status(400).json({
                success: false,
                error: 'ValidationError',
                message: 'tradeId is required',
                timestamp: new Date().toISOString(),
                });
                return;
            }

            const result = await oracleService.finalizeTrade(tradeId);
            
            await storeIdempotencyResponse(idempotencyKey,tradeId,'FINALIZE_TRADE',result);

            res.status(200).json(result);
        } catch (error: any) {
            Logger.error('Controller error in finalizeTrade', error);
            res.status(500).json({
                success: false,
                error: 'ContractError',
                message: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }
}