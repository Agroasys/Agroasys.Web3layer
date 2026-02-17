# Emergency Disable / Unpause Runbook

## Purpose
Operational playbook for emergency stop and controlled recovery path.

## Preconditions
- Incident severity confirmed (security or correctness risk).
- Admin quorum availability confirmed.
- Incident channel and audit recording active.

## Commands
- Contract interactions must be executed through approved admin tooling and governance flow.
- Do not execute ad-hoc scripts outside approved signer path.

## Expected outputs
- Emergency disable action emits audit events.
- Unpause requires quorum/governance sequence, not a single-key shortcut.

## Common failure patterns
- Attempting recovery before root cause containment.
- Partial recovery without oracle reactivation governance.

## Rollback / backout
1. Keep protocol paused if verification is incomplete.
2. Re-run reconciliation to verify state consistency before unpause.
3. Resume only after governance approvals are finalized.

## Escalation criteria
- Suspected key compromise.
- Unexpected privileged-path behavior.
- Any mismatch between governance events and expected admin quorum.
