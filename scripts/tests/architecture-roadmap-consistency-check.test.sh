#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/architecture-roadmap-consistency-check.mjs"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

pass_matrix="$tmp_dir/matrix-pass.md"
fail_matrix="$tmp_dir/matrix-fail.md"

cat > "$pass_matrix" <<'MATRIX'
# Architecture Coverage Matrix

Snapshot date: 2026-02-28

## Component Mapping

| Component | Milestone Target | Status | % Complete | Roadmap Issue(s) | Evidence | Remaining Gap | Owner | Last Refreshed | Refresh Cadence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Example component | A | Done | 100 | #999 | `docs/example.md` | None for example scope | roadmap-maintainers | 2026-02-28 | weekly |

## Gate-to-Row Mapping
MATRIX

node "$SCRIPT" --offline --matrix "$pass_matrix" --out "$tmp_dir/pass.json" >/dev/null

cat > "$fail_matrix" <<'MATRIX'
# Architecture Coverage Matrix

Snapshot date: 2026-02-28

## Component Mapping

| Component | Milestone Target | Status | % Complete | Roadmap Issue(s) | Evidence | Remaining Gap | Owner | Last Refreshed | Refresh Cadence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Example component | A | Done | 100 | #999 | `docs/example.md` | None for example scope |  | 2026-02-28 | weekly |

## Gate-to-Row Mapping
MATRIX

if node "$SCRIPT" --offline --matrix "$fail_matrix" --out "$tmp_dir/fail.json" >/dev/null 2>&1; then
  echo "expected consistency checker to fail when Owner is empty" >&2
  exit 1
fi

echo "architecture-roadmap consistency checker offline validation: pass"
