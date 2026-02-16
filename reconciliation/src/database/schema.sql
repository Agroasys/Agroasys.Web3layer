CREATE TABLE IF NOT EXISTS reconcile_runs (
    id SERIAL PRIMARY KEY,
    run_key VARCHAR(255) NOT NULL UNIQUE,
    mode VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    total_trades INT NOT NULL DEFAULT 0,
    drift_count INT NOT NULL DEFAULT 0,
    critical_count INT NOT NULL DEFAULT 0,
    high_count INT NOT NULL DEFAULT 0,
    medium_count INT NOT NULL DEFAULT 0,
    low_count INT NOT NULL DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS reconcile_drifts (
    id SERIAL PRIMARY KEY,
    run_id INT NOT NULL REFERENCES reconcile_runs(id) ON DELETE CASCADE,
    run_key VARCHAR(255) NOT NULL,
    trade_id VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    mismatch_code VARCHAR(64) NOT NULL,
    onchain_value TEXT,
    indexed_value TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurrences INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_run_trade_mismatch UNIQUE (run_key, trade_id, mismatch_code)
);

CREATE INDEX IF NOT EXISTS idx_reconcile_runs_status ON reconcile_runs(status);
CREATE INDEX IF NOT EXISTS idx_reconcile_runs_started_at ON reconcile_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconcile_drifts_trade_id ON reconcile_drifts(trade_id);
CREATE INDEX IF NOT EXISTS idx_reconcile_drifts_severity ON reconcile_drifts(severity);
CREATE INDEX IF NOT EXISTS idx_reconcile_drifts_mismatch ON reconcile_drifts(mismatch_code);
