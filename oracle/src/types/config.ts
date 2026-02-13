export interface OracleConfig {
    // server
    port: number;
    apiKey: string;
    hmacSecret: string;
    
    // network
    rpcUrl: string;
    chainId: number;
    escrowAddress: string;
    usdcAddress: string;
    oraclePrivateKey: string;
    
    // oracle db
    dbHost: string;
    dbPort: number;
    dbName: string;
    dbUser: string;
    dbPassword: string;
    
    // indexer graphql api
    indexerGraphqlUrl: string;
    
    // retry
    retryAttempts: number;
    retryDelay: number;
}