#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.services.yml"
ACTION="${1:-}"
PROFILE="${2:-}"
SERVICE="${3:-}"

usage() {
  cat >&2 <<USAGE
Usage: scripts/docker-services.sh <build|up|down|logs|ps|health> <local|staging-e2e|infra> [service]
Examples:
  scripts/docker-services.sh up local
  scripts/docker-services.sh health staging-e2e
  scripts/docker-services.sh logs local reconciliation
USAGE
}

if [[ -z "$ACTION" || -z "$PROFILE" ]]; then
  usage
  exit 1
fi

case "$PROFILE" in
  local|staging-e2e|infra)
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
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

load_env_file ".env"
if [[ "$PROFILE" == "local" ]]; then
  load_env_file ".env.local"
elif [[ "$PROFILE" == "staging-e2e" ]]; then
  load_env_file ".env.staging-e2e"
fi

run_compose() {
  docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" "$@"
}

is_running() {
  local service_name="$1"
  run_compose ps --services --filter status=running | grep -qx "$service_name"
}

check_http_health() {
  local name="$1"
  local url="$2"

  if curl -fsS "$url" >/dev/null; then
    echo "$name health endpoint: ok"
    return 0
  fi

  echo "$name health endpoint failed: $url" >&2
  return 1
}

check_required_services() {
  local required_services=()

  case "$PROFILE" in
    local)
      required_services=(postgres redis indexer oracle reconciliation ricardian treasury)
      ;;
    staging-e2e)
      required_services=(postgres redis indexer-db indexer-pipeline indexer-graphql oracle reconciliation ricardian treasury)
      ;;
    infra)
      required_services=(postgres redis)
      ;;
  esac

  for service_name in "${required_services[@]}"; do
    if ! is_running "$service_name"; then
      echo "required service is not running: $service_name" >&2
      return 1
    fi
  done

  return 0
}

check_indexer_graphql() {
  local service_name="$1"
  local graphql_port="${INDEXER_GRAPHQL_PORT:-4350}"

  run_compose exec -T "$service_name" node -e "fetch('http://127.0.0.1:${graphql_port}/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query { __typename }' }) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
  echo "indexer graphql endpoint: ok (${service_name})"
}

wait_for_indexer_graphql() {
  local service_name="$1"
  local max_attempts="${2:-30}"
  local sleep_seconds="${3:-2}"

  local attempt=1
  while [[ "$attempt" -le "$max_attempts" ]]; do
    if check_indexer_graphql "$service_name" >/dev/null 2>&1; then
      echo "indexer graphql endpoint: ok (${service_name})"
      return 0
    fi

    sleep "$sleep_seconds"
    attempt=$((attempt + 1))
  done

  echo "indexer graphql endpoint failed after ${max_attempts} attempts (${service_name})" >&2
  return 1
}

start_local() {
  run_compose up -d postgres redis indexer ricardian treasury oracle
  wait_for_indexer_graphql indexer
  run_compose up -d reconciliation
}

start_staging() {
  run_compose up -d postgres redis indexer-db indexer-pipeline indexer-graphql ricardian treasury oracle
  wait_for_indexer_graphql indexer-graphql
  run_compose up -d reconciliation
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
    case "$PROFILE" in
      local)
        start_local
        ;;
      staging-e2e)
        start_staging
        ;;
      infra)
        run_compose up -d postgres redis
        ;;
    esac
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
      run_compose exec -T reconciliation node reconciliation/dist/healthcheck.js >/dev/null
      echo "reconciliation healthcheck: ok"
    fi

    case "$PROFILE" in
      local)
        check_indexer_graphql indexer
        ;;
      staging-e2e)
        check_indexer_graphql indexer-graphql
        ;;
      infra)
        echo "indexer graphql endpoint: skipped for infra profile"
        ;;
    esac
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    usage
    exit 1
    ;;
esac
