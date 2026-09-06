#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-runtime}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=scripts/lib/strict-runtime-env.sh
source "$SCRIPT_DIR/lib/strict-runtime-env.sh"

usage() {
  echo "Usage: scripts/notifications-gate.sh [runtime]" >&2
}

if [[ "$PROFILE" != "runtime" ]]; then
  echo "Unsupported profile: $PROFILE (only 'runtime' is supported)" >&2
  usage
  exit 1
fi

strict_runtime_env_load \
  ".env.runtime" \
  "$SCRIPT_DIR/../.env.runtime.example" \
  "$SCRIPT_DIR/lib/strict-runtime-env.mjs"

"$SCRIPT_DIR/notifications-wiring-health.sh" "$PROFILE"

if [[ ! -f "notifications/dist/index.js" ]]; then
  echo "Missing notifications build output (notifications/dist/index.js). Run: pnpm --filter ./notifications run build" >&2
  exit 1
fi

REPORT_DIR="${NOTIFICATIONS_GATE_REPORT_DIR:-reports/notifications}"
REPORT_FILE="${REPORT_DIR}/${PROFILE}.json"

export NOTIFICATIONS_GATE_PROFILE="$PROFILE"
export NOTIFICATIONS_GATE_OUT_FILE="$REPORT_FILE"

export ORACLE_NOTIFICATIONS_COOLDOWN_MS="${ORACLE_NOTIFICATIONS_COOLDOWN_MS:-300000}"
export ORACLE_NOTIFICATIONS_REQUEST_TIMEOUT_MS="${ORACLE_NOTIFICATIONS_REQUEST_TIMEOUT_MS:-5000}"
export RECONCILIATION_NOTIFICATIONS_COOLDOWN_MS="${RECONCILIATION_NOTIFICATIONS_COOLDOWN_MS:-300000}"
export RECONCILIATION_NOTIFICATIONS_REQUEST_TIMEOUT_MS="${RECONCILIATION_NOTIFICATIONS_REQUEST_TIMEOUT_MS:-5000}"

echo "Running notifications gate: profile=${PROFILE} report=${REPORT_FILE}"
node scripts/notifications-gate-validate.mjs
