#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/notifications-wiring-health.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cp "$ROOT_DIR/docker-compose.services.yml" "$tmp_dir/docker-compose.services.yml"

set_env_value() {
  local key="$1"
  local value="$2"
  sed -i.bak "s|^${key}=.*|${key}=${value}|" "$tmp_dir/.env.runtime"
  rm -f "$tmp_dir/.env.runtime.bak"
}

# Notifications disabled: wiring health should pass.
cp "$ROOT_DIR/scripts/tests/fixtures/runtime.env" "$tmp_dir/.env.runtime"

(
  cd "$tmp_dir"
  "$SCRIPT" runtime >/dev/null
)

# Enable notifications without a webhook URL and expect failure.
set_env_value ORACLE_NOTIFICATIONS_ENABLED true

if (
  cd "$tmp_dir"
  "$SCRIPT" runtime >/dev/null 2>&1
); then
  echo "expected runtime wiring health to fail when webhook is missing and enabled" >&2
  exit 1
fi

# Enable notifications with webhook URLs: wiring health should pass.
set_env_value ORACLE_NOTIFICATIONS_WEBHOOK_URL https://hooks.example.invalid/oracle
set_env_value RECONCILIATION_NOTIFICATIONS_ENABLED true
set_env_value RECONCILIATION_NOTIFICATIONS_WEBHOOK_URL https://hooks.example.invalid/reconciliation

(
  cd "$tmp_dir"
  "$SCRIPT" runtime >/dev/null
)

echo "notifications wiring health validation: pass"
