# Docker Services Runbook

This runbook covers container orchestration for the Web3 service layer.

## Profiles

- `local`: fast local development with a lightweight indexer GraphQL responder.
- `staging-e2e`: release-gate profile using the real indexer pipeline (`indexer-pipeline` + `indexer-graphql`).
- `infra`: Postgres + Redis only.

## Environment setup

1. Copy base defaults:

```bash
cp .env.example .env
```

2. Copy profile overrides:

```bash
cp .env.local.example .env.local
cp .env.staging-e2e.example .env.staging-e2e
```

## Local profile

```bash
scripts/docker-services.sh up local
scripts/docker-services.sh health local
scripts/docker-services.sh logs local reconciliation
```

Expected healthy output includes:
- `ricardian health endpoint: ok`
- `treasury health endpoint: ok`
- `oracle health endpoint: ok`
- `reconciliation healthcheck: ok`
- `indexer graphql endpoint: ok (indexer)`

## Staging-e2e profile

```bash
scripts/docker-services.sh up staging-e2e
scripts/docker-services.sh health staging-e2e
scripts/docker-services.sh logs staging-e2e indexer-graphql
scripts/docker-services.sh logs staging-e2e reconciliation
```

Expected healthy output includes:
- `indexer graphql endpoint: ok (indexer-graphql)`
- reconciliation service running and passing healthcheck
- no recurring `getEnsAddress`, `resolveName`, or indexer `fetch failed` errors in reconciliation logs

## Infra profile

```bash
scripts/docker-services.sh up infra
scripts/docker-services.sh health infra
```

## Stop and clean volumes

```bash
scripts/docker-services.sh down local
scripts/docker-services.sh down staging-e2e
scripts/docker-services.sh down infra
```

## Failure triage

1. `required service is not running`: inspect service logs with `scripts/docker-services.sh logs <profile> <service>`.
2. `indexer graphql endpoint failed`: verify profile-specific `INDEXER_GRAPHQL_URL` and indexer service health.
3. Reconciliation exits early: verify `RECONCILIATION_RPC_URL` is reachable and addresses are valid `0x` addresses.
4. Oracle startup failure: verify `ORACLE_PRIVATE_KEY`, `ORACLE_ESCROW_ADDRESS`, and DB credentials in profile env files.
