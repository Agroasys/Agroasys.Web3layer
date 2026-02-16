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

## Service Auth (optional)
When `AUTH_ENABLED=true`, all endpoints except health require:
- `X-Api-Key`
- `X-Timestamp` (unix seconds)
- `X-Nonce`
- `X-Signature` (HMAC-SHA256)

Canonical string format:
`METHOD\nPATH\nQUERY\nBODY_SHA256\nTIMESTAMP\nNONCE`
