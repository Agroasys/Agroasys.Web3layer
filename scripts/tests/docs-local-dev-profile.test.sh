#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if rg -n --glob '*.md' -- \
  "scripts/docker-services\\.sh (up|down|health|logs|ps) local($| )|--profile local($| )" \
  "$ROOT_DIR/docs" "$ROOT_DIR/README.md"; then
  echo "docs still reference deprecated 'local' profile name; use 'local-dev'" >&2
  exit 1
fi

echo "docs local-dev profile naming: pass"
