import dotenv from 'dotenv';
import { strict as assert } from 'assert';
import { OracleConfig } from './types';

dotenv.config();

function validateEnv(name: string): string {
    const value = process.env[name];
    assert(value, `${name} is missing`);
    return value;
}

function validateEnvNumber(name: string): number {
    const value = validateEnv(name);
    const num = parseInt(value, 10);
    assert(!isNaN(num), `${name} must be a number`);
    return num;
}

export function loadConfig(): OracleConfig {
    try {
        const config: OracleConfig = {
            // server
            port: validateEnvNumber('PORT'),
            apiKey: validateEnv('API_KEY'),
            hmacSecret: validateEnv('HMAC_SECRET'),
            
            // network
            rpcUrl: validateEnv('RPC_URL'),
            chainId: validateEnvNumber('CHAIN_ID'),
            escrowAddress: validateEnv('ESCROW_ADDRESS').toLowerCase(),
            usdcAddress: validateEnv('USDC_ADDRESS').toLowerCase(),
            oraclePrivateKey: validateEnv('ORACLE_PRIVATE_KEY'),
            
            // oracle db
            dbHost: validateEnv('DB_HOST'),
            dbPort: validateEnvNumber('DB_PORT'),
            dbName: validateEnv('DB_NAME'),
            dbUser: validateEnv('DB_USER'),
            dbPassword: validateEnv('DB_PASSWORD'),
            
            // indexer graphql api
            indexerGraphqlUrl: validateEnv('INDEXER_GRAPHQL_URL'),
            
            // retry
            retryAttempts: validateEnvNumber('RETRY_ATTEMPTS'),
            retryDelay: validateEnvNumber('RETRY_DELAY'),
        };
        
        return config;
    } catch (error) {
        console.error('Oracle config validation failed:', error);
        process.exit(1);
    }
}

export const config = loadConfig();