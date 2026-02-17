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

Auth failures return structured JSON with stable `code` values (for example: `AUTH_MISSING_HEADERS`, `AUTH_INVALID_SIGNATURE`, `AUTH_FORBIDDEN`).
`API_KEYS_JSON` entries must set `active` as an explicit boolean (`true` or `false`) for each key.

## Rate Limiting (optional)
Set `RATE_LIMIT_ENABLED=true` to enforce per-route limits.

- Write route (`POST /hash`): stricter burst + sustained limits
- Read route (`GET /hash/:hash`): looser burst + sustained limits
- Limiter identity: caller IP (header spoofing safe for unauthenticated requests)
- Response includes `RateLimit-*` headers

Redis-backed mode is used when `RATE_LIMIT_REDIS_URL` is configured.
In-memory fallback is allowed for local/dev environments only.

## Notes
- Canonicalization rules are versioned (`RICARDIAN_CANONICAL_V1`).
- Hashes and metadata are persisted for auditability.
- Service does not perform legal interpretation.

## Docker
See `docs/docker-services.md` for compose profiles and runtime operations.
