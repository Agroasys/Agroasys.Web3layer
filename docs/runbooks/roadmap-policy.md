# Roadmap Policy Runbook

## What this policy enforces
The workflow `.github/workflows/pr-roadmap-policy.yml` enforces both requirements on every `pull_request` event:
- PR has a GitHub Milestone.
- PR is added to ProjectV2 `Agroasys.Web3layer Roadmap`.

Validation order is strict:
1. Direct PR -> `projectItems` match by `ROADMAP_PROJECT_ID`.
2. ProjectV2 contents scan with GraphQL pagination (`items(first:100, after:cursor)`) until found/exhausted.
3. Final fallback to `gh pr view --json projectItems` title match.

If all checks fail, the workflow fails.

## Security model
- Event: `pull_request` only.
- `pull_request_target` is forbidden because it runs with elevated repo permissions against untrusted fork code.
- No `actions/checkout` and no user-controlled scripts are executed.
- Minimal explicit permissions are used.
- Token values are masked and never echoed.

## Option A (preferred): GitHub App token
Use a GitHub App installed for the org/repo with least privilege:
- Organization Projects: read
- Repository metadata/content: read (minimum required by GitHub API calls)

Set repository secrets:
- `ROADMAP_APP_ID`
- `ROADMAP_APP_PRIVATE_KEY`
- Optional: `ROADMAP_APP_INSTALLATION_ID`

The workflow automatically prefers the App token when those secrets are present.

### App setup checklist
1. Create a GitHub App (org-owned preferred) with only required read permissions.
2. Install it on `Agroasys/Agroasys.Web3layer`.
3. Add `ROADMAP_APP_ID` and `ROADMAP_APP_PRIVATE_KEY` to repo secrets.
4. Optionally add `ROADMAP_APP_INSTALLATION_ID` if auto-discovery is not sufficient.
5. Re-run a PR check and confirm `enforce/pr-roadmap-policy` passes.

## Option B (fallback): fine-grained PAT
If App rollout is blocked, use a fine-grained PAT only:
- Resource owner: `Agroasys`
- Repository access: `Agroasys/Agroasys.Web3layer` only
- Minimum permission to read ProjectV2 membership

Store as repo secret:
- `ROADMAP_PROJECT_TOKEN`

Important:
- Do not use broad personal tokens.
- The workflow fails fast if `ROADMAP_PROJECT_TOKEN` starts with `gho_` (obvious broad OAuth token pattern).

## Required repository variable
Set:
- `ROADMAP_PROJECT_ID` = ProjectV2 node ID for `Agroasys.Web3layer Roadmap`

Optional:
- `ROADMAP_PROJECT_TITLE` (defaults to `Agroasys.Web3layer Roadmap` if unset)

## Troubleshooting
If the check fails:
1. Confirm PR has a milestone.
2. Confirm PR is added to the roadmap project.
3. Verify `ROADMAP_PROJECT_ID` is correct.
4. If using App auth, confirm secrets are set and App is installed on the repo/org.
5. If using PAT fallback, confirm it is fine-grained and repo-scoped.
6. Re-run failed jobs after metadata/auth fix.

## Manual cleanup and maintenance
Current repo may still contain legacy `ROADMAP_PROJECT_TOKEN`.
Maintainer action required:
1. Configure Option A GitHub App secrets.
2. Verify policy check passes using App token.
3. Delete legacy `ROADMAP_PROJECT_TOKEN` secret in GitHub UI.
4. Rotate any previously used broad personal token outside this repo.
