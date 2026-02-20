# Dependency Vulnerability Policy (Baseline)

## Purpose
Define short-term dependency vulnerability posture and remediation workflow without forcing unstable upgrades.

## Current Baseline
- Target: no **Critical** or **High** vulnerabilities in the monorepo dependency tree.
- Moderate/Low findings are tracked and remediated in targeted, low-risk changes.
- `npm ls --all` must remain healthy (no dependency graph breakage).

## Remediation Rules
1. Prefer patch/minor upgrades with small lockfile churn.
2. Use overrides only when necessary, with explicit rationale in PR description.
3. Do not use `npm audit fix --force` in routine remediation.
4. Avoid major toolchain/framework migrations as part of vulnerability triage.
5. When a fix requires major upgrades, open a tracked issue and schedule it to a milestone.

## Visibility Command
Run:

```bash
npm run security:deps
```

This command is **non-enforcing** and reports:
- `npm audit --omit=dev --json` summary
- `npm audit --json` summary
- `npm ls --all` exit status

## Override Lifecycle
- Every override should include:
  - why it exists
  - first PR introducing it
  - removal condition (upstream fix version or migration milestone)
- Review overrides during dependency maintenance and remove when no longer required.
