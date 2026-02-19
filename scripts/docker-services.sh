#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.services.yml"
ACTION="${1:-}"
PROFILE="${2:-}"
SERVICE="${3:-}"
HEALTH_RETRIES="${DOCKER_SERVICES_HEALTH_RETRIES:-15}"
HEALTH_RETRY_DELAY_SECONDS="${DOCKER_SERVICES_HEALTH_RETRY_DELAY_SECONDS:-2}"

usage() {
  echo "Usage: scripts/docker-services.sh <build|up|down|logs|ps|health|config> <local-dev|staging-e2e|staging-e2e-real|infra> [service]" >&2
}

if [[ -z "$ACTION" || -z "$PROFILE" ]]; then
  usage
  exit 1
fi

case "$PROFILE" in
  local-dev|staging-e2e|staging-e2e-real|infra)
    ;;
  *)
    echo "Unsupported profile: $PROFILE" >&2
    usage
    exit 1
    ;;
esac

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local preserved_keys=()
    local preserved_values=()
    local line=""

    while IFS= read -r line; do
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

      local key="${line%%=*}"
      if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        continue
      fi

      if [[ -n "${!key+x}" ]]; then
        preserved_keys+=("$key")
        preserved_values+=("${!key}")
      fi
    done < "$file"

    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a

    local idx=0
    for key in "${preserved_keys[@]}"; do
      export "$key=${preserved_values[$idx]}"
      idx=$((idx + 1))
    done
  fi
}

load_env_file ".env"
if [[ "$PROFILE" == "local-dev" ]]; then
  load_env_file ".env.local"
else
  load_env_file ".env.${PROFILE}"
fi

run_compose() {
  docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" "$@"
}

is_running() {
  local service_name="$1"
  run_compose ps --services --filter status=running | grep -qx "$service_name"
}

with_retries() {
  local label="$1"
  local attempt=1

  shift

  while (( attempt <= HEALTH_RETRIES )); do
    if "$@"; then
      return 0
    fi

    if (( attempt == HEALTH_RETRIES )); then
      echo "$label failed after ${HEALTH_RETRIES} attempt(s)" >&2
      return 1
    fi

    sleep "$HEALTH_RETRY_DELAY_SECONDS"
    ((attempt += 1))
  done

  return 1
}

check_http_health_once() {
  local url="$1"
  curl -fsS "$url" >/dev/null
}

check_http_health() {
  local name="$1"
  local url="$2"

  if with_retries "$name health endpoint" check_http_health_once "$url"; then
    echo "$name health endpoint: ok"
    return 0
  fi

  echo "$name health endpoint failed: $url" >&2
  return 1
}

check_required_services() {
  local required_services=()

  case "$PROFILE" in
    local-dev)
      required_services=(postgres indexer oracle reconciliation ricardian treasury)
      ;;
    staging-e2e|staging-e2e-real)
      required_services=(postgres indexer-pipeline indexer-graphql oracle reconciliation ricardian treasury)
      ;;
    infra)
      required_services=(postgres redis)
      ;;
  esac

  for service_name in "${required_services[@]}"; do
    if ! is_running "$service_name"; then
      echo "required service is not running: $service_name" >&2
      echo "profile=$PROFILE compose=$COMPOSE_FILE" >&2
      echo "expected=${required_services[*]}" >&2
      echo "running=$(run_compose ps --services --filter status=running | tr '\n' ' ')" >&2
      return 1
    fi
  done

  return 0
}

check_indexer_graphql_once() {
  local graphql_port="$1"
  local graphql_path="/graphql"

  case "$PROFILE" in
    local-dev)
      if is_running "indexer"; then
        run_compose exec -T indexer node -e "fetch('http://127.0.0.1:${graphql_port}${graphql_path}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query { __typename }' }) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
        return 0
      fi
      ;;
    staging-e2e|staging-e2e-real)
      if is_running "indexer-graphql"; then
        run_compose exec -T indexer-graphql node -e "fetch('http://127.0.0.1:${graphql_port}${graphql_path}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query { __typename }' }) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
        return 0
      fi
      ;;
  esac

  if is_running "indexer-graphql"; then
    run_compose exec -T indexer-graphql node -e "fetch('http://127.0.0.1:${graphql_port}${graphql_path}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query { __typename }' }) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
    return 0
  fi

  if is_running "indexer"; then
    run_compose exec -T indexer node -e "fetch('http://127.0.0.1:${graphql_port}${graphql_path}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query { __typename }' }) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
    return 0
  fi

  return 1
}

check_indexer_graphql() {
  local graphql_port="${INDEXER_GRAPHQL_PORT:-4350}"

  if with_retries "indexer graphql endpoint" check_indexer_graphql_once "$graphql_port"; then
    if [[ "$PROFILE" == "local-dev" ]]; then
      echo "indexer graphql endpoint: ok (indexer)"
    else
      echo "indexer graphql endpoint: ok (indexer-graphql)"
    fi
    return 0
  fi

  echo "indexer graphql endpoint check failed" >&2
  return 1
}

check_reconciliation_health_once() {
  run_compose exec -T reconciliation node reconciliation/dist/healthcheck.js >/dev/null
}

case "$ACTION" in
  build)
    if [[ -n "$SERVICE" ]]; then
      run_compose build "$SERVICE"
    else
      run_compose build
    fi
    ;;
  up)
    run_compose up -d
    ;;
  down)
    run_compose down -v
    ;;
  logs)
    if [[ -n "$SERVICE" ]]; then
      run_compose logs --tail=200 "$SERVICE"
    else
      run_compose logs --tail=200
    fi
    ;;
  ps)
    run_compose ps
    ;;
  config)
    run_compose config
    ;;
  health)
    run_compose ps
    check_required_services

    if is_running "ricardian"; then
      check_http_health "ricardian" "http://127.0.0.1:${RICARDIAN_PORT:-3100}/api/ricardian/v1/health"
    fi

    if is_running "treasury"; then
      check_http_health "treasury" "http://127.0.0.1:${TREASURY_PORT:-3200}/api/treasury/v1/health"
    fi

    if is_running "oracle"; then
      check_http_health "oracle" "http://127.0.0.1:${ORACLE_PORT:-3001}/api/oracle/health"
    fi

    if is_running "reconciliation"; then
      with_retries "reconciliation healthcheck" check_reconciliation_health_once
      echo "reconciliation healthcheck: ok"
    fi

    if [[ "$PROFILE" != "infra" ]]; then
      check_indexer_graphql
    else
      echo "indexer graphql endpoint: skipped for infra profile"
    fi
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    usage
    exit 1
    ;;
esac
