# Ricardian Service v0

Deterministic canonicalization and SHA-256 hashing service for Ricardian payloads.

## Endpoints
- `POST /api/ricardian/v1/hash`
- `GET /api/ricardian/v1/hash/:hash`

## Notes
- Canonicalization rules are versioned (`RICARDIAN_CANONICAL_V1`).
- Hashes and metadata are persisted for auditability.
- Service does not perform legal interpretation.
