CREATE TABLE IF NOT EXISTS oracle_triggers (
    id SERIAL,
    idempotency_key VARCHAR(255) PRIMARY KEY,
    
    request_id VARCHAR(255),
    
    trade_id VARCHAR(100) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL, -- (RELEASE_STAGE_1, CONFIRM_ARRIVAL, FINALIZE_TRADE)
    request_hash VARCHAR(66), -- HMAC signature
    
    attempt_count INT DEFAULT 0,
    status VARCHAR(20) NOT NULL, -- (PENDING, EXECUTING, SUBMITTED, CONFIRMED, FAILED, RETRY_EXHAUSTED, TERMINAL_FAILURE)
    
    tx_hash VARCHAR(66),
    block_number BIGINT,
    
    indexer_confirmed BOOLEAN DEFAULT false,
    indexer_confirmed_at TIMESTAMP,
    indexer_event_id VARCHAR(255),
    
    last_error TEXT,
    error_type VARCHAR(50), -- (VALIDATION, NETWORK, CONTRACT, TERMINAL, INDEXER_LAG, RETRY_EXHAUSTED)
    
    created_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP,
    confirmed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_id ON oracle_triggers(trade_id);
CREATE INDEX IF NOT EXISTS idx_status ON oracle_triggers(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON oracle_triggers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_id ON oracle_triggers(request_id);

CREATE INDEX IF NOT EXISTS idx_submitted_unconfirmed 
ON oracle_triggers(status, submitted_at) 
WHERE status = 'SUBMITTED' AND indexer_confirmed = false;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_status') THEN
        ALTER TABLE oracle_triggers ADD CONSTRAINT check_status 
        CHECK (status IN ('PENDING', 'EXECUTING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'RETRY_EXHAUSTED', 'TERMINAL_FAILURE'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_trigger_type') THEN
        ALTER TABLE oracle_triggers ADD CONSTRAINT check_trigger_type 
        CHECK (trigger_type IN ('RELEASE_STAGE_1', 'CONFIRM_ARRIVAL', 'FINALIZE_TRADE'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_error_type') THEN
        ALTER TABLE oracle_triggers ADD CONSTRAINT check_error_type
        CHECK (error_type IN ('VALIDATION', 'NETWORK', 'CONTRACT', 'TERMINAL', 'INDEXER_LAG', 'RETRY_EXHAUSTED'));
    END IF;
END $$;