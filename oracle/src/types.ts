export interface OracleConfig {
    port: number;
    apiKey: string;
    rpcUrl: string;
    chainId: number;
    escrowAddress: string;
    usdcAddress: string;
    oraclePrivateKey: string;
    dbHost: string;
    dbPort: number;
    dbName: string;
    dbUser: string;
    dbPassword: string;
    retryAttempts: number;
    retryDelay: number;
}


export interface OracleResponse {
    success: boolean;
    txHash: string;
    blockNumber: number;
    timestamp: string;
    tradeId: string;
}

export interface ErrorResponse {
    success: false;
    error: string;
    message: string;
    timestamp: string;
}

export interface ReleaseStage1Request {
    tradeId: string;
}

export interface ConfirmArrivalRequest {
    tradeId: string;
}

export interface FinalizeTradeRequest {
    tradeId: string;
}