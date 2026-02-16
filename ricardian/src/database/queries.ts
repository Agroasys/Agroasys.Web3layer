import { pool } from './connection';
import { RicardianHashRow } from '../types';

export async function createRicardianHash(data: {
  requestId: string;
  documentRef: string;
  hash: string;
  rulesVersion: string;
  canonicalJson: string;
  metadata: Record<string, unknown>;
}): Promise<RicardianHashRow> {
  const result = await pool.query<RicardianHashRow>(
    `INSERT INTO ricardian_hashes (
        request_id,
        document_ref,
        hash,
        rules_version,
        canonical_json,
        metadata
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (hash, document_ref)
     DO UPDATE SET
       metadata = EXCLUDED.metadata
     RETURNING *`,
    [
      data.requestId,
      data.documentRef,
      data.hash,
      data.rulesVersion,
      data.canonicalJson,
      JSON.stringify(data.metadata),
    ]
  );

  return result.rows[0];
}

export async function getRicardianHash(hash: string): Promise<RicardianHashRow | null> {
  const result = await pool.query<RicardianHashRow>(
    `SELECT *
     FROM ricardian_hashes
     WHERE hash = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [hash]
  );

  return result.rows[0] || null;
}

export async function consumeServiceAuthNonce(apiKey: string, nonce: string, ttlSeconds: number): Promise<boolean> {
  const result = await pool.query(
    `WITH cleanup AS (
      DELETE FROM ricardian_auth_nonces
      WHERE expires_at <= NOW()
    )
    INSERT INTO ricardian_auth_nonces (api_key, nonce, expires_at)
    VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))
    ON CONFLICT (api_key, nonce) DO NOTHING
    RETURNING api_key`,
    [apiKey, nonce, ttlSeconds]
  );

  return (result.rowCount ?? 0) > 0;
}
