# Ricardian Service v0

Deterministic canonicalization and SHA-256 hashing service for Ricardian payloads.

## Endpoints
- `POST /api/ricardian/v1/hash`
- `GET /api/ricardian/v1/hash/:hash`
- `GET /api/ricardian/v1/health`

## Rate Limiting (optional)
Set `RATE_LIMIT_ENABLED=true` to enforce per-route limits.

- Write route (`POST /hash`): stricter burst + sustained limits
- Read route (`GET /hash/:hash`): looser burst + sustained limits
- Keying priority: `X-Api-Key` then IP fallback
- Response includes `RateLimit-*` headers

Redis-backed mode is used when `RATE_LIMIT_REDIS_URL` is configured.
In-memory fallback is allowed for local/dev environments only.

## Notes
- Canonicalization rules are versioned (`RICARDIAN_CANONICAL_V1`).
- Hashes and metadata are persisted for auditability.
- Service does not perform legal interpretation.
