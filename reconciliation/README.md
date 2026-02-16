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
