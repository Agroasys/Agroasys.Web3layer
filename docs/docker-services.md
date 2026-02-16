# Service Containers Runbook

This runbook covers containerized local orchestration for:
- `ricardian`
- `treasury`
- `reconciliation`

`notifications` is currently a library workspace (`@agroasys/notifications`), not a standalone runtime service, so no dedicated container is created.

## Prerequisites
- Docker Engine with Compose plugin (`docker compose`)

## Configure Env Files
Copy service env templates before starting compose:

```bash
cp env/postgres.env.example env/postgres.env
cp env/ricardian.env.example env/ricardian.env
cp env/treasury.env.example env/treasury.env
cp env/reconciliation.env.example env/reconciliation.env
```

## Build Images
```bash
scripts/docker-services.sh build all
```

Profile-scoped builds:
```bash
scripts/docker-services.sh build ricardian
scripts/docker-services.sh build treasury
scripts/docker-services.sh build reconciliation
```

## Start Services
```bash
scripts/docker-services.sh up all
```

Infrastructure only:
```bash
scripts/docker-services.sh up infra
```

## Stop Services
```bash
scripts/docker-services.sh down all
```

## Logs
```bash
scripts/docker-services.sh logs all
```

## Health Verification
```bash
scripts/docker-services.sh health all
```

Manual checks:
```bash
curl -fsS http://127.0.0.1:3100/api/ricardian/v1/health
curl -fsS http://127.0.0.1:3200/api/treasury/v1/health
```

## Notes
- Containers run as non-root users.
- Config validation remains fail-fast on startup in each service.
- Reconciliation uses a process-level healthcheck command (`node reconciliation/dist/healthcheck.js`).
- Postgres bootstraps service-specific databases on first initialization (`agroasys_ricardian`, `agroasys_treasury`, `agroasys_reconciliation`) via `postgres/init/10-service-databases.sql`.
- Reconciliation startup requires a reachable `RPC_URL` (for example `http://host.docker.internal:8545` when your local RPC runs on host). If RPC is unavailable, reconciliation fails fast with an explicit startup error.
- Reconciliation logs redact `RPC_URL` credentials and query strings; only protocol + host are emitted.
