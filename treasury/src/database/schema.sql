CREATE TABLE IF NOT EXISTS treasury_ledger_entries (
    id SERIAL PRIMARY KEY,
    entry_key VARCHAR(255) NOT NULL UNIQUE,
    trade_id VARCHAR(255) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    block_number INT NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    component_type VARCHAR(32) NOT NULL,
    amount_raw TEXT NOT NULL,
    source_timestamp TIMESTAMP NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_lifecycle_events (
    id SERIAL PRIMARY KEY,
    ledger_entry_id INT NOT NULL REFERENCES treasury_ledger_entries(id) ON DELETE CASCADE,
    state VARCHAR(32) NOT NULL,
    note TEXT,
    actor VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_ledger_trade_id ON treasury_ledger_entries(trade_id);
CREATE INDEX IF NOT EXISTS idx_treasury_ledger_created_at ON treasury_ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_payout_state_created ON payout_lifecycle_events(state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_payout_entry_created ON payout_lifecycle_events(ledger_entry_id, created_at DESC);
