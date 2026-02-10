import { ethers } from 'ethers';
import { OracleSDK } from '@agroasys/sdk';
import { config } from './config';
import { Logger } from './logger';
import { OracleResponse } from './types';
import { retryWithBackoff } from './retry';

export class OracleService {
    private sdk: OracleSDK;
    private signer: ethers.Wallet;

    constructor() {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.signer = new ethers.Wallet(config.oraclePrivateKey, provider);

        this.sdk = new OracleSDK({
            rpc: config.rpcUrl,
            chainId: config.chainId,
            escrowAddress: config.escrowAddress,
            usdcAddress: config.usdcAddress,
        });

        Logger.info('OracleService initialized', {
            oracleAddress: this.signer.address,
            escrowAddress: config.escrowAddress,
        });
    }

    async releaseFundsStage1(tradeId: string): Promise<OracleResponse> {
        Logger.info('Releasing stage 1 funds', { tradeId });

        const result = await retryWithBackoff(
            async () => {
                return await this.sdk.releaseFundsStage1(tradeId, this.signer);
            },
            'releaseFundsStage1',
            config.retryAttempts,
            config.retryDelay
        );

        const response: OracleResponse = {
            success: true,
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            timestamp: new Date().toISOString(),
            tradeId,
        };

        Logger.audit('RELEASE_STAGE_1', tradeId, response);
        return response;
    }

    async confirmArrival(tradeId: string): Promise<OracleResponse> {
        Logger.info('Confirming arrival', { tradeId });

        const result = await retryWithBackoff(
            async () => {
                return await this.sdk.confirmArrival(tradeId, this.signer);
            },
            'confirmArrival',
            config.retryAttempts,
            config.retryDelay
        );

        const response: OracleResponse = {
            success: true,
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            timestamp: new Date().toISOString(),
            tradeId,
        };

        Logger.audit('CONFIRM_ARRIVAL', tradeId, response);
        return response;
    }

    async finalizeTrade(tradeId: string): Promise<OracleResponse> {
        Logger.info('Finalizing trade', { tradeId });

        const result = await retryWithBackoff(
            async () => {
                return await this.sdk.finalizeAfterDisputeWindow(tradeId, this.signer);
            },
            'finalizeTrade',
            config.retryAttempts,
            config.retryDelay
        );

        const response: OracleResponse = {
            success: true,
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            timestamp: new Date().toISOString(),
            tradeId,
        };

        Logger.audit('FINALIZE_TRADE', tradeId, response);
        return response;
    }
}