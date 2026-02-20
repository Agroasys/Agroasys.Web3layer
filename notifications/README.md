# Notifications Library

Shared notifications module used by Web3 services in this monorepo.

## Deduplication Behavior

Notifications are deduplicated by `dedupKey` for a cooldown window.

- If the same `dedupKey` appears again within the cooldown window, the event is suppressed.
- Cooldown is controlled by service env vars:
  - `ORACLE_NOTIFICATIONS_COOLDOWN_MS`
  - `RECONCILIATION_NOTIFICATIONS_COOLDOWN_MS`

This dedupe is in-memory and process-local; it does not survive process restarts.

## License
Licensed under Apache-2.0.
See the repository root `LICENSE` file.
