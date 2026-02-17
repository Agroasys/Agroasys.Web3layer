# Oracle Re-drive Runbook

## Purpose
Handle `EXHAUSTED_NEEDS_REDRIVE` oracle triggers without bypassing on-chain source-of-truth checks.

## Preconditions
- Oracle service is running.
- Trigger status is `EXHAUSTED_NEEDS_REDRIVE`.
- Indexer and RPC are both reachable.

## Commands

Service health:

```bash
curl -fsS http://127.0.0.1:3001/api/oracle/health
```

Example re-drive request:

```bash
curl -X POST http://127.0.0.1:3001/api/oracle/redrive \
  -H 'Content-Type: application/json' \
  -H "x-api-key: ${ORACLE_API_KEY}" \
  -H "x-hmac-signature: <signature>" \
  -d '{"tradeId":"123","triggerType":"RELEASE_STAGE_1","requestId":"manual-redrive-001"}'
```

## Expected outputs
- Action stays idempotent by `actionKey`.
- If already executed on-chain: trigger marked confirmed and no duplicate execution.
- Otherwise: new trigger request is created and retried under bounded backoff policy.

## Common failure patterns
- Invalid trade status for trigger type.
- Signature/auth failures.
- RPC or indexer outages causing verification failure.

## Rollback / backout
1. Pause redrive requests.
2. Capture failing trigger IDs and logs.
3. Restore previous known-good oracle deployment if regression is suspected.

## Escalation criteria
- Any sign of duplicate on-chain action for a single `actionKey`.
- Terminal failures across multiple unrelated trades.
- Persistent verification disagreement between RPC and indexer.
