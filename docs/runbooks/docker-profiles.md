# Docker Profiles Runbook

## Purpose
Operate service containers with deterministic commands for build, startup, health checks, and logs.

## Pre-checks
- Docker Engine + Compose plugin are installed.
- Env files exist in `env/`:
```bash
cp env/postgres.env.example env/postgres.env
cp env/ricardian.env.example env/ricardian.env
cp env/treasury.env.example env/treasury.env
cp env/reconciliation.env.example env/reconciliation.env
```

## Exact Commands
1. Build all services:
```bash
scripts/docker-services.sh build all
```
2. Start all services:
```bash
scripts/docker-services.sh up all
```
3. Health check:
```bash
scripts/docker-services.sh health all
```
4. List running containers:
```bash
scripts/docker-services.sh ps all
```
5. Tail logs:
```bash
scripts/docker-services.sh logs all
```
6. Stop stack:
```bash
scripts/docker-services.sh down all
```

## Expected Outputs
- `health all` prints `ricardian ready endpoint: ok`, `treasury ready endpoint: ok`, and `reconciliation healthcheck: ok` when those services are running.
- `ps all` shows running containers for configured services.

## Failure Modes
- Missing env file values cause startup failure in config validation.
- `postgres` not healthy blocks dependent services.
- Reconciliation fails fast if `RPC_URL` or `INDEXER_GRAPHQL_URL` is unreachable.

## Rollback Steps
1. Stop stack:
```bash
scripts/docker-services.sh down all
```
2. Revert to last known-good env values in `env/*.env`.
3. Restart and re-check health.

## Escalation Cues
- Persistent service restart loops.
- Reconciliation healthcheck failures after dependency recovery.
- Database migrations repeatedly failing at startup.
