# Incident First 15 Minutes Checklist

1. Declare severity and incident commander.
2. Freeze risky automation if settlement correctness is uncertain.
3. Capture current service health:

```bash
scripts/docker-services.sh ps local-dev
scripts/docker-services.sh health local-dev
```

4. Capture key logs:

```bash
scripts/docker-services.sh logs local-dev oracle
scripts/docker-services.sh logs local-dev reconciliation
scripts/docker-services.sh logs local-dev treasury
scripts/docker-services.sh logs local-dev ricardian
```

5. Run release-gate diagnostics for the impacted profile:
   - `docs/runbooks/staging-e2e-release-gate.md`
   - `docs/runbooks/staging-e2e-real-release-gate.md`
6. Confirm whether issue is chain connectivity, indexer drift, auth failures, or data-layer fault.
7. Record affected trade IDs, action keys, request IDs, tx hashes.
8. Decide containment path (pause/disable/or continue with monitoring).
9. Notify stakeholders with current blast radius and next update time.
