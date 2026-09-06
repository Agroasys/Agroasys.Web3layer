# Runtime Stack Runbook

## Purpose

Run deterministic build/start/health/log actions for the Cotsel runtime stack.
There is a single compose profile (`runtime`) and a single env file
(`.env.runtime`); the same stack runs for local development and VM deployment —
only the values in `.env.runtime` differ. Production launch criteria are defined
in `docs/runbooks/production-readiness-checklist.md`.

The loader treats `.env.runtime` as data, never shell code. It rejects duplicate
or unknown keys, shell expansion syntax, and inherited overrides. Successful
validation prints a SHA-256 identity of the sorted, redacted configuration.
Secret values are represented only as present or empty in that identity.

## Services

The `runtime` profile starts the full protocol: `postgres`, `redis`, the split
indexer pipeline (`indexer-migrate`, `indexer-pipeline`, `indexer-graphql`),
`ricardian`, `auth`, `gateway`, `treasury`, `oracle`, and `reconciliation`.

## Preconditions

```bash
cp .env.runtime.example .env.runtime   # then fill in every value
```

Keep `NODE_ENV=development` and `COTSEL_ENVIRONMENT=local` for local Compose.
AWS staging uses `NODE_ENV=production` and `COTSEL_ENVIRONMENT=staging` so that
production security defaults remain active without mislabeling the environment.

`scripts/cotsel.sh build|up|health|config` runs `scripts/validate-env.sh`
before invoking Docker Compose. If `.env.runtime` is missing or incomplete,
startup fails before Compose renders blank interpolated values. Set
`DOCKER_SERVICES_SKIP_ENV_PRECHECK=true` only for script tests that intentionally
bypass the env precheck.

## Commands

```bash
scripts/cotsel.sh build              # build images (all, or one service)
scripts/cotsel.sh up                 # validate env + start the stack
scripts/cotsel.sh health             # wait for + probe service health
scripts/cotsel.sh logs reconciliation
scripts/cotsel.sh down               # stop + remove containers (data volumes preserved)
scripts/cotsel.sh reset              # stop + remove containers AND volumes (wipes Postgres/Redis)

# Full validated deploy (VM): single-source env guard + validate + build + gate
scripts/cotsel.sh up --gate
```

## Expected outputs

- `health` verifies every required runtime service.
- Indexer GraphQL readiness is verified.
- Reconciliation healthcheck passes when the DB is reachable.
- `health` includes notification wiring checks.

## Failure modes

- `required service is not running`: startup failure or missing env values.
- `indexer graphql endpoint failed`: indexer service not ready.
- `reconciliation healthcheck` failure: DB/auth/config mismatch.
- `notifications wiring health` failure: notification runtime keys are missing/invalid in `.env.runtime`.
- `strict runtime environment rejected`: remove the reported duplicate, unknown,
  executable, or inherited value. Do not work around it with an exported override.

## Rollback

1. Stop the stack:

```bash
scripts/cotsel.sh down
```

2. Restore the last reviewed `.env.runtime` file and verify its recorded redacted
   configuration digest.
3. Re-run `scripts/cotsel.sh up` and `scripts/cotsel.sh health`.

## Related

- Cotsel CLI reference: `docs/cotsel-cli.md`
- Runtime release gate: `docs/runbooks/runtime-release-gate.md`
- Production readiness checklist: `docs/runbooks/production-readiness-checklist.md`
