#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-}"

usage() {
  echo "Usage: scripts/validate-env.sh <local-dev|staging-e2e|staging-e2e-real|infra>" >&2
}

if [[ -z "$PROFILE" ]]; then
  usage
  exit 1
fi

case "$PROFILE" in
  local-dev)
    PROFILE_FILE=".env.local"
    ;;
  staging-e2e)
    PROFILE_FILE=".env.staging-e2e"
    ;;
  staging-e2e-real)
    PROFILE_FILE=".env.staging-e2e-real"
    ;;
  infra)
    PROFILE_FILE=".env.infra"
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

if [[ ! -f ".env" ]]; then
  echo "Missing required base env file: .env" >&2
  exit 1
fi

if [[ "$PROFILE" != "infra" && ! -f "$PROFILE_FILE" ]]; then
  echo "Missing required profile env file: $PROFILE_FILE" >&2
  exit 1
fi

load_env_file ".env"
if [[ -f "$PROFILE_FILE" ]]; then
  load_env_file "$PROFILE_FILE"
fi

required_keys=(
  # shared compose/database inputs
  POSTGRES_USER
  POSTGRES_PASSWORD
  RICARDIAN_DB_NAME
  TREASURY_DB_NAME
  ORACLE_DB_NAME
  RECONCILIATION_DB_NAME
  INDEXER_DB_NAME
)

if [[ "$PROFILE" != "infra" ]]; then
  required_keys+=(
    # service ports
    RICARDIAN_PORT
    TREASURY_PORT
    ORACLE_PORT

    # oracle runtime config (oracle/src/config.ts)
    ORACLE_API_KEY
    ORACLE_HMAC_SECRET
    ORACLE_PRIVATE_KEY
    ORACLE_RPC_URL
    ORACLE_CHAIN_ID
    ORACLE_ESCROW_ADDRESS
    ORACLE_USDC_ADDRESS
    ORACLE_INDEXER_GRAPHQL_URL
    ORACLE_RETRY_ATTEMPTS
    ORACLE_RETRY_DELAY

    # reconciliation runtime config (reconciliation/src/config.ts)
    RECONCILIATION_RPC_URL
    RECONCILIATION_CHAIN_ID
    RECONCILIATION_ESCROW_ADDRESS
    RECONCILIATION_USDC_ADDRESS
    RECONCILIATION_INDEXER_GRAPHQL_URL

    # treasury runtime config (treasury/src/config.ts)
    TREASURY_INDEXER_GRAPHQL_URL
  )
fi

if [[ "$PROFILE" == "staging-e2e" || "$PROFILE" == "staging-e2e-real" ]]; then
  required_keys+=(
    # indexer pipeline config (indexer/src/config.ts)
    INDEXER_GATEWAY_URL
    INDEXER_RPC_ENDPOINT
    INDEXER_START_BLOCK
    INDEXER_RATE_LIMIT
    INDEXER_GRAPHQL_PORT
    INDEXER_CONTRACT_ADDRESS
  )
fi

if [[ "$PROFILE" == "staging-e2e-real" ]]; then
  required_keys+=(
    # real staging gate context
    STAGING_E2E_REAL_NETWORK_NAME
    STAGING_E2E_REAL_CHAIN_ID
  )
fi

missing_keys=()
for key in "${required_keys[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    missing_keys+=("$key")
  fi
done

if [[ "${#missing_keys[@]}" -gt 0 ]]; then
  echo "Missing required env keys for profile '$PROFILE':" >&2
  printf '  - %s\n' "${missing_keys[@]}" >&2
  exit 1
fi

echo "env validation passed for profile: $PROFILE"
