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
    id: number;
    idempotency_key: string;
    
    request_id: string | null;
    
    trade_id: string;
    trigger_type: TriggerType;
    request_hash: string | null;
    
    attempt_count: number;
    status: TriggerStatus;
    
    tx_hash: string | null;
    block_number: bigint | null;
    
    indexer_confirmed: boolean;
    indexer_confirmed_at: Date | null;
    indexer_event_id: string | null;
    
    last_error: string | null;
    error_type: ErrorType | null;
    
    created_at: Date;
    submitted_at: Date | null;
    confirmed_at: Date | null;
    updated_at: Date;
}

export interface CreateTriggerData {
    idempotencyKey: string;
    requestId: string | null;
    tradeId: string;
    triggerType: TriggerType;
    requestHash: string | null;
    status: TriggerStatus;
}

export interface UpdateTriggerData {
    status?: TriggerStatus;
    attempt_count?: number;
    tx_hash?: string;
    block_number?: bigint;
    indexer_confirmed?: boolean;
    indexer_confirmed_at?: Date;
    indexer_event_id?: string;
    last_error?: string;
    error_type?: ErrorType;
    submitted_at?: Date;
    confirmed_at?: Date;
}