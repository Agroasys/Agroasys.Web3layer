#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.services.yml"
ACTION="${1:-}"
PROFILE="${2:-}"
SERVICE="${3:-}"
HEALTH_RETRIES="${DOCKER_SERVICES_HEALTH_RETRIES:-15}"
HEALTH_RETRY_DELAY_SECONDS="${DOCKER_SERVICES_HEALTH_RETRY_DELAY_SECONDS:-2}"

usage() {
  echo "Usage: scripts/docker-services.sh <build|up|down|logs|ps|health> <local-dev|staging-e2e|infra> [service]" >&2
}

if [[ -z "$ACTION" || -z "$PROFILE" ]]; then
  usage
  exit 1
fi

case "$PROFILE" in
  local-dev|staging-e2e|infra)
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
if [[ "$PROFILE" == "local-dev" ]]; then
  load_env_file ".env.local"
else
  load_env_file ".env.${PROFILE}"
fi

run_compose() {
  docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" "$@"
}

list_running_services() {
  run_compose ps --services --filter status=running
}

is_running() {
  local service_name="$1"
  list_running_services | grep -qx "$service_name"
}

check_http_health() {
  local name="$1"
  local url="$2"

  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
    if curl -fsS "$url" >/dev/null; then
      echo "$name health endpoint: ok"
      return 0
    fi

    if [[ "$attempt" -lt "$HEALTH_RETRIES" ]]; then
      sleep "$HEALTH_RETRY_DELAY_SECONDS"
    fi
  done

  echo "$name health endpoint failed after ${HEALTH_RETRIES} attempts: $url" >&2
  return 1
}

check_reconciliation_health() {
  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
    if run_compose exec -T reconciliation node reconciliation/dist/healthcheck.js >/dev/null; then
      echo "reconciliation healthcheck: ok"
      return 0
    fi

    if [[ "$attempt" -lt "$HEALTH_RETRIES" ]]; then
      sleep "$HEALTH_RETRY_DELAY_SECONDS"
    fi
  done

  echo "reconciliation healthcheck failed after ${HEALTH_RETRIES} attempts" >&2
  return 1
}

check_required_services() {
  local required_services=()
  local missing_services=()
  local running_services=""

  case "$PROFILE" in
    local-dev)
      required_services=(postgres indexer oracle reconciliation ricardian treasury)
      ;;
    staging-e2e)
      required_services=(postgres indexer-pipeline indexer-graphql oracle reconciliation ricardian treasury)
      ;;
    infra)
      required_services=(postgres redis)
      ;;
  esac

  running_services="$(list_running_services)"

  for service_name in "${required_services[@]}"; do
    if ! is_running "$service_name"; then
      missing_services+=("$service_name")
    fi
  done

  if [[ "${#missing_services[@]}" -gt 0 ]]; then
    echo "health check failed for profile: $PROFILE" >&2
    echo "compose file: $COMPOSE_FILE" >&2
    echo "required running services: ${required_services[*]}" >&2
    if [[ -n "$running_services" ]]; then
      echo "currently running services: $(echo "$running_services" | tr '\n' ' ')" >&2
    else
      echo "currently running services: (none)" >&2
    fi
    echo "missing services: ${missing_services[*]}" >&2
    echo "next action: scripts/docker-services.sh up $PROFILE" >&2
    if [[ "$PROFILE" == "local-dev" ]]; then
      echo "tip: if staging services are running, stop them first: scripts/docker-services.sh down staging-e2e" >&2
    fi
    return 1
  fi

  return 0
}

check_indexer_graphql() {
  local graphql_path="/graphql"
  local graphql_port="${INDEXER_GRAPHQL_PORT:-4350}"

  if is_running "indexer"; then
    for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
      if run_compose exec -T indexer node -e "fetch('http://127.0.0.1:${graphql_port}${graphql_path}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query { __typename }' }) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
        echo "indexer graphql endpoint: ok (indexer)"
        return 0
      fi

      if [[ "$attempt" -lt "$HEALTH_RETRIES" ]]; then
        sleep "$HEALTH_RETRY_DELAY_SECONDS"
      fi
    done

    echo "indexer graphql endpoint failed after ${HEALTH_RETRIES} attempts (indexer)" >&2
    return 1
  fi

  if is_running "indexer-graphql"; then
    for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
      if run_compose exec -T indexer-graphql node -e "fetch('http://127.0.0.1:${graphql_port}${graphql_path}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'query { __typename }' }) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
        echo "indexer graphql endpoint: ok (indexer-graphql)"
        return 0
      fi

      if [[ "$attempt" -lt "$HEALTH_RETRIES" ]]; then
        sleep "$HEALTH_RETRY_DELAY_SECONDS"
      fi
    done

    echo "indexer graphql endpoint failed after ${HEALTH_RETRIES} attempts (indexer-graphql)" >&2
    return 1
  fi

  echo "indexer graphql endpoint check failed for profile $PROFILE: no indexer service running" >&2
  echo "next action: scripts/docker-services.sh up $PROFILE" >&2
  return 1
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
  health)
    run_compose ps
    check_required_services

    if [[ "$PROFILE" == "infra" ]]; then
      echo "infra profile healthcheck: postgres and redis running"
      echo "indexer graphql endpoint: skipped for infra profile"
      exit 0
    fi

    check_http_health "ricardian" "http://127.0.0.1:${RICARDIAN_PORT:-3100}/api/ricardian/v1/health"
    check_http_health "treasury" "http://127.0.0.1:${TREASURY_PORT:-3200}/api/treasury/v1/health"
    check_http_health "oracle" "http://127.0.0.1:${ORACLE_PORT:-3001}/api/oracle/health"

    check_reconciliation_health
    check_indexer_graphql
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    usage
    exit 1
    ;;
esac
