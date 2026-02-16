# Service Containers Runbook

This runbook covers containerized local orchestration for:
- `ricardian`
- `treasury`
- `reconciliation`

`notifications` is currently a library workspace (`@agroasys/notifications`), not a standalone runtime service, so no dedicated container is created.

## Prerequisites
- Docker Engine with Compose plugin (`docker compose`)

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
