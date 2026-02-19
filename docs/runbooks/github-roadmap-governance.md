# GitHub Roadmap Governance

## Purpose
Maintain a single execution board for `Agroasys.Web3layer` where every roadmap item and PR is mapped to milestone scope and delivery status.

## Project v2 Definition
- Project name: `Agroasys.Web3layer Roadmap`
- Project URL: `https://github.com/orgs/Agroasys/projects/5`
- Project node ID: `PVT_kwDODMhsg84BPnYZ`
- Status values: `Backlog`, `In Progress`, `In Review`, `Blocked`, `Done`
- Milestone values: `Milestone A: PolkaVM Smart Contract Escrow & Ricardian Architecture`, `Milestone B: Non-Custodial Integration & Hybrid Split Settlement`, `Milestone C: Pilot with 1 Buyer + 1 Cooperative & Enforceability Memo`, `Needs Triage`
- Area values: `Contracts`, `Oracle`, `Indexer`, `SDK`, `Reconciliation`, `Ricardian`, `Treasury`, `Notifications`, `Ops/CI`, `Docs/Runbooks`, `Security`
- Work type values: `Feature`, `Bug`, `Refactor`, `Ops`, `Docs`, `Security` (`Type` is a reserved project field name in GitHub UI/API).

## Runtime Profile Context
- `local-dev`: fast local feedback with lightweight indexer responder.
- `staging-e2e-real`: release-gate profile using real indexer pipeline (`indexer-migrate`, `indexer-pipeline`, `indexer-graphql`).
- Release gate policy: `staging-e2e-real` health + gate checks must pass before release promotion.

## PR Policy (Required)
Every PR must:
1. Have a repo milestone assigned.
2. Be added to Project v2 (`Agroasys.Web3layer Roadmap`).
3. Keep CI green and avoid ABI/economics/token-flow changes unless explicitly approved.

The workflow `.github/workflows/pr-roadmap-policy.yml` enforces (1) and (2).
During temporary rollout without GitHub App auth, project-link enforcement is advisory (warnings only); milestone enforcement remains blocking.

## Maintainer Steps For Each PR
1. Assign milestone:
```bash
gh pr edit <PR_NUMBER> --repo Agroasys/Agroasys.Web3layer --milestone "<Milestone Name>"
```
2. Add PR to Project v2:
```bash
pr_id="$(gh pr view <PR_NUMBER> --repo Agroasys/Agroasys.Web3layer --json id -q .id)"
gh api graphql \
  -f query='mutation($project:ID!,$content:ID!){ addProjectV2ItemById(input:{projectId:$project,contentId:$content}) { item { id } } }' \
  -F project="$ROADMAP_PROJECT_ID" \
  -F content="$pr_id"
```
3. Set project fields (`Status`, `Roadmap Milestone`, `Area`, `Priority`, `Work Type`, `Risk`, `% Complete`, `Target Date`).

## Required Repository Configuration
- Repository variable: `ROADMAP_PROJECT_ID` (Project v2 node id).
- Workflow permission: `.github/workflows/pr-roadmap-policy.yml` must keep `repository-projects: read`.
- Roadmap policy auth/runbook: `docs/runbooks/roadmap-policy.md`.
