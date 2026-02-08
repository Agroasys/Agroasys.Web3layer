export interface TradeParameters {
    supplier: string;
    totalAmount: bigint;
    logisticsAmount: bigint;
    platformFeesAmount: bigint;
    supplierFirstTranche: bigint;
    supplierSecondTranche: bigint;
    ricardianHash: string;
    deadline?: number;
}

export interface TradeResult {
    txHash: string;
    blockNumber: number;
}

export enum TradeStatus {
    LOCKED = 0,
    IN_TRANSIT = 1,
    ARRIVAL_CONFIRMED = 2,
    FROZEN = 3,
    CLOSED = 4
}

export interface Trade {
    tradeId: string;
    buyer: string;
    supplier: string;
    status: TradeStatus;
    totalAmountLocked: bigint;
    logisticsAmount: bigint;
    platformFeesAmount: bigint;
    supplierFirstTranche: bigint;
    supplierSecondTranche: bigint;
    ricardianHash: string;
    createdAt: Date;
    arrivalTimestamp?: Date;
}