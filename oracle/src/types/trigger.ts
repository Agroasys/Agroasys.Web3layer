export enum TriggerStatus {
    PENDING = 'PENDING',
    EXECUTING = 'EXECUTING',
    SUBMITTED = 'SUBMITTED',
    CONFIRMED = 'CONFIRMED',
    FAILED = 'FAILED',
    RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
    TERMINAL_FAILURE = 'TERMINAL_FAILURE'
}

export enum TriggerType {
    RELEASE_STAGE_1 = 'RELEASE_STAGE_1',
    CONFIRM_ARRIVAL = 'CONFIRM_ARRIVAL',
    FINALIZE_TRADE = 'FINALIZE_TRADE'
}

export enum ErrorType {
    VALIDATION = 'VALIDATION',
    NETWORK = 'NETWORK',
    CONTRACT = 'CONTRACT',
    TERMINAL = 'TERMINAL',
    INDEXER_LAG = 'INDEXER_LAG',
    RETRY_EXHAUSTED = 'RETRY_EXHAUSTED'
}


export interface Trigger {
    // ids
    id: number;
    trigger_id: string;
    
    // idempotency
    idempotency_key: string;
    request_id: string | null;
    
    // details
    trade_id: string;
    trigger_type: TriggerType;
    request_hash: string | null;
    
    // execution tracking
    attempt_count: number;
    status: TriggerStatus;
    
    // network data
    tx_hash: string | null;
    block_number: bigint | null;
    gas_used: bigint | null;
    
    // idnexer confirmation
    indexer_confirmed: boolean;
    indexer_confirmed_at: Date | null;
    indexer_event_id: string | null;
    
    // error tracking
    last_error: string | null;
    error_type: ErrorType | null;
    
    // timestamps
    created_at: Date;
    submitted_at: Date | null;
    confirmed_at: Date | null;
    updated_at: Date;
}


export interface CreateTriggerData {
    triggerId: string;
    idempotencyKey: string;
    requestId: string | null;
    tradeId: string;
    triggerType: TriggerType;
    requestHash: string | null;
    status: TriggerStatus;
}

export interface UpdateTriggerData {
    // status
    status?: TriggerStatus;
    attempt_count?: number;
    
    // network data
    tx_hash?: string;
    block_number?: bigint;
    gas_used?: bigint;
    
    // indexer confirmation
    indexer_confirmed?: boolean;
    indexer_confirmed_at?: Date;
    indexer_event_id?: string;
    
    // error tracking
    last_error?: string;
    error_type?: ErrorType;
    
    // timestamps
    submitted_at?: Date;
    confirmed_at?: Date;
}
