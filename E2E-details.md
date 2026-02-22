# E2E Test Matrix — AgroasysEscrow

> All amounts expressed in human-readable USDC (not raw 6-decimal units)

## Deployed Contracts

| Contract      | Address                                      |
|---------------|----------------------------------------------|
| AgroasysEscrow | `` |
| MockUSDC       | `` |
| Indexer start block | `` |

---

## Test values

| Role       | Address                                      |
|------------|----------------------------------------------|
| buyer      | `` |
| supplier   | `` |
| treasury   | `` |
| admin1     | `` |
| admin2     | `` |
| admin3     | `` |
| oracle     | ` |

---

## Trade Parameters (default for all trades)

| Field                  | Value         |
|------------------------|---------------|
| totalAmount            | `10_000`  |
| logisticsAmount        | `1_000`   |
| platformFeesAmount     | `500`     |
| supplierFirstTranche   | `4_000`   |
| supplierSecondTranche  | `4_500`   |



---

## Test Scenario Overview

| # | Scenario                                          | Status |
|---|---------------------------------------------------|--------|
| T1 | Happy path: no dispute (finalize after 24h)      |  TODO  |
| T2 | Dispute: RESOLVE (supplier gets 2nd tranche)     |  TODO  |
| T3 | Dispute: REFUND (buyer gets 2nd tranche)         |  TODO  |
| T4 | Cancel LOCKED trade after 7-day timeout          | TODO |
| T5 | Refund IN_TRANSIT after 14-day timeout           | TODO |
| G1 | Governance: Add admin (24h timelock)            | TODO |
| G2 | Governance: Change oracle (24h timelock)        | TODO |
| E1 | Emergency: pause / unpause (multi-sig, no delay)| TODO |
| E2 | Emergency: disableOracle + oracle update | TODO |

---

## T1 — Happy path: no dispute (finalize after 24h window)

> Status: TODO

### T1.1 — createTrade (buyer SDK)

| Field             | Value |
|-------------------|----------------------|
| Date              |                 |
| Caller            | buyer                |
| signature deadline | now + 1h            |
| tx hash           |                 |
| block number      |                 |
| trade id        |                 |

**Pre-conditions:**
- buyer USDC balance ≥ 10_000
- contract not paused


**Expected events:**
- `TradeLocked(tradeId, buyer, supplier, 10_000, 1_000, 500, 4_000, 4_500, ricardianHash)`

**Post-conditions to verify:**
- Status is `LOCKED`
- Total Locked is `10_000`
- escrow USDC balance increased by `10_000`
- buyer USDC balance decreased by `10_000`


---

### T1.2 — releaseFundsStage1 (oracle)

| Field        | Value |
|--------------|----------------------|
| Date         |                 |
| Caller       | oracle               |
| trade id     |                 |
| tx hash      |                 |
| block number |                 |

**Pre-conditions:**
- Status is `LOCKED`
- `oracleActive == true`
- contract not paused

**Expected events:**
- `FundsReleasedStage1(tradeId, supplier, 4_000, treasury, 1_000)`
- `PlatformFeesPaidStage1(tradeId, treasury, 500)`

**Post-conditions to verify:**
- Status is `IN_TRANSIT`
- supplier USDC balance increased by `4_000`
- treasury USDC balance increased by `1_000 + 500 = 1_500`
- escrow USDC balance decreased by `5_500` (now holds `4_500`)

---

### T1.3 — confirmArrival (oracle)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | oracle               |
| trade id     |      |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- Status is `IN_TRANSIT`
- `oracleActive == true`
- contract not paused

**Expected events:**
- `ArrivalConfirmed(tradeId, arrivalTimestamp)`

**Post-conditions to verify:**
- Status is `ARRIVAL_CONFIRMED`
- `trades[tradeId].arrivalTimestamp` ≈ block.timestamp
- `inTransitSince[tradeId] == 0`
- Dispute window opens: buyer can call `openDispute` until `arrivalTimestamp + 24h`

---

### T1.4 — finalizeAfterDisputeWindow (called after 24h)

| Field              | Value |
|--------------------|----------------------|
| Date               | (≥ arrivalTimestamp + 24h) |
| Caller             | oracle |
| trade id           |      |
| tx hash            |      |
| block number       |      |

**Pre-conditions:**
- Status is `ARRIVAL_CONFIRMED`
- `block.timestamp > trades[tradeId].arrivalTimestamp + 24h`
- contract not paused

**Expected events:**
- `FinalTrancheReleased(tradeId, supplier, 4_500)`

**Post-conditions to verify:**
- Status is `CLOSED`
- supplier USDC balance increased by `4_500`
- escrow USDC balance == `0` for this trade
- calling again reverts with `"must be ARRIVAL_CONFIRMED"`

---

## T2 — Dispute → RESOLVE (supplier keeps 2nd tranche)

> Status: TODO

### T2.1 — createTrade (buyer SDK)

| Field             | Value |
|-------------------|----------------------|
| Date              |      |
| Caller            | buyer                |
| tx hash           |      |
| block number      |      |
| trade id returned |      |

**Same pre/post conditions as T1.1 but with incremented nonce.**

---

### T2.2 — releaseFundsStage1 (oracle)


| Field        | Value |
|--------------|----------------------|
| Date         |      |
| tx hash      |      |
| block number |      |

---

### T2.3 — confirmArrival (oracle)


| Field        | Value |
|--------------|----------------------|
| Date         |      |
| tx hash      |      |
| block number |      |

---

### T2.4 — openDispute (buyer SDK, within 24h window)

| Field        | Value |
|--------------|----------------------|
| Date         | (≤ arrivalTimestamp + 24h) |
| Caller       | buyer                |
| trade id     |      |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- Status is `ARRIVAL_CONFIRMED`
- `block.timestamp <= arrivalTimestamp + DISPUTE_WINDOW`
- `msg.sender == trades[tradeId].buyerAddress`
- contract not paused

**Expected events:**
- `DisputeOpenedByBuyer(tradeId)`

**Post-conditions to verify:**
- Status is `FROZEN`
- Escrow still holds `4_500` (locked until admin resolution)
- Calling again reverts with `"must be ARRIVAL_CONFIRMED"`

---

### T2.5 — proposeDisputeSolution (admin1, RESOLVE)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin1               |
| trade id     |      |
| disputeStatus | `RESOLVE`           |
| proposal id  |      |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- Status is `FROZEN`
- `isAdmin[caller] == true`
- No active proposal for this trade
- contract not paused

**Expected events:**
- `DisputeSolutionProposed(proposalId, tradeId, RESOLVE, admin1)`

**Post-conditions to verify:**
- `disputeProposals[proposalId].approvalCount == 1`
- `tradeHasActiveDisputeProposal[tradeId] == true`
- `tradeActiveDisputeProposalId[tradeId] == proposalId`
- `disputeProposalExpiresAt[proposalId]` ≈ block.timestamp + 7 days
- admin1 cannot propose again (reverts `"active proposal exists"`)

---

### T2.6 — approveDisputeSolution (admin2 → auto-execute)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin2               |
| proposal id  |      |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- `disputeProposals[proposalId].executed == false`
- proposal not expired
- `isAdmin[caller] == true`
- admin2 has not already approved
- contract not paused

**Expected events (on 2nd approval reaching requiredApprovals):**
- `DisputeApproved(proposalId, admin2, 2, requiredApprovals)`
- `DisputePayout(tradeId, proposalId, supplier, 4_500, RESOLVE)`
- `DisputeFinalized(proposalId, tradeId, RESOLVE)`

**Post-conditions to verify:**
- Status is `CLOSED`
- `disputeProposals[proposalId].executed == true`
- `tradeHasActiveDisputeProposal[tradeId] == false`
- supplier USDC balance increased by `4_500`
- escrow USDC balance == `0` for this trade
- Calling approve again reverts with `"already executed"`

---

## T3 — Dispute → REFUND (buyer gets 2nd tranche back)

> Status: TODO

### T3.1 — createTrade (buyer SDK)

| Field             | Value |
|-------------------|----------------------|
| Date              |      |
| Caller            | buyer                |
| tx hash           |      |
| block number      |      |
| trade id returned |      |

---

### T3.2 — releaseFundsStage1 + T3.3 confirmArrival + T3.4 openDispute


| Step          | Date   | tx hash | block number |
|---------------|--------|---------|--------------|
| Stage1        |      |      |      |
| confirmArrival|      |      |      |
| openDispute   |      |      |      |

---

### T3.5 — proposeDisputeSolution (admin1, REFUND)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin1               |
| disputeStatus | `REFUND`            |
| proposal id  |      |
| tx hash      |      |
| block number |      |

**Expected events:**
- `DisputeSolutionProposed(proposalId, tradeId, REFUND, admin1)`

---

### T3.6 — approveDisputeSolution (admin2 → auto-execute)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin2               |
| proposal id  |      |
| tx hash      |      |
| block number |      |

**Expected events:**
- `DisputeApproved(proposalId, admin2, 2, requiredApprovals)`
- `DisputePayout(tradeId, proposalId, buyer, 4_500, REFUND)`
- `DisputeFinalized(proposalId, tradeId, REFUND)`

**Post-conditions to verify:**
- Status is `CLOSED`
- buyer USDC balance increased by `4_500`
- escrow USDC balance == `0` for this trade
- Note: logistics + platform fees already taken at Stage 1 — not refundable here

---

## T4 — Cancel LOCKED trade after 7-day LOCK_TIMEOUT

> Status: TODO
> Requires waiting 7 days after createTrade without calling releaseFundsStage1.

### T4.1 — createTrade (buyer SDK)

| Field             | Value |
|-------------------|----------------------|
| Date              |      |
| Caller            | buyer                |
| tx hash           |      |
| block number      |      |
| trade id returned |      |
| createdAt         |      |

**Cancel becomes available after:** `createdAt + 7 days`

---

### T4.2 — cancelLockedTradeAfterTimeout (buyer, after 7 days)

| Field        | Value |
|--------------|----------------------|
| Date         | (≥ createdAt + 7 days) |
| Caller       | buyer                |
| trade id     |      |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- Status is `LOCKED`
- `block.timestamp > trades[tradeId].createdAt + LOCK_TIMEOUT (7 days)`
- `msg.sender == trades[tradeId].buyerAddress`
- `whenNotPaused` NOT required (escape hatch — no pause check)

**Expected events:**
- `TradeCancelledAfterLockTimeout(tradeId, buyer, 10_000)`

**Post-conditions to verify:**
- Status is `CLOSED`
- buyer USDC balance increased by `10_000` (full refund)
- escrow USDC balance == `0` for this trade
- Calling again reverts with `"status must be LOCKED"`

**Negative test (call before timeout):**
- Must revert with `"lock timeout not elapsed"`

---

## T5 — Refund IN_TRANSIT after 14-day IN_TRANSIT_TIMEOUT

> Status: TODO
> Requires waiting 14 days after releaseFundsStage1 without calling confirmArrival.

### T5.1 — createTrade + releaseFundsStage1

| Step          | Date   | tx hash | block number | trade id |
|---------------|--------|---------|--------------|----------|
| createTrade   |      |      |      |      |
| Stage1        |      |      |      |      |

After Stage1: note `inTransitSince[tradeId]` = block.timestamp of Stage1 tx.
Refund available after: `inTransitSince + 14 days`

---

### T5.2 — refundInTransitAfterTimeout (buyer, after 14 days)

| Field        | Value |
|--------------|----------------------|
| Date         | (≥ inTransitSince + 14 days) |
| Caller       | buyer                |
| trade id     |      |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- Status is `IN_TRANSIT`
- `block.timestamp > inTransitSince[tradeId] + IN_TRANSIT_TIMEOUT (14 days)`
- `msg.sender == trades[tradeId].buyerAddress`
- no pause check (escape hatch)

**Expected events:**
- `InTransitTimeoutRefunded(tradeId, buyer, 4_500)` ← only `supplierSecondTranche` refunded

**Post-conditions to verify:**
- Status is `CLOSED`
- `inTransitSince[tradeId] == 0`
- buyer USDC balance increased by `4_500` (supplierSecondTranche only)
- Note: `supplierFirstTranche + logistics + platformFees` were already disbursed in Stage1 and are NOT refunded

**Negative test (call before timeout):**
- Must revert with `"in-transit timeout not elapsed"`

---

## G1 — Governance: Add Admin (24h timelock)

> Status: TODO
> Requires ≥ `governanceApprovals()` (max of `requiredApprovals`, `2`) distinct admin approvals.

### G1.1 — proposeAddAdmin (admin1)

| Field          | Value |
|----------------|----------------------|
| Date           |      |
| Caller         | admin1               |
| newAdmin       |      |
| proposal id    |      |
| eta (timelock) | (now + 24h) |
| tx hash        |      |
| block number   |      |

**Pre-conditions:**
- `isAdmin[newAdmin] == false`
- `admins.length >= governanceApprovals()`
- caller is admin

**Expected events:**
- `AdminAddProposed(proposalId, admin1, newAdmin, eta)`
- `AdminAddApproved(proposalId, admin1, 1, governanceApprovals())`

---

### G1.2 — approveAddAdmin (admin2)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin2               |
| proposal id  |      |
| tx hash      |      |
| block number |      |

**Expected events:**
- `AdminAddApproved(proposalId, admin2, 2, governanceApprovals())`

**Post-conditions:**
- `adminAddProposals[proposalId].approvalCount == 2`
- Cannot execute yet (timelock not elapsed)
- Calling `executeAddAdmin` before `eta` reverts with `"timelock not elapsed"`

---

### G1.3 — executeAddAdmin (any admin, after 24h)

| Field        | Value |
|--------------|----------------------|
| Date         | (≥ eta)       |
| Caller       | admin1 (or any admin)|
| proposal id  |      |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- `block.timestamp >= adminAddProposals[proposalId].eta`
- proposal not expired (`createdAt + 7 days`)
- `isAdmin[newAdmin] == false` (re-checked)

**Expected events:**
- `AdminAdded(newAdmin)`

**Post-conditions to verify:**
- `isAdmin[newAdmin] == true`
- `admins` array contains newAdmin
- Calling again reverts with `"already executed"`

---

## G2 — Governance: Change Oracle (24h timelock, normal path)

> Status: TODO

### G2.1 — proposeOracleUpdate (admin1)

| Field          | Value |
|----------------|----------------------|
| Date           |      |
| Caller         | admin1               |
| newOracle      |      |
| proposal id    |      |
| eta (timelock) | (≈ now + 24h) |
| emergencyFastTrack | `false`          |
| tx hash        |      |
| block number   |      |

**Pre-conditions:**
- `oracleActive == true`
- `newOracle != oracleAddress`
- `admins.length >= governanceApprovals()`

**Expected events:**
- `OracleUpdateProposed(proposalId, admin1, newOracle, eta, false)`
- `OracleUpdateApproved(proposalId, admin1, 1, governanceApprovals())`

---

### G2.2 — approveOracleUpdate (admin2)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| tx hash      |      |
| block number |      |

**Expected events:**
- `OracleUpdateApproved(proposalId, admin2, 2, governanceApprovals())`

---

### G2.3 — executeOracleUpdate (any admin, after 24h)

| Field        | Value |
|--------------|----------------------|
| Date         | (≥ eta)       |
| tx hash      |      |
| block number |      |

**Expected events:**
- `OracleUpdated(oldOracle, newOracle)`

**Post-conditions to verify:**
- `oracleAddress == newOracle`
- `oracleActive == true`
- Old oracle address can no longer call oracle-only functions

---

## E1 — Emergency: pause / unpause (multi-sig, no delay)

> Status: TODO

### E1.1 — pause (admin1)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin1               |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- `paused == false`

**Expected events:**
- `Paused(admin1)`

**Post-conditions to verify:**
- `paused == true`
- `createTrade` reverts with `"paused"`
- `releaseFundsStage1` reverts with `"paused"`
- `confirmArrival` reverts with `"paused"`
- `openDispute` reverts with `"paused"`
- Escape hatches (`cancelLockedTradeAfterTimeout`, `refundInTransitAfterTimeout`) still work (no `whenNotPaused`)
- Calling `pause` again reverts with `"already paused"`

---

### E1.2 — proposeUnpause (admin1)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin1               |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- `paused == true`
- `oracleActive == true`

**Expected events:**
- `UnpauseProposed(admin1)`
- `UnpauseApproved(admin1, 1, governanceApprovals())`

---

### E1.3 — approveUnpause (admin2 → auto-execute)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin2               |
| tx hash      |      |
| block number |      |

**Expected events:**
- `UnpauseApproved(admin2, 2, governanceApprovals())`
- `Unpaused(admin2)`

**Post-conditions to verify:**
- `paused == false`
- `hasActiveUnpauseProposal == false`
- Normal protocol operations resume

---

## E2 — Emergency: disableOracle + fast-track oracle update

> Status: TODO
> Use when oracle is compromised. `disableOracleEmergency` pauses the protocol immediately.
> Fast-track oracle update skips the 24h timelock (eta = block.timestamp).

### E2.1 — disableOracleEmergency (admin1)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin1               |
| tx hash      |      |
| block number |      |

**Pre-conditions:**
- `oracleActive == true`

**Expected events:**
- `OracleDisabledEmergency(admin1, previousOracle)`
- `Paused(admin1)`

**Post-conditions to verify:**
- `oracleActive == false`
- `paused == true`
- `releaseFundsStage1` reverts with `"oracle disabled"`
- `confirmArrival` reverts with `"oracle disabled"`
- `proposeUnpause` reverts with `"oracle disabled"` 

---

### E2.2 — proposeOracleUpdate (admin1, fast-track)

| Field              | Value |
|--------------------|----------------------|
| Date               |      |
| Caller             | admin1               |
| newOracle          |      |
| proposal id        |      |
| eta                | `== block.timestamp` (no delay) |
| emergencyFastTrack | `true`               |
| tx hash            |      |
| block number       |      |

**Pre-conditions:**
- `oracleActive == false` (triggers fast-track path)
- `newOracle != oracleAddress`

**Expected events:**
- `OracleUpdateProposed(proposalId, admin1, newOracle, eta, true)`

---

### E2.3 — approveOracleUpdate (admin2)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| Caller       | admin2               |
| tx hash      |      |
| block number |      |

---

### E2.4 — executeOracleUpdate (admin, immediately after approval)

| Field        | Value |
|--------------|----------------------|
| Date         |      |
| tx hash      |      |
| block number |      |

**Expected events:**
- `OracleUpdated(oldOracle, newOracle)`

**Post-conditions to verify:**
- `oracleAddress == newOracle`
- `oracleActive == true`

---

### E2.5 — proposeUnpause + approveUnpause (now that oracle is active again)


| Step           | Date   | tx hash | block number |
|----------------|--------|---------|--------------|
| proposeUnpause |      |      |      |
| approveUnpause |      |      |      |

**Post-conditions to verify:**
- `paused == false`
- `oracleActive == true`
- Protocol fully restored

---

## Negative / Revert Tests Checklist

| Test                                          | Expected Revert Msg              | Verified |
|-----------------------------------------------|----------------------------------|----------|
| createTrade with breakdown mismatch           | `"breakdown mismatch"`           |        |
| createTrade with wrong/expired signature      | `"bad signature"` / `"signature expired"` |  |
| createTrade with wrong nonce                  | `"bad nonce"`                    |        |
| releaseFundsStage1 when not LOCKED            | `"status must be LOCKED"`        |        |
| releaseFundsStage1 by non-oracle              | `"only oracle"`                  |        |
| releaseFundsStage1 when oracleActive=false    | `"oracle disabled"`              |        |
| confirmArrival when not IN_TRANSIT            | `"status must be IN_TRANSIT"`    |        |
| openDispute after window closed               | `"window closed"`                |        |
| openDispute by non-buyer                      | `"only buyer"`                   |        |
| finalizeAfterDisputeWindow before 24h         | `"window not elapsed"`           |        |
| cancelLockedTradeAfterTimeout before 7 days   | `"lock timeout not elapsed"`     |        |
| refundInTransitAfterTimeout before 14 days    | `"in-transit timeout not elapsed"` |      |
| proposeDisputeSolution with active proposal   | `"active proposal exists"`       |        |
| approveDisputeSolution twice by same admin    | `"already approved"`             |        |
| executeOracleUpdate before timelock           | `"timelock not elapsed"`         |        |
| proposeUnpause when oracleActive=false        | `"oracle disabled"`              |        |
| pause when already paused                     | `"already paused"`               |        |
| disableOracleEmergency when already disabled  | `"oracle disabled"`              |        |

