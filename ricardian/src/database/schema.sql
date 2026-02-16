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

CREATE TABLE IF NOT EXISTS ricardian_auth_nonces (
    api_key VARCHAR(128) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (api_key, nonce)
);

CREATE INDEX IF NOT EXISTS idx_ricardian_hash ON ricardian_hashes(hash);
CREATE INDEX IF NOT EXISTS idx_ricardian_document_ref ON ricardian_hashes(document_ref);
CREATE INDEX IF NOT EXISTS idx_ricardian_created_at ON ricardian_hashes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ricardian_auth_nonces_expires_at ON ricardian_auth_nonces(expires_at);
