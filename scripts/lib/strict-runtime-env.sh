#!/usr/bin/env bash

strict_runtime_env_load() {
  local env_file="$1"
  local schema_file="$2"
  local parser_file="$3"

  if ! command -v node >/dev/null 2>&1; then
    printf 'strict runtime environment rejected: node is required\n' >&2
    return 1
  fi
  if ! command -v xxd >/dev/null 2>&1; then
    printf 'strict runtime environment rejected: xxd is required\n' >&2
    return 1
  fi

  local encoded_environment
  if ! encoded_environment="$(
    node "$parser_file" \
      --env-file "$env_file" \
      --schema "$schema_file" \
      --emit-hex
  )"; then
    return 1
  fi

  local key
  local hex_value
  local value
  while IFS=$'\t' read -r key hex_value; do
    [[ -z "$key" ]] && continue
    value="$(printf '%s' "${hex_value:-}" | xxd -r -p)"
    export "$key=$value"
  done <<< "$encoded_environment"
}
