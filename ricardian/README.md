# Ricardian Service v0

Deterministic canonicalization and SHA-256 hashing service for Ricardian payloads.

## Endpoints
- `POST /api/ricardian/v1/hash`
- `GET /api/ricardian/v1/hash/:hash`
- `GET /api/ricardian/v1/health`

## Service Auth (optional)
When `AUTH_ENABLED=true`, all endpoints except health require:
- `X-Api-Key`
- `X-Timestamp` (unix seconds)
- `X-Nonce`
- `X-Signature` (HMAC-SHA256)

Canonical string format:
`METHOD\nPATH\nQUERY\nBODY_SHA256\nTIMESTAMP\nNONCE`

## Notes
- Canonicalization rules are versioned (`RICARDIAN_CANONICAL_V1`).
- Hashes and metadata are persisted for auditability.
- Service does not perform legal interpretation.
