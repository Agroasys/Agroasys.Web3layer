# Treasury Ledger v0

Append-only treasury accounting view for on-chain treasury-relevant events.

## Capabilities
- Ingests `FundsReleasedStage1` and `PlatformFeesPaidStage1` from indexer GraphQL
- Stores append-only ledger entries
- Stores append-only payout lifecycle state events
- Exposes read/query/export endpoints for reconciliation

## Endpoints
- `POST /api/treasury/v1/ingest`
- `GET /api/treasury/v1/entries`
- `POST /api/treasury/v1/entries/:entryId/state`
- `GET /api/treasury/v1/export?format=json|csv`
- `GET /api/treasury/v1/health`
- `GET /api/treasury/v1/ready`

Health semantics:
- `/health`: process-level liveness
- `/ready`: dependency readiness (database connectivity check)

## Service Auth (optional)
When `AUTH_ENABLED=true`, sensitive write endpoints require HMAC headers:
- `x-agroasys-timestamp` (unix seconds)
- `x-agroasys-signature` (HMAC-SHA256)
- `x-agroasys-nonce` (optional; deterministic fallback derived when omitted)

Protected treasury endpoints:
- `POST /api/treasury/v1/ingest`
- `POST /api/treasury/v1/entries/:entryId/state`

Optional key-based mode:
- `X-Api-Key` to select key-specific secret from `API_KEYS_JSON`
- If `X-Api-Key` is omitted, middleware can verify with `HMAC_SECRET`

Canonical string format:
`METHOD\nPATH\nQUERY\nBODY_SHA256\nTIMESTAMP\nNONCE`

Auth failures return structured JSON with stable `code` values (for example: `AUTH_MISSING_HEADERS`, `AUTH_INVALID_SIGNATURE`, `AUTH_FORBIDDEN`).
`API_KEYS_JSON` entries must set `active` as an explicit boolean (`true` or `false`) for each key.

## Observability
Structured logs include baseline keys:
- `service`
- `env`

Correlation keys are emitted by call path when available:
- `tradeId`
- `actionKey`
- `requestId`
- `txHash`

## Docker
See `docs/docker-services.md` and `docs/runbooks/docker-profiles.md` for runtime operations.

## License
Licensed under Apache-2.0.
See the repository root `LICENSE` file.
