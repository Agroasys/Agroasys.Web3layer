# Treasury-to-Fiat SOP

## Purpose
Define a controlled, auditable procedure to move treasury-observed settlement value into fiat rails without bypassing payout controls.

## Who This Is For
- `Treasury Operator`: prepares payout package and executes approved transfer.
- `Treasury Approver`: validates controls and authorizes payout progression.
- `Compliance Reviewer`: verifies audit completeness and exception handling.
- `On-call Engineer`: supports technical remediation when service paths fail.

## When To Use
- Stage-1 treasury components are ready for payout processing.
- Pilot/staging exercises that require operational evidence for fiat settlement path.

## Scope
- Treasury ledger state progression (`PENDING_REVIEW` -> `READY_FOR_PAYOUT` -> `PROCESSING` -> `PAID` or `CANCELLED`).
- Approval and evidence requirements for treasury-to-fiat execution.
- Exception handling for failed, incorrect, or partial payouts.

## Non-Scope
- Contract-level release logic or dispute governance.
- External bank/exchange onboarding contracts or legal policy text.
- UI workflow implementation.

## Prerequisites
- Treasury service is healthy:

```bash
curl -fsS "http://127.0.0.1:${TREASURY_PORT:-3200}/api/treasury/v1/health"
curl -fsS "http://127.0.0.1:${TREASURY_PORT:-3200}/api/treasury/v1/ready"
```

- Ledger entries are present from indexed stage-1 events (`FundsReleasedStage1`, `PlatformFeesPaidStage1`).
- Service auth headers available when `TREASURY_AUTH_ENABLED=true`.
- Approval separation is active:
  - Treasury Operator cannot self-approve their own payout request.

If `TREASURY_AUTH_ENABLED=true`, include required HMAC headers on every treasury API call (`x-agroasys-timestamp`, `x-agroasys-signature`, optional `x-agroasys-nonce`, and `X-Api-Key` when key-based auth is used).

## Safety Guardrails
- Never execute payout without an approved ledger entry and evidence package.
- Never skip payout state transitions or force `PAID` directly.
- Never log secrets, private keys, or full credentialed webhook URLs.
- Never continue processing when destination details are ambiguous.

## Procedure

### 1. Build payout candidate list
Fetch entries for review:

```bash
curl -fsS "http://127.0.0.1:${TREASURY_PORT:-3200}/api/treasury/v1/entries?state=PENDING_REVIEW&limit=100&offset=0"
```

Expected result:
- Candidate entries include `trade_id`, `tx_hash`, `component_type`, `amount_raw`, and `latest_state`.

If not:
- Run ingestion once and retry listing:

```bash
curl -fsS -X POST "http://127.0.0.1:${TREASURY_PORT:-3200}/api/treasury/v1/ingest"
```

### 2. Control checklist before approval
For each candidate entry, confirm:
- Destination account details match approved beneficiary record.
- Payout purpose links to the correct `trade_id` and settlement component.
- Amount/currency alignment with ledger record.
- Required approvals are collected (operator + independent approver).

Expected result:
- Entry is either approved for payout or rejected with a documented reason.

If not:
- Mark entry `CANCELLED` with reason and stop payout path for that entry.

### 3. Move approved entry to `READY_FOR_PAYOUT`
Append state transition:

```bash
curl -fsS -X POST "http://127.0.0.1:${TREASURY_PORT:-3200}/api/treasury/v1/entries/<entry-id>/state" \
  -H "Content-Type: application/json" \
  -d '{"state":"READY_FOR_PAYOUT","note":"Approved for treasury-to-fiat execution","actor":"Treasury Approver"}'
```

Expected result:
- Response is `success: true`; transition is accepted by state machine rules.

If not:
- Validate current state and transition legality (`docs` source of truth: `treasury/src/core/payout.ts`).
- Do not continue until transition path is valid.

### 4. Start fiat transfer execution (`PROCESSING`)
Record start of execution window:

```bash
curl -fsS -X POST "http://127.0.0.1:${TREASURY_PORT:-3200}/api/treasury/v1/entries/<entry-id>/state" \
  -H "Content-Type: application/json" \
  -d '{"state":"PROCESSING","note":"Transfer initiated with approved off-ramp","actor":"Treasury Operator"}'
```

Execute transfer in approved off-ramp channel (bank/exchange workflow).

Expected result:
- External transfer reference is generated.

If not:
- Append `CANCELLED` if transfer cannot be safely executed and record reason.

### 5. Finalize entry (`PAID`) and attach evidence
After transfer confirmation:

```bash
curl -fsS -X POST "http://127.0.0.1:${TREASURY_PORT:-3200}/api/treasury/v1/entries/<entry-id>/state" \
  -H "Content-Type: application/json" \
  -d '{"state":"PAID","note":"Transfer settled; receipt and FX evidence attached","actor":"Treasury Operator"}'
```

Record post-transfer evidence:
- Transfer reference/receipt ID.
- FX rate and timestamp used for conversion.
- Linked `trade_id`, ledger `entry_id`, and source on-chain `tx_hash`.

Expected result:
- Entry appears with `latest_state=PAID`.

If not:
- Keep entry in `PROCESSING`, investigate with approver + on-call engineer, and avoid duplicate transfer attempts.

## Evidence To Record (Audit Minimum)
- Actor for every state transition and approval timestamp.
- Payout destination validation result.
- Amount/currency checks and approval artifacts.
- Off-ramp transfer reference, FX rate, and settlement timestamp.
- Associated `trade_id`, `entry_id`, `tx_hash`, incident/ticket IDs (if any).

## Exception Handling

### Wrong destination submitted
- Stop immediately; do not execute transfer.
- Mark entry `CANCELLED` with explicit reason.
- Escalate to compliance reviewer and on-call engineer.

### Off-ramp transfer failed
- Keep state at `PROCESSING` only while active retry plan exists.
- If transfer cannot recover safely, set `CANCELLED` and open incident.

### Partial settlement confirmed
- Do not mark `PAID` until full amount is reconciled.
- Record partial receipt and discrepancy details.
- Escalate for controlled remediation and evidence review.

## Rollback / Escalation
1. Pause payout progression for impacted entries.
2. Capture treasury API responses, logs, and transfer references.
3. Run `docs/incidents/first-15-minutes-checklist.md` for high-risk incidents.
4. Escalate with full evidence to Treasury Approver, Compliance Reviewer, and On-call Engineer.

## Related References
- `treasury/README.md`
- `docs/runbooks/reconciliation.md`
- `docs/runbooks/hybrid-split-walkthrough.md`
- `docs/runbooks/oracle-redrive.md`
