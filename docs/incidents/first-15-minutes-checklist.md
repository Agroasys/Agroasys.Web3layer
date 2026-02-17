# Incident First 15 Minutes Checklist

1. Declare severity and incident commander.
2. Freeze risky automation if settlement correctness is uncertain.
3. Capture current service health:

```bash
scripts/docker-services.sh ps local
scripts/docker-services.sh health local
```

4. Capture key logs:

```bash
scripts/docker-services.sh logs local oracle
scripts/docker-services.sh logs local reconciliation
scripts/docker-services.sh logs local treasury
scripts/docker-services.sh logs local ricardian
```

5. Confirm whether issue is chain connectivity, indexer drift, auth failures, or data-layer fault.
6. Record affected trade IDs, action keys, request IDs, tx hashes.
7. Decide containment path (pause/disable/or continue with monitoring).
8. Notify stakeholders with current blast radius and next update time.
