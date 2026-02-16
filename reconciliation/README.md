# Reconciliation Worker v0

Read-only worker that compares indexed trade state to on-chain trade state and persists drift findings.

## Features
- Read-only reconciliation (no on-chain writes)
- Idempotent run keys
- Drift persistence in Postgres (`reconcile_runs`, `reconcile_drifts`)
- Severity classification (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
- CLI entrypoints:
  - `npm run reconcile:once`
  - `npm run reconcile:daemon`

## Run
```bash
cp .env.example .env
npm install
npm run reconcile:once
```

Daemon mode is disabled by default. Set `RECONCILIATION_ENABLED=true` to run continuously.

Reconciliation requires a reachable `RPC_URL` at startup and fails fast with a clear error when the endpoint is unavailable.

## Healthcheck
After building, run:
```bash
npm run healthcheck
```

## Docker
See `docs/docker-services.md` for compose profiles, build/up/down/logs, and health verification.
