# Docker Profiles Runbook

## Purpose
Operate service containers with deterministic profile-aware commands for build, startup, health checks, and logs.

## Preconditions
- Docker Engine + Compose plugin installed.
- Root env files created:

```bash
cp .env.example .env
cp .env.local.example .env.local
cp .env.staging-e2e.example .env.staging-e2e
```

## Profile commands

### local-dev

```bash
scripts/docker-services.sh build local-dev
scripts/docker-services.sh up local-dev
scripts/docker-services.sh health local-dev
scripts/docker-services.sh ps local-dev
scripts/docker-services.sh logs local-dev reconciliation
scripts/docker-services.sh down local-dev
```

### staging-e2e

```bash
scripts/docker-services.sh build staging-e2e
scripts/docker-services.sh up staging-e2e
scripts/docker-services.sh health staging-e2e
scripts/staging-e2e-gate.sh
scripts/docker-services.sh ps staging-e2e
scripts/docker-services.sh logs staging-e2e indexer-pipeline
scripts/docker-services.sh down staging-e2e
```

### infra

```bash
scripts/docker-services.sh up infra
scripts/docker-services.sh health infra
scripts/docker-services.sh ps infra
scripts/docker-services.sh down infra
```

## Expected outputs
- `health local-dev` reports `ricardian`, `treasury`, `oracle`, and `reconciliation` health plus indexer GraphQL reachability.
- `health staging-e2e` reports the same service health with staging indexer components.
- `health infra` validates only infra services and skips indexer GraphQL checks.

## Common failures and fixes
- Missing required services:
  - Run `scripts/docker-services.sh up <profile>` for the same profile.
  - If mixed profiles are running, stop conflicting stack first:
    `scripts/docker-services.sh down staging-e2e` or `scripts/docker-services.sh down local-dev`.
- Reconciliation fails fast:
  - verify `RECONCILIATION_RPC_URL` and `RECONCILIATION_INDEXER_GRAPHQL_URL` in active env files.

## Rollback
1. Stop affected profile:
```bash
scripts/docker-services.sh down <profile>
```
2. Revert last infra/config commit.
3. Bring profile back up and re-run `health`.

## Escalation
Escalate when:
- repeated restart loops continue after env and dependency checks
- reconciliation healthcheck fails after dependency recovery
- indexer pipeline does not produce healthy GraphQL endpoint in staging-e2e
