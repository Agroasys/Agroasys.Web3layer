import { ethers } from 'ethers';
import { Config } from '../src/config';
import dotenv from 'dotenv';

dotenv.config();

export const TEST_CONFIG: Config = {
    rpc: process.env.RPC_URL as string,
    chainId: Number(process.env.CHAIN_ID),
    escrowAddress: process.env.ESCROW_ADDRESS as string,
    usdcAddress: process.env.USDC_ADDRESS as string
};


export function getBuyerSigner(): ethers.Wallet {
    const privateKey = process.env.BUYER_PRIVATE_KEY as string;
    const provider = new ethers.JsonRpcProvider(TEST_CONFIG.rpc);
    return new ethers.Wallet(privateKey, provider);
}

export function getOracleSigner(): ethers.Wallet {
    const privateKey = process.env.ORACLE_PRIVATE_KEY as string;
    const provider = new ethers.JsonRpcProvider(TEST_CONFIG.rpc);
    return new ethers.Wallet(privateKey, provider);
}

export function getAdminSigner(id: number): ethers.Wallet {
    const privateKey = id === 1 ? process.env.ADMIN1_PRIVATE_KEY as string: process.env.ADMIN2_PRIVATE_KEY as string;
    const provider = new ethers.JsonRpcProvider(TEST_CONFIG.rpc);
    return new ethers.Wallet(privateKey, provider);
}

export function generateTestRicardianHash(content: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(content));
}

export function parseUSDC(amount: string): bigint {
    return ethers.parseUnits(amount, 6);
}