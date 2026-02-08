import { Client } from '../client';
import { ethers } from 'ethers';
import { ContractError, AuthorizationError } from '../types/errors';
import { OracleResult } from '../types/oracle';

export class OracleSDK extends Client {
    
    private async verifyOracle(oracleSigner: ethers.Signer): Promise<void> {
        const oracleAddress = await oracleSigner.getAddress();
        const authorizedOracle = await this.getOracleAddress();
        
        if (oracleAddress.toLowerCase() !== authorizedOracle.toLowerCase()) {
            throw new AuthorizationError(
                'Caller is not the authorized oracle',
                { 
                    caller: oracleAddress,
                    authorizedOracle
                }
            );
        }
    }
    
    async releaseFundsStage1(tradeId: string | bigint,oracleSigner: ethers.Signer): Promise<OracleResult> {
        await this.verifyOracle(oracleSigner);
        
        try {
            const contractWithSigner = this.contract.connect(oracleSigner);
            const tx = await contractWithSigner.releaseFundsStage1(tradeId);
            const receipt = await tx.wait();
            
            if (!receipt) {
                throw new ContractError('Transaction receipt not available');
            }
            
            return {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
            
        } catch (error: any) {
            throw new ContractError(
                `Failed to release stage 1 funds: ${error.message}`,
                { tradeId: tradeId.toString(), error: error.message }
            );
        }
    }
    

    async confirmArrival(tradeId: string | bigint,oracleSigner: ethers.Signer): Promise<OracleResult> {
        await this.verifyOracle(oracleSigner);
        
        try {
            const contractWithSigner = this.contract.connect(oracleSigner);
            const tx = await contractWithSigner.confirmArrival(tradeId);
            const receipt = await tx.wait();
            
            if (!receipt) {
                throw new ContractError('Transaction receipt not available');
            }
            
            return {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
            
        } catch (error: any) {
            throw new ContractError(
                `Failed to confirm arrival: ${error.message}`,
                { tradeId: tradeId.toString(), error: error.message }
            );
        }
    }
    

    async finalizeAfterDisputeWindow(tradeId: string | bigint,signer: ethers.Signer): Promise<OracleResult> {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.finalizeAfterDisputeWindow(tradeId);
            const receipt = await tx.wait();
            
            if (!receipt) {
                throw new ContractError('Transaction receipt not available');
            }
            
            return {
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
            
        } catch (error: any) {
            throw new ContractError(
                `Failed to finalize trade: ${error.message}`,
                { tradeId: tradeId.toString(), error: error.message }
            );
        }
    }
}