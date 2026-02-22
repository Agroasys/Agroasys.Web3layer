# Pilot Environment Onboarding

## Purpose
Provide a deterministic onboarding and go/no-go procedure for the `staging-e2e-real` pilot environment.

## Who This Is For
- `Operator`: executes environment bring-up, health checks, and evidence capture.
- `On-call Engineer`: handles runtime failures and escalation decisions.
- `Pilot Owner`: approves go/no-go decision for pilot activity.

## When To Use
- Before pilot execution windows.
- After environment resets or config changes.
- During incident recovery when pilot readiness must be re-established.

## Scope
- Environment initialization, validation, bring-up, health checks, and release-gate dry run.
- Verification of indexer, reconciliation, oracle, and treasury integration readiness.
- Pilot go/no-go decision and audit evidence capture.

## Non-Scope
- Contract deployments or governance changes.
- Production rollout approvals.
- KPI/case-study package content (tracked by separate roadmap items).

## Pilot Checklist
- Required roles confirmed:
  - `Operator`
  - `On-call Engineer`
  - `Pilot Owner`
- Required contract addresses set in `.env.staging-e2e-real`:
  - `RECONCILIATION_ESCROW_ADDRESS`
  - `RECONCILIATION_USDC_ADDRESS`
  - `ORACLE_ESCROW_ADDRESS`
  - `ORACLE_USDC_ADDRESS`
  - `INDEXER_CONTRACT_ADDRESS`
- Oracle routing configured:
  - `ORACLE_RPC_URL`
  - `ORACLE_INDEXER_GRAPHQL_URL`
  - `ORACLE_CHAIN_ID`
- Reconciliation routing configured:
  - `RECONCILIATION_RPC_URL`
  - `RECONCILIATION_INDEXER_GRAPHQL_URL`
  - `RECONCILIATION_CHAIN_ID`
- Indexer routing configured:
  - `INDEXER_GATEWAY_URL`
  - `INDEXER_RPC_ENDPOINT`
  - `INDEXER_START_BLOCK`

## Prerequisites
- Docker Engine + Compose plugin installed.
- Node 20 available for local parity checks.
- Repository root env files present.

## Procedure

### 1. Initialize environment files
```bash
cp .env.example .env
cp .env.staging-e2e-real.example .env.staging-e2e-real
```

Set pilot addresses/chain config in `.env.staging-e2e-real` before proceeding.

Expected result:
- `.env` and `.env.staging-e2e-real` exist with pilot-specific values.

If not:
- Stop and fix env files before running validation or Docker commands.

### 2. Validate env deterministically
```bash
scripts/validate-env.sh staging-e2e-real
```

Expected result:
- Output includes `env validation passed for profile: staging-e2e-real`.

If not:
- Fix missing keys reported by the script.
- Re-run until validation passes.

### 3. Bring up pilot profile and verify health
```bash
scripts/docker-services.sh down staging-e2e-real || true
scripts/docker-services.sh up staging-e2e-real
scripts/docker-services.sh health staging-e2e-real
```

Expected result:
- Required services are running and healthy:
  - `postgres`, `redis`
  - `indexer-pipeline`, `indexer-graphql`
  - `oracle`, `reconciliation`, `ricardian`, `treasury`

If not:
- Capture logs and fix startup/health failures before continuing:

```bash
scripts/docker-services.sh logs staging-e2e-real indexer-graphql
scripts/docker-services.sh logs staging-e2e-real oracle
scripts/docker-services.sh logs staging-e2e-real reconciliation
scripts/docker-services.sh logs staging-e2e-real treasury
```

### 4. Run staging gate dry run
```bash
scripts/staging-e2e-real-gate.sh
```

Expected result:
- Gate reports schema parity, lag metrics, reorg/resync probe, reconciliation run summary, and drift snapshot.

If not:
- Follow `docs/runbooks/staging-e2e-real-release-gate.md` failure modes.
- Do not start pilot activity while gate is red.

### 5. Verify DB population and reconciliation evidence
Load env values into shell:

```bash
set -a
source .env
source .env.staging-e2e-real
set +a
```

Check indexer trade events are present:

```bash
docker compose -f docker-compose.services.yml --profile staging-e2e-real exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${INDEXER_DB_NAME}" -Atc "SELECT COUNT(*) FROM trade_event;"
```

Check reconciliation runs table has rows:

```bash
docker compose -f docker-compose.services.yml --profile staging-e2e-real exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${RECONCILIATION_DB_NAME}" -Atc "SELECT COUNT(*) FROM reconcile_runs;"
```

Expected result:
- Both queries return non-zero counts for an environment with indexed data and at least one reconciliation run.

If not:
- Re-check contract/start-block scope and gate output.
- Re-run gate after indexer readiness is restored.

### 6. Verify oracle/reconciliation runtime signals
Capture logs:

```bash
scripts/docker-services.sh logs staging-e2e-real oracle
scripts/docker-services.sh logs staging-e2e-real reconciliation
```

Expected result:
- Oracle logs show trigger processing paths for active pilot activity.
- Reconciliation logs show successful run completion and no unresolved critical drift patterns.

If not:
- Escalate using `docs/runbooks/oracle-redrive.md` and `docs/runbooks/reconciliation.md`.

### 7. Verify retry/timeout ceilings are configured
```bash
rg -n "ORACLE_RETRY_ATTEMPTS|ORACLE_RETRY_DELAY|STAGING_E2E_REAL_LAG_WARMUP_SECONDS|STAGING_E2E_REAL_LAG_POLL_SECONDS|STAGING_E2E_MAX_INDEXER_LAG_BLOCKS" .env .env.staging-e2e-real
```

Expected result:
- Retry and lag thresholds are explicitly set and match approved pilot profile.

If not:
- Do not approve go/no-go until ceilings are set.

## Go/No-Go Criteria
Go only when all are true:
- `scripts/validate-env.sh staging-e2e-real` passed.
- `scripts/docker-services.sh health staging-e2e-real` passed.
- `scripts/staging-e2e-real-gate.sh` passed.
- Indexer and reconciliation DB checks show expected non-empty pilot evidence.
- Oracle and reconciliation logs show healthy runtime behavior.
- Retry/timeout ceiling values are explicitly configured and reviewed.

No-go if any criterion fails:
- Freeze pilot activity.
- Open incident with captured logs/queries and assign on-call owner.

## Evidence To Record
- Command transcript for env validation, health, and gate.
- DB query outputs (`trade_event`, `reconcile_runs` counts).
- Oracle/reconciliation log excerpts for pilot window.
- Config snapshot for retry/lag ceilings.
- Final go/no-go decision with approver identity and timestamp.

## Failure Handling
- Env validation failure:
  - Correct missing/empty keys, then re-run validation.
- Health check failure:
  - Capture service logs, restart from clean profile, and re-check.
- Gate failure:
  - Use failure-mode guidance in `docs/runbooks/staging-e2e-real-release-gate.md`.
- Data population failure:
  - Re-check start block, contract address scope, and indexer head progress.

## Rollback / Escalation
1. Stop pilot profile if correctness is uncertain:

```bash
scripts/docker-services.sh down staging-e2e-real
```

2. Capture evidence bundle (logs, DB query outputs, gate output).
3. Run `docs/incidents/first-15-minutes-checklist.md` for severe incidents.
4. Escalate to:
  - `Pilot Owner` (TODO(Ops): fill named owner/contact channel)
  - `On-call Engineer` (TODO(Ops): fill rotation/channel)
  - `Service Owner` (TODO(Ops): fill escalation path)

## Related Runbooks
- `docs/runbooks/staging-e2e-real-release-gate.md`
- `docs/runbooks/docker-profiles.md`
- `docs/runbooks/reconciliation.md`
- `docs/runbooks/oracle-redrive.md`
