import { Client } from '../client';
import { ethers } from 'ethers';
import { DisputeStatus, DisputeResult, DisputeProposal } from '../types/dispute';
import { GovernanceResult, OracleUpdateProposal, AdminAddProposal } from '../types/governance';
import { ContractError, AuthorizationError, ValidationError } from '../types/errors';
import { validateAddress } from '../utils/validation';

export class AdminSDK extends Client {
    

    private async verifyAdmin(adminSigner: ethers.Signer): Promise<void> {
        const adminAddress = await adminSigner.getAddress();
        const isAdmin = await this.isAdmin(adminAddress);
        
        if (!isAdmin) {
            throw new AuthorizationError(
                'Caller is not an authorized admin',
                { address: adminAddress }
            );
        }
    }
    

    async proposeDisputeSolution(tradeId: string | bigint,disputeStatus: DisputeStatus,adminSigner: ethers.Signer): Promise<DisputeResult> {
        await this.verifyAdmin(adminSigner);
        
        if (disputeStatus !== DisputeStatus.REFUND && disputeStatus !== DisputeStatus.RESOLVE) {
            throw new ValidationError('Invalid dispute status', { disputeStatus });
        }
        
        try {
            const contractWithSigner = this.contract.connect(adminSigner);
            const tx = await contractWithSigner.proposeDisputeSolution(tradeId, disputeStatus);
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
                `Failed to propose dispute solution: ${error.message}`,
                { tradeId: tradeId.toString(), disputeStatus, error: error.message }
            );
        }
    }
    

    async approveDisputeSolution(proposalId: string | bigint,adminSigner: ethers.Signer): Promise<DisputeResult> {
        await this.verifyAdmin(adminSigner);
        
        try {
            const contractWithSigner = this.contract.connect(adminSigner);
            const tx = await contractWithSigner.approveDisputeSolution(proposalId);
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
                `Failed to approve dispute: ${error.message}`,
                { proposalId: proposalId.toString(), error: error.message }
            );
        }
    }
    
    // ###### GOVERNANCE
    

    async proposeOracleUpdate(newOracle: string,adminSigner: ethers.Signer): Promise<GovernanceResult> {
        await this.verifyAdmin(adminSigner);
        validateAddress(newOracle, 'newOracle');
        
        try {
            const contractWithSigner = this.contract.connect(adminSigner);
            const tx = await contractWithSigner.proposeOracleUpdate(newOracle);
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
                `Failed to propose oracle update: ${error.message}`,
                { newOracle, error: error.message }
            );
        }
    }
    

    async approveOracleUpdate(proposalId: string | bigint,adminSigner: ethers.Signer): Promise<GovernanceResult> {
        await this.verifyAdmin(adminSigner);
        
        try {
            const contractWithSigner = this.contract.connect(adminSigner);
            const tx = await contractWithSigner.approveOracleUpdate(proposalId);
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
                `Failed to approve oracle update: ${error.message}`,
                { proposalId: proposalId.toString(), error: error.message }
            );
        }
    }
    

    async executeOracleUpdate(proposalId: string | bigint,adminSigner: ethers.Signer): Promise<GovernanceResult> {
        await this.verifyAdmin(adminSigner);
        
        try {
            const contractWithSigner = this.contract.connect(adminSigner);
            const tx = await contractWithSigner.executeOracleUpdate(proposalId);
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
                `Failed to execute oracle update: ${error.message}`,
                { proposalId: proposalId.toString(), error: error.message }
            );
        }
    }
    
    
    async proposeAddAdmin(newAdmin: string,adminSigner: ethers.Signer): Promise<GovernanceResult> {
        await this.verifyAdmin(adminSigner);
        validateAddress(newAdmin, 'newAdmin');
        
        try {
            const contractWithSigner = this.contract.connect(adminSigner);
            const tx = await contractWithSigner.proposeAddAdmin(newAdmin);
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
                `Failed to propose admin addition: ${error.message}`,
                { newAdmin, error: error.message }
            );
        }
    }
    

    async approveAddAdmin(proposalId: string | bigint,adminSigner: ethers.Signer): Promise<GovernanceResult> {
        await this.verifyAdmin(adminSigner);
        
        try {
            const contractWithSigner = this.contract.connect(adminSigner);
            const tx = await contractWithSigner.approveAddAdmin(proposalId);
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
                `Failed to approve admin addition: ${error.message}`,
                { proposalId: proposalId.toString(), error: error.message }
            );
        }
    }
    
    async executeAddAdmin(proposalId: string | bigint,adminSigner: ethers.Signer): Promise<GovernanceResult> {
        await this.verifyAdmin(adminSigner);
        
        try {
            const contractWithSigner = this.contract.connect(adminSigner);
            const tx = await contractWithSigner.executeAddAdmin(proposalId);
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
                `Failed to execute admin addition: ${error.message}`,
                { proposalId: proposalId.toString(), error: error.message }
            );
        }
    }
}