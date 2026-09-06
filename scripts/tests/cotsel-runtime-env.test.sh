#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/cotsel.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cp "$ROOT_DIR/scripts/tests/fixtures/runtime.env" "$tmp_dir/.env.runtime"
sed -i.bak 's/^INDEXER_START_BLOCK=.*/INDEXER_START_BLOCK=444/' "$tmp_dir/.env.runtime"
rm -f "$tmp_dir/.env.runtime.bak"

cat > "$tmp_dir/docker" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "compose" ]]; then
  echo "unexpected docker invocation: $*" >&2
  exit 1
fi

if [[ "$*" == *" config"* ]]; then
  echo "INDEXER_START_BLOCK: ${INDEXER_START_BLOCK:-unset}"
  exit 0
fi

echo "unexpected docker compose action: $*" >&2
exit 1
EOF

chmod +x "$tmp_dir/docker"

output_runtime="$(
  cd "$tmp_dir"
  PATH="$tmp_dir:$PATH" "$SCRIPT" config
)"

if ! grep -q 'INDEXER_START_BLOCK: 444' <<<"$output_runtime"; then
  echo "expected .env.runtime to drive cotsel config output" >&2
  echo "$output_runtime" >&2
  exit 1
fi

set +e
output_external="$(
  cd "$tmp_dir"
  PATH="$tmp_dir:$PATH" INDEXER_START_BLOCK=555 "$SCRIPT" config 2>&1
)"
external_status=$?
set -e

if [[ "$external_status" -eq 0 ]]; then
  echo "expected inherited runtime config to be rejected" >&2
  echo "$output_external" >&2
  exit 1
fi

if ! grep -q 'inherited override for INDEXER_START_BLOCK is prohibited' <<<"$output_external"; then
  echo "expected a deterministic inherited-override error" >&2
  echo "$output_external" >&2
  exit 1
fi

echo "cotsel runtime env determinism: pass"
