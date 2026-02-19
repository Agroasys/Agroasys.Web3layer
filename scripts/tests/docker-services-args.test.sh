#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/docker-services.sh"

assert_fails() {
  if "$@" >/dev/null 2>&1; then
    echo "expected failure but command succeeded: $*" >&2
    exit 1
  fi
}

assert_fails "$SCRIPT"
assert_fails "$SCRIPT" build
assert_fails "$SCRIPT" build unsupported-profile
assert_fails "$SCRIPT" unknown-action local-dev
assert_fails "$SCRIPT" health staging-e2e-real invalid-service

echo "docker-services arg parser smoke: pass"
