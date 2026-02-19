# Docker Service Profiles Runbook

This runbook covers containerized orchestration for these services:
- `oracle`
- `ricardian`
- `treasury`
- `reconciliation`
- profile-specific indexer services

`notifications` remains a library workspace (`@agroasys/notifications`), not a standalone runtime container.

## Profiles

### `local-dev`
Fast feedback mode with lightweight indexer responder (`indexer`).

### `staging-e2e`
Release-gate mode with indexer pipeline components:
- `indexer-migrate`
- `indexer-pipeline`
- `indexer-graphql`

### `infra`
Infra-only mode:
- `postgres`
- `redis`

## Environment Loading
`scripts/docker-services.sh` loads env files in this order:
1. `.env` (always)
2. profile override:
   - `.env.local` for `local-dev`
   - `.env.staging-e2e` for `staging-e2e`
   - `.env.infra` for `infra` (optional)

Setup from examples:

```bash
cp .env.example .env
cp .env.local.example .env.local
cp .env.staging-e2e.example .env.staging-e2e
```

## Commands

Local development:

```bash
scripts/docker-services.sh build local-dev
scripts/docker-services.sh up local-dev
scripts/docker-services.sh health local-dev
scripts/docker-services.sh logs local-dev reconciliation
scripts/docker-services.sh down local-dev
```

Staging E2E:

```bash
scripts/docker-services.sh build staging-e2e
scripts/docker-services.sh up staging-e2e
scripts/docker-services.sh health staging-e2e
scripts/staging-e2e-gate.sh
scripts/docker-services.sh logs staging-e2e reconciliation
scripts/docker-services.sh logs staging-e2e indexer-pipeline
scripts/docker-services.sh down staging-e2e
```

Infra only:

```bash
scripts/docker-services.sh up infra
scripts/docker-services.sh health infra
scripts/docker-services.sh down infra
```

## Health behavior
- Health checks validate the requested profile service set only.
- If services are missing, output includes:
  - compose file
  - expected running services
  - currently running services
  - next action command
- `infra` profile intentionally skips indexer GraphQL checks.

## Notes
- Inter-container calls use service DNS names (`postgres`, `indexer`, `indexer-graphql`), never `localhost`.
- Reconciliation startup remains fail-fast when `RPC_URL` is missing/unreachable.
- `staging-e2e` gate fails on ENS resolver errors, indexer fetch failures, schema mismatches, and lag threshold breaches.
