## Summary
- What changed:
- Why:

## Validation
- [ ] Lint passed for changed workspaces
- [ ] Tests passed for changed workspaces
- [ ] Build passed for changed workspaces
- [ ] Docs updated for behavior/config changes
- [ ] I have signed off all commits (DCO)

## Safety checklist
- [ ] No escrow contract ABI changes
- [ ] No escrow economics/payout-path changes
- [ ] No token flow changes
- [ ] No key material or secrets added to logs
- [ ] Rollback path documented

## Runtime checks (if infra touched)
- [ ] `scripts/docker-services.sh up local`
- [ ] `scripts/docker-services.sh health local`
- [ ] `scripts/docker-services.sh up staging-e2e`
- [ ] `scripts/docker-services.sh health staging-e2e`
