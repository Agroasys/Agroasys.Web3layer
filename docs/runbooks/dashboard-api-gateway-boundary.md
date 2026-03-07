# Dashboard API Gateway Boundary

## Purpose
Define the contract boundary for the CTSP admin/operator dashboard when it interacts with Agroasys Web3layer through a future Web2 gateway.

This document is the operational companion to `docs/api/web3layer-dashboard-gateway.openapi.yml`.

## Discovery outcome
- A dedicated in-repo dashboard gateway runtime is not implemented yet.
- Existing repo HTTP services are service-scoped (`auth`, `oracle`, `ricardian`, `treasury`).
- Governance actions are currently grounded in the escrow contract and `sdk/src/modules/adminSDK.ts`.
- Compliance is currently policy and audit logic documented in runbooks, not a dedicated runtime service.

## Boundary summary

### Dashboard -> gateway
The CTSP dashboard is the operator/admin client.

The dashboard must call only the documented gateway contract and must not call contract methods or internal services directly.

Dashboard responsibilities:
- present governance and compliance state
- collect operator reason/evidence/ticket references
- attach request and correlation identifiers
- submit authenticated requests with a session bearer token

Gateway responsibilities:
- authenticate and authorize operator actions
- persist audit metadata for every mutation
- translate governance requests into AdminSDK or direct contract calls
- assemble read models from chain, indexer, treasury, ricardian, and future compliance storage
- enforce idempotency, request tracing, and stable error shapes

### Gateway -> on-chain / service backends
The gateway is an orchestration boundary, not the protocol itself.

Current backend truth in this repo:
- Auth/session: `auth`
- Governance execution: `sdk/src/modules/adminSDK.ts` + `contracts/src/AgroasysEscrow.sol`
- Ricardian document hashing: `ricardian`
- Treasury ledger and payout lifecycle: `treasury`
- Read-only chain/event evidence: `indexer`
- Oracle trade progression: `oracle`

## What is on-chain vs off-chain

### On-chain governed controls
These are existing contract-backed actions and must resolve to a transaction hash / chain event:
- `pause()`
- `proposeUnpause()`
- `approveUnpause()`
- `cancelUnpauseProposal()`
- `pauseClaims()`
- `unpauseClaims()`
- `claimTreasury()`
- `disableOracleEmergency()`
- `proposeOracleUpdate()`
- `approveOracleUpdate()`
- `executeOracleUpdate()`
- `cancelExpiredOracleUpdateProposal()`
- `proposeTreasuryPayoutAddressUpdate()`
- `approveTreasuryPayoutAddressUpdate()`
- `executeTreasuryPayoutAddressUpdate()`
- `cancelExpiredTreasuryPayoutAddressUpdateProposal()`

Primary source of truth:
- `contracts/src/AgroasysEscrow.sol`
- `contracts/tests/AgroasysEscrow.ts`
- `sdk/src/modules/adminSDK.ts`

### Off-chain policy and audit controls
These do not currently exist as a dedicated runtime service in this repo and are contract-first in the gateway spec:
- compliance decision records (`ALLOW`, `DENY`), with emergency override carried by `reasonCode=CMP_OVERRIDE_ACTIVE`
- compliance decision history for a trade
- block oracle progression for a trade
- resume oracle progression for a trade

These controls must be stored in an append-only audit model and consumed by the oracle/gateway orchestration layer.

Primary source of truth:
- `docs/runbooks/compliance-boundary-kyb-kyt-sanctions.md`
- `docs/runbooks/api-gateway-boundary.md`

## Authentication and authorization

### External client auth
The gateway should align with the repo’s existing auth service model:
- login flow: wallet-signature challenge/response
- session token: `Authorization: Bearer <sessionId>`

Source of truth:
- `auth/src/api/controller.ts`
- `auth/src/middleware/middleware.ts`
- `auth/README.md`

### Internal service auth
The gateway must not forward dashboard bearer sessions to internal services that use service-to-service auth.

Current internal service auth patterns in repo:
- `ricardian` and `treasury`: HMAC/API-key service auth
- `oracle`: service auth headers per `docs/runbooks/api-gateway-boundary.md`

## Verification model for operators
Every gateway action must be verifiable through one or more of:
- gateway action record / audit entry
- chain transaction hash or extrinsic hash
- emitted contract event
- treasury ledger record
- ricardian hash record
- correlated logs using request/correlation IDs

### Governance verification examples
- Pause / claims pause:
  - verify gateway action status
  - verify transaction hash
  - verify `Paused`, `ClaimsPaused`, or `ClaimsUnpaused` event
- Oracle recovery:
  - verify `OracleDisabledEmergency`, `OracleUpdateProposed`, `OracleUpdateApproved`, `OracleUpdated`
  - verify `oracleAddress` and `oracleActive` read model
- Treasury sweep:
  - verify `TreasuryClaimed`
  - verify current `treasuryPayoutAddress`
  - verify treasury ledger/export state if payout workflow continues off-chain
- Treasury payout receiver rotation:
  - verify proposal approval count, timelock, execution status
  - verify `TreasuryPayoutAddressUpdated`

### Compliance verification examples
- Decision create:
  - verify append-only decision record with provider reference, reason code, evidence links, and actor metadata
- Block oracle progression:
  - verify trade block state in gateway read model
  - verify that subsequent oracle progression requests are rejected or held by orchestration policy
- Resume oracle progression:
  - verify cleared block state and linked reason/evidence

## Required audit fields for every mutation
The gateway must persist, at minimum:
- actor session id
- actor wallet / subject
- actor role
- request id
- correlation id
- idempotency key
- reason
- evidence links
- ticket reference
- created at
- requested by
- approved by, if applicable
- resulting tx hash / block number, if applicable

## Known unresolved decisions
- The auth service currently models `buyer | supplier | admin | oracle`; dedicated operator roles for compliance/treasury/incident workflows are not represented yet.
- The canonical storage owner for compliance decisions is not implemented yet.
- The canonical storage owner for blocked-trade / resume-oracle controls is not implemented yet.
- The gateway read model will likely need direct typechain/contract reads for proposal and status state because the current generic SDK client does not expose all governance reads.

## References
- `docs/api/web3layer-dashboard-gateway.openapi.yml`
- `docs/runbooks/api-gateway-boundary.md`
- `docs/runbooks/compliance-boundary-kyb-kyt-sanctions.md`
- `docs/runbooks/emergency-disable-unpause.md`
- `docs/runbooks/pull-over-push-claim-flow.md`
- `docs/runbooks/treasury-to-fiat-sop.md`
- `auth/README.md`
- `sdk/src/modules/adminSDK.ts`
