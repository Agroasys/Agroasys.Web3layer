#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

fail=0

if grep -R --line-number --fixed-strings -- '--profile local' docs README.md; then
  echo "Found deprecated docker compose profile reference: --profile local" >&2
  fail=1
fi

if grep -R --line-number -E 'scripts/docker-services\.sh (up|down|logs|ps|health) local($|[[:space:]])' docs README.md; then
  echo "Found deprecated docker-services profile name: local" >&2
  fail=1
fi

if [[ "$fail" -eq 0 ]]; then
  echo "docs profile guard: pass"
  exit 0
fi

exit 1
