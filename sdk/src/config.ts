export interface Config {
    // network
    rpc: string;
    chainId: number;

    // contracts
    escrowAddress: string;
    usdcAddress: string;

    // graphql indexer
    indexerUrl: string;

    // key
    privateKey: string
}