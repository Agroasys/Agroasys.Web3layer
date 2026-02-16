CREATE TABLE IF NOT EXISTS ricardian_hashes (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(100) NOT NULL,
    document_ref TEXT NOT NULL,
    hash CHAR(64) NOT NULL,
    rules_version VARCHAR(64) NOT NULL,
    canonical_json TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ricardian_hash_doc UNIQUE (hash, document_ref)
);

CREATE INDEX IF NOT EXISTS idx_ricardian_hash ON ricardian_hashes(hash);
CREATE INDEX IF NOT EXISTS idx_ricardian_document_ref ON ricardian_hashes(document_ref);
CREATE INDEX IF NOT EXISTS idx_ricardian_created_at ON ricardian_hashes(created_at DESC);
