#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.services.yml"
ACTION="${1:-}"
PROFILE="${2:-all}"

if [[ -z "$ACTION" ]]; then
  echo "Usage: scripts/docker-services.sh <build|up|down|logs|ps|health> [profile]"
  exit 1
fi

run_compose() {
  docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" "$@"
}

case "$ACTION" in
  build)
    run_compose build
    ;;
  up)
    run_compose up -d
    ;;
  down)
    run_compose down
    ;;
  logs)
    run_compose logs -f
    ;;
  ps)
    run_compose ps
    ;;
  health)
    run_compose ps

    if run_compose ps --services --filter status=running | grep -q '^ricardian$'; then
      curl -fsS "http://127.0.0.1:3100/api/ricardian/v1/health" >/dev/null
      echo "ricardian health endpoint: ok"
    fi

    if run_compose ps --services --filter status=running | grep -q '^treasury$'; then
      curl -fsS "http://127.0.0.1:3200/api/treasury/v1/health" >/dev/null
      echo "treasury health endpoint: ok"
    fi

    if run_compose ps --services --filter status=running | grep -q '^reconciliation$'; then
      run_compose exec -T reconciliation node reconciliation/dist/healthcheck.js >/dev/null
      echo "reconciliation healthcheck: ok"
    fi
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Usage: scripts/docker-services.sh <build|up|down|logs|ps|health> [profile]"
    exit 1
    ;;
esac
