#!/usr/bin/env bash
set -euo pipefail

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

load_env_file ".env"
load_env_file ".env.staging-e2e"

COMPOSE_FILE="docker-compose.services.yml"
PROFILE="staging-e2e"
failures=0

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1" >&2
  failures=$((failures + 1))
}

run_compose() {
  docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" "$@"
}

is_running() {
  local service_name="$1"
  run_compose ps --services --filter status=running | grep -qx "$service_name"
}

if ! scripts/docker-services.sh health staging-e2e; then
  fail "profile health check failed"
else
  pass "profile health check passed"
fi

if is_running reconciliation; then
  pass "reconciliation is running"
else
  fail "reconciliation is not running"
fi

RECON_LOGS="$(run_compose logs --tail=300 reconciliation 2>/dev/null || true)"
if echo "$RECON_LOGS" | grep -E "getEnsAddress|resolveName" >/dev/null; then
  fail "reconciliation logs contain ENS resolution errors"
else
  pass "no ENS resolution errors in reconciliation logs"
fi

if echo "$RECON_LOGS" | grep -E "fetch failed" >/dev/null; then
  fail "reconciliation logs contain recurring fetch failed"
else
  pass "no recurring fetch failed in reconciliation logs"
fi

GRAPHQL_PORT="${INDEXER_GRAPHQL_PORT:-4350}"
SCHEMA_CHECK="$(run_compose exec -T indexer-graphql node -e "fetch('http://127.0.0.1:${GRAPHQL_PORT}/graphql', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({query: 'query { trades(limit: 1, offset: 0) { tradeId buyer supplier status totalAmountLocked logisticsAmount platformFeesAmount supplierFirstTranche supplierSecondTranche ricardianHash createdAt arrivalTimestamp } }'})}).then(async r => { const body = await r.json(); if (!r.ok || body.errors) { process.exit(1); } process.exit(0); }).catch(() => process.exit(1));" && echo ok || echo fail)"
if [[ "$SCHEMA_CHECK" == "ok" ]]; then
  pass "indexer GraphQL schema supports reconciliation fields"
else
  fail "indexer GraphQL schema mismatch for reconciliation query fields"
fi

INDEXER_HEAD_RAW="$(run_compose exec -T indexer-graphql node -e "fetch('http://127.0.0.1:${GRAPHQL_PORT}/graphql', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({query: 'query { squidStatus { height } }'})}).then(async r => { const body = await r.json(); const height = body?.data?.squidStatus?.height; if (height === undefined || height === null) { process.exit(1); } process.stdout.write(String(height)); }).catch(() => process.exit(1));" 2>/dev/null || true)"

if [[ -z "$INDEXER_HEAD_RAW" ]]; then
  fail "indexer lag/head metric unavailable"
else
  RPC_URL="${RECONCILIATION_RPC_URL:-}"
  if [[ -z "$RPC_URL" ]]; then
    fail "RECONCILIATION_RPC_URL missing for lag/head check"
  else
    RPC_HEAD_HEX="$(curl -fsS "$RPC_URL" -H 'content-type: application/json' --data '{"id":1,"jsonrpc":"2.0","method":"eth_blockNumber","params":[]}' | sed -n 's/.*"result":"\(0x[0-9a-fA-F]*\)".*/\1/p' | head -n1)"
    if [[ -z "$RPC_HEAD_HEX" ]]; then
      fail "rpc head metric unavailable"
    else
      RPC_HEAD_DEC=$((RPC_HEAD_HEX))
      INDEXER_HEAD_DEC=$((INDEXER_HEAD_RAW))
      LAG=$((RPC_HEAD_DEC - INDEXER_HEAD_DEC))
      MAX_LAG="${STAGING_E2E_MAX_INDEXER_LAG_BLOCKS:-500}"
      echo "lag/head metrics: rpcHead=${RPC_HEAD_DEC}, indexerHead=${INDEXER_HEAD_DEC}, lag=${LAG}"

      if [[ "$LAG" -lt 0 ]]; then
        fail "negative lag detected; RPC and indexer may be on different chains"
      elif [[ "$LAG" -le "$MAX_LAG" ]]; then
        pass "indexer lag is within threshold (${LAG} <= ${MAX_LAG})"
      else
        fail "indexer lag exceeds threshold (${LAG} > ${MAX_LAG})"
      fi
    fi
  fi
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
RECON_DB="${RECONCILIATION_DB_NAME:-agroasys_reconciliation}"
DRIFT_LIMIT="${STAGING_E2E_DRIFT_SUMMARY_LIMIT:-10}"
DRIFT_SUMMARY="$(run_compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${RECON_DB}" -Atc "SELECT mismatch_code || ':' || COUNT(*) FROM reconcile_drifts GROUP BY mismatch_code ORDER BY COUNT(*) DESC LIMIT ${DRIFT_LIMIT};" 2>/dev/null || true)"

echo "drift classification snapshot:"
if [[ -n "$DRIFT_SUMMARY" ]]; then
  echo "$DRIFT_SUMMARY"
else
  echo "(no drift rows)"
fi

if [[ "$failures" -gt 0 ]]; then
  echo "staging-e2e gate failed with ${failures} check(s) failing" >&2
  exit 1
fi

echo "staging-e2e gate passed"
