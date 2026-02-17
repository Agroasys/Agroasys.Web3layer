# Reconciliation Runbook

## Purpose
Operate reconciliation safely in local/staging and diagnose drift failures.

## Preconditions
- Postgres is reachable.
- Reconciliation env vars are set (`RECONCILIATION_RPC_URL`, `RECONCILIATION_INDEXER_GRAPHQL_URL`, addresses).
- RPC endpoint is reachable from runtime.

## Commands

Run once:

```bash
npm run -w reconciliation reconcile:once
```

Run daemon:

```bash
npm run -w reconciliation reconcile:daemon
```

Docker local profile:

```bash
scripts/docker-services.sh up local
scripts/docker-services.sh health local
scripts/docker-services.sh logs local reconciliation
```

## Expected outputs
- `Starting reconciliation worker`
- `Validating RPC endpoint for reconciliation startup`
- `Reconciliation run completed`

## Common failure patterns
- `RPC endpoint is unreachable`: bad RPC URL, local node not running, or network ACL.
- `INDEXER_GRAPHQL_URL is missing`: profile env not loaded.
- Address validation errors: malformed `ESCROW_ADDRESS` or `USDC_ADDRESS`.

## Rollback / backout
1. Stop daemon:

```bash
scripts/docker-services.sh down local
```

2. Revert to previous env profile values.
3. Re-run one-shot reconciliation after fix.

## Escalation criteria
- Repeated CRITICAL drifts for the same trade across 3+ runs.
- On-chain read failures for >10% of trades in one run.
- Inability to reach RPC for >15 minutes.
