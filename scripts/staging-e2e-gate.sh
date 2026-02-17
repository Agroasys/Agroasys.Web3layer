#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.services.yml"
PROFILE="staging-e2e"

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

normalize_host_url() {
  local url="$1"
  echo "${url//host.docker.internal/127.0.0.1}"
}

load_env_file ".env"
load_env_file ".env.staging-e2e"

run_compose() {
  docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" "$@"
}

failures=0

pass() {
  echo "[PASS] $1"
}

fail() {
  echo "[FAIL] $1" >&2
  failures=$((failures + 1))
}

RECONCILIATION_STATUS="$(run_compose ps reconciliation --format json | tr -d '\n')"
if echo "$RECONCILIATION_STATUS" | grep -qi '"State":"running"' && echo "$RECONCILIATION_STATUS" | grep -qi '"Health":"healthy"'; then
  pass "reconciliation container is Up (healthy)"
else
  fail "reconciliation container is not healthy"
fi

echo "reconciliation status snapshot: ${RECONCILIATION_STATUS:-unavailable}"

INDEXER_GATEWAY_URL_HOST="${STAGING_E2E_GATE_INDEXER_GRAPHQL_URL:-http://127.0.0.1:${INDEXER_GRAPHQL_PORT:-4350}/graphql}"
RPC_GATEWAY_URL_HOST="$(normalize_host_url "${STAGING_E2E_GATE_RPC_URL:-${RECONCILIATION_RPC_URL:-}}")"

echo "indexer endpoint used (container): ${RECONCILIATION_INDEXER_GRAPHQL_URL:-unset}"
echo "indexer endpoint used (gate host): ${INDEXER_GATEWAY_URL_HOST}"

RECON_LOGS="$(run_compose logs --tail=400 reconciliation 2>&1 || true)"
if echo "$RECON_LOGS" | grep -Eqi 'getEnsAddress|resolveName'; then
  fail "ENS resolution errors found in reconciliation logs"
else
  pass "no ENS resolution errors in reconciliation logs"
fi

FETCH_FAILED_COUNT="$(echo "$RECON_LOGS" | grep -Eci 'fetch failed|Indexer request failed' || true)"
if [[ "$FETCH_FAILED_COUNT" -gt 0 ]]; then
  fail "reconciliation logs contain fetch/indexer failures (count=$FETCH_FAILED_COUNT)"
else
  pass "no fetch/indexer failure signatures in reconciliation logs"
fi

SCHEMA_RESPONSE="$(curl -fsS "${INDEXER_GATEWAY_URL_HOST}" \
  -H 'content-type: application/json' \
  --data '{"query":"{ __type(name:\"Trade\") { fields { name } } }"}' || true)"

required_fields=(
  tradeId
  buyer
  supplier
  status
  totalAmountLocked
  logisticsAmount
  platformFeesAmount
  supplierFirstTranche
  supplierSecondTranche
  ricardianHash
  createdAt
  arrivalTimestamp
)

schema_ok=1
for field in "${required_fields[@]}"; do
  if ! echo "$SCHEMA_RESPONSE" | grep -q "\"name\":\"$field\""; then
    schema_ok=0
    echo "missing GraphQL field: $field" >&2
  fi
done

if [[ "$schema_ok" -eq 1 ]]; then
  pass "indexer GraphQL schema has required reconciliation fields"
else
  fail "indexer GraphQL schema is missing required reconciliation fields"
fi

METADATA_RESPONSE="$(curl -fsS "${INDEXER_GATEWAY_URL_HOST}" \
  -H 'content-type: application/json' \
  --data '{"query":"{ squidStatus { height } }"}' || true)"
INDEXER_HEAD="$(echo "$METADATA_RESPONSE" | sed -n 's/.*"height"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n1)"

if [[ -z "$INDEXER_HEAD" ]]; then
  fail "indexer head metric unavailable from squidStatus.height"
else
  RPC_HEAD_HEX="$(curl -fsS "${RPC_GATEWAY_URL_HOST}" \
    -H 'content-type: application/json' \
    --data '{"id":1,"jsonrpc":"2.0","method":"eth_blockNumber","params":[]}' \
    | sed -n 's/.*"result":"\(0x[0-9a-fA-F]*\)".*/\1/p' | head -n1)"

  if [[ -z "$RPC_HEAD_HEX" ]]; then
    fail "chain head metric unavailable from RPC eth_blockNumber"
  else
    RPC_HEAD_DEC=$((RPC_HEAD_HEX))
    LAG=$((RPC_HEAD_DEC - INDEXER_HEAD))
    echo "lag/head metrics: rpcHead=${RPC_HEAD_DEC}, indexerHead=${INDEXER_HEAD}, lag=${LAG}"
    MAX_LAG="${STAGING_E2E_MAX_INDEXER_LAG_BLOCKS:-500}"
    if [[ "$LAG" -lt 0 ]]; then
      fail "indexer lag is negative (lag=${LAG}); RPC and indexer may be on different chains"
    elif [[ "$LAG" -le "$MAX_LAG" ]]; then
      pass "indexer lag is within threshold (${LAG} <= ${MAX_LAG})"
    else
      fail "indexer lag exceeds threshold (${LAG} > ${MAX_LAG})"
    fi
  fi
fi

DRIFT_LIMIT="${STAGING_E2E_DRIFT_SUMMARY_LIMIT:-10}"
DRIFT_SUMMARY="$(run_compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${RECONCILIATION_DB_NAME}" -Atc \
  "SELECT mismatch_code || ':' || COUNT(*) FROM reconcile_drifts GROUP BY mismatch_code ORDER BY COUNT(*) DESC LIMIT ${DRIFT_LIMIT};" 2>/dev/null || true)"

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
