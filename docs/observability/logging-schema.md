# Logging Schema Baseline

All services should emit JSON logs with these top-level fields:

- `level`
- `timestamp`
- `message`
- `service`
- `env`
- `tradeId`
- `actionKey`
- `requestId`
- `txHash`
- `traceId`

## Correlation field rules

- Include all correlation fields on every log record.
- Use `null` when a field is not applicable.
- Never log secrets (private keys, API secrets, full HMAC signatures).

## Metric counter names

The following counters are emitted through service logs as `metric` events:

- `auth_failures_total`
- `replay_rejects_total`
- `oracle_exhausted_retries_total`
- `oracle_redrive_attempts_total`
- `reconciliation_drift_classifications_total`

## Terminal failure logging

Terminal failures must include enough context for support triage:

- `tradeId` when available
- `actionKey` when available
- `requestId` when available
- `txHash` when available
- normalized `error` message
- `service` and `env`
