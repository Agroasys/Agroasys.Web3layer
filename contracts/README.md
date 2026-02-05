# Solidity Smart Contract (PolkaVM)

## Overview

A Solidity-based state machine deployed on PolkaVM. It handles the locking, dispute resolution, and atomic splitting of funds.


## Architecture
```bash
.
├── hardhat.config.ts // hardhat config file
├── package.json
├── README.md
├── src
│   ├── AgroasysEscrow.sol // Escrow smart contract
│   └── MockUSDC.sol
├── tests
│   └── AgroasysEscrow.ts // Uint tests
├── tsconfig.json
├── ignition
│   └── modules // deployment scripts
│      ├── AgroasysEscrow.ts 
│      └── MockUSDC.ts
├── foundry
│   ├── foundry.toml // fondry config file
│   ├── src
│   │   ├── AgroasysEscrow.sol
│   │   └── MockUSDC.sol // tmp contract just for testing 
│   └── test
│       ├── AgroasysEscrowFuzz.t.sol // Stateless Fuzzing test
│       └── AgroasysEscrowInvariant.t.sol // Statefull Invariant Tests
├── scripts // scripts to simulate interactions on-chain
│   ├── dispute
│   │   ├── approveSolution.ts
│   │   └── proposeSolution.ts
│   ├── trade
│   │   ├── confirmArrival.ts
│   │   ├── createTrade.ts
│   │   ├── openDisputeByBuyer.ts
│   │   ├── releaseFinalTranche.ts
│   │   └── releaseStage1.ts
│   ├── updateAdmins
│   │   ├── approve.ts
│   │   ├── execute.ts
│   │   └── propose.ts
│   └── updateOracle
│       ├── approve.ts
│       ├── execute.ts
│       └── propose.ts

```

## Contracts structure

### Contract: `AgroasysEscrow.sol`

Escrow contract implementing secure trade execution with multi-stage fund releases and dispute resolution.


#### **Enums**
**`TradeStatus`**
- `LOCKED`: Initial deposit, funds locked in escrow
- `IN_TRANSIT`: BOL verified, stage 1 funds released (logistics + first tranche)
- `ARRIVAL_CONFIRMED`: Oracle confirms arrival, 24-hour dispute window starts
- `FROZEN`: Buyer raised dispute within 24h window, funds frozen
- `CLOSED`: Trade completed or dispute resolved

**`DisputeStatus`**
- `REFUND`: Refund buyer (second tranche + platform fees)
- `RESOLVE`: Pay supplier normally (second tranche + platform fees to treasury)


#### **Structs**
**`Trade`**
Complete trade data structure stored on-chain:
- `tradeId` (uint256): Unique identifier, auto-incremented
- `ricardianHash` (bytes32): Immutable proof of agreement (SHA-256 of legal contract)
- `status` (TradeStatus): Current trade state
- `buyerAddress` (address): Creates the trade, pays totalAmount
- `supplierAddress` (address): Receives first and second tranches
- `totalAmountLocked` (uint256): Total amount locked by buyer
- `logisticsAmount` (uint256): Logistics fees (paid at stage 1)
- `platformFeesAmount` (uint256): Platform fees (paid at stage 1)
- `supplierFirstTranche` (uint256): First payment to supplier (paid at stage 1, ~40%)
- `supplierSecondTranche` (uint256): Second payment to supplier (paid at stage 2, ~60%)
- `createdAt` (uint256): Trade creation timestamp
- `arrivalTimestamp` (uint256): Arrival confirmation timestamp (starts 24h window)

**`DisputeProposal`**
Multi-signature dispute proposal structure:
- `tradeId` (uint256): Trade being disputed
- `disputeStatus` (DisputeStatus): Proposed resolution method
- `approvalCount` (uint256): Number of admin approvals received
- `executed` (bool): Prevents double execution
- `createdAt` (uint256): Proposal creation timestamp
- `proposer` (address): Admin who proposed the solution

**`OracleUpdateProposal`**
Timelock-based oracle rotation proposal:
- `newOracle` (address): Proposed new oracle address
- `approvalCount` (uint256): Number of admin approvals received
- `executed` (bool): Prevents double execution
- `createdAt` (uint256): Proposal creation timestamp
- `eta` (uint256): Earliest execution timestamp (timelock)
- `proposer` (address): Admin who proposed the update

**`AdminAddProposal`**
Timelock-based admin addition proposal:
- `newAdmin` (address): Proposed new admin address
- `approvalCount` (uint256): Number of admin approvals received
- `executed` (bool): Prevents double execution
- `createdAt` (uint256): Proposal creation timestamp
- `eta` (uint256): Earliest execution timestamp (timelock)
- `proposer` (address): Admin who proposed the addition


#### **State Variables**
**Storage Mappings:**
- `trades` (mapping(uint256 => Trade)): All trades indexed by ID
- `nonces` (mapping(address => uint256)): Buyer-scoped nonces for signature replay protection
- `disputeProposals` (mapping(uint256 => DisputeProposal)): All dispute proposals
- `disputeHasApproved` (mapping(uint256 => mapping(address => bool))): Tracks admin approvals per dispute
- `tradeHasActiveDisputeProposal` (mapping(uint256 => bool)): Prevents multiple active disputes per trade
- `isAdmin` (mapping(address => bool)): Admin authorization mapping
- `oracleUpdateProposals` (mapping(uint256 => OracleUpdateProposal)): Oracle update proposals
- `oracleUpdateHasApproved` (mapping(uint256 => mapping(address => bool))): Tracks approvals per oracle update
- `adminAddProposals` (mapping(uint256 => AdminAddProposal)): Admin addition proposals
- `adminAddHasApproved` (mapping(uint256 => mapping(address => bool))): Tracks approvals per admin addition

**Counters:**
- `tradeCounter` (uint256): Auto-incrementing trade ID
- `disputeCounter` (uint256): Auto-incrementing dispute proposal ID
- `oracleUpdateCounter` (uint256): Auto-incrementing oracle update proposal ID
- `adminAddCounter` (uint256): Auto-incrementing admin addition proposal ID

**Configuration:**
- `usdcToken` (IERC20): USDC token contract interface
- `oracleAddress` (address): Authorized oracle for fund releases and arrival confirmation
- `treasuryAddress` (address): Receives logistics and platform fees
- `admins` (address[]): Array of admin addresses
- `requiredApprovals` (uint256): Minimum approvals required to execute dispute
- `governanceTimelock` (uint256): Delay (24h) between approval and execution for governance operations
- `DISPUTE_WINDOW` (constant uint256): 24-hour window for buyer to open dispute after arrival


#### **Functions**

**Public/External Functions:**

1. **`createTrade(supplier, totalAmount, logisticsAmount, platformFeesAmount, supplierFirstTranche, supplierSecondTranche, ricardianHash, buyerNonce, deadline, signature)`**
   - Creates new trade with buyer signature verification using buyer-scoped nonce
   - Locks funds in escrow (USDC transferFrom buyer)
   - Returns: `tradeId`
   - Emits: `TradeLocked`
   - Access: Anyone (msg.sender becomes buyer)
   - Requires: Valid signature with matching nonce and deadline, non-zero addresses, amounts matching breakdown, USDC approval

2. **`releaseFundsStage1(tradeId)`**
   - Releases first stage funds after BOL verification
   - Pays: supplier (first tranche) + treasury (logistics + platform fees)
   - Changes status: LOCKED to IN_TRANSIT
   - Emits: `FundsReleasedStage1`, `PlatformFeesPaidStage1`
   - Access: `onlyOracle`

3. **`confirmArrival(tradeId)`**
   - Confirms goods arrival, starts 24-hour dispute window
   - Changes status: IN_TRANSIT to ARRIVAL_CONFIRMED
   - Sets `arrivalTimestamp` to current block timestamp
   - Emits: `ArrivalConfirmed`
   - Access: `onlyOracle`

5. **`finalizeAfterDisputeWindow(tradeId)`**
   - Finalizes trade after 24h dispute window expires (permissionless)
   - Pays: supplier (second tranche only)
   - Changes status: ARRIVAL_CONFIRMED to CLOSED
   - Emits: `FinalTrancheReleased`
   - Access: Anyone (permissionless to avoid funds getting stuck)
   - Requires: Called after `arrivalTimestamp + 24 hours`

5. **`openDispute(tradeId)`**
   - Buyer opens dispute within 24-hour window
   - Freezes all remaining funds in escrow
   - Changes status: ARRIVAL_CONFIRMED to FROZEN
   - Emits: `DisputeOpenedByBuyer`
   - Access: Trade buyer only
   - Requires: Called before `arrivalTimestamp + 24 hours`

6. **`proposeDisputeSolution(tradeId, disputeStatus)`**
   - Creates dispute resolution proposal
   - First admin approval automatically counted
   - Returns: `proposalId`
   - Emits: `DisputeSolution`
   - Access: `onlyAdmin`
   - Requires: Trade status must be FROZEN

7. **`approveDisputeSolution(proposalId)`**
   - Adds admin approval to dispute proposal
   - Auto-executes `_dispute()` when threshold reached
   - Emits: `DisputeApproved`, potentially `DisputeFinalized`
   - Access: `onlyAdmin`
   - Requires: Not already approved by this admin, proposal not executed

8. **`getNextTradeId()`**
   - Returns the next available trade ID
   - Returns: `tradeCounter`
   - Access: View function (anyone)

9. **`getBuyerNonce(buyer)`**
   - Returns the current nonce for a buyer address
   - Returns: `nonces[buyer]`
   - Access: View function (anyone)

**Governance Functions:**

10. **`proposeOracleUpdate(newOracle)`**
    - Creates timelock-based oracle rotation proposal
    - First admin approval automatically counted
    - Returns: `proposalId`
    - Emits: `OracleUpdateProposed`, `OracleUpdateApproved`
    - Access: `onlyAdmin`
    - Requires: Minimum 2 admin approvals (even if requiredApprovals == 1)

11. **`approveOracleUpdate(proposalId)`**
    - Adds admin approval to oracle update proposal
    - Emits: `OracleUpdateApproved`
    - Access: `onlyAdmin`
    - Requires: Not already approved by this admin, proposal not executed

12. **`executeOracleUpdate(proposalId)`**
    - Executes approved oracle update after timelock expires
    - Emits: `OracleUpdated`
    - Access: `onlyAdmin`
    - Requires: Sufficient approvals, timelock elapsed (24h)

13. **`proposeAddAdmin(newAdmin)`**
    - Creates timelock-based admin addition proposal
    - First admin approval automatically counted
    - Returns: `proposalId`
    - Emits: `AdminAddProposed`, `AdminAddApproved`
    - Access: `onlyAdmin`
    - Requires: Minimum 2 admin approvals (even if requiredApprovals == 1)

14. **`approveAddAdmin(proposalId)`**
    - Adds admin approval to admin addition proposal
    - Emits: `AdminAddApproved`
    - Access: `onlyAdmin`
    - Requires: Not already approved by this admin, proposal not executed

15. **`executeAddAdmin(proposalId)`**
    - Executes approved admin addition after timelock expires
    - Emits: `AdminAdded`
    - Access: `onlyAdmin`
    - Requires: Sufficient approvals, timelock elapsed (24h)

16. **`governanceApprovals()`**
    - Returns minimum approvals required for governance operations
    - Returns: `max(2, requiredApprovals)` for extra security
    - Access: View function (anyone)

**Internal Functions:**

17. **`_verifySignature(...)`**
    - Verifies buyer's signature on trade parameters with nonce and deadline
    - Uses domain separation (chainId + contract address)
    - Returns: Recovered signer address
    - Access: Internal (called by `createTrade`)

18. **`_executeDispute(proposalId)`**
    - Executes approved dispute resolution
    - Distribution based on `DisputeStatus`:
      - `REFUND`: buyer receives second tranche (principal)
      - `RESOLVE`: supplier receives second tranche (principal)
    - Note: Platform/logistics fees already paid at Stage 1, not refunded
    - Changes status: FROZEN to CLOSED
    - Emits: `DisputeFinalized`
    - Access: Internal (called by `approveDisputeSolution`)


#### **Modifiers**
- `onlyOracle`: Restricts function to authorized oracle address
- `onlyAdmin`: Restricts function to approved admin addresses
- `nonReentrant`: OpenZeppelin protection against reentrancy attacks


#### **Events**

**Trade Events:**
- `TradeLocked(tradeId, buyer, supplier, totalAmount, logisticsAmount, platformFeesAmount, supplierFirstTranche, supplierSecondTranche, ricardianHash)`: New trade created and funds locked
- `FundsReleasedStage1(tradeId, supplier, supplierFirstTranche, treasury, logisticsAmount)`: Stage 1 funds released (first tranche + logistics)
- `PlatformFeesPaidStage1(tradeId, treasury, platformFeesAmount)`: Platform fees paid at Stage 1
- `ArrivalConfirmed(tradeId, arrivalTimestamp)`: Arrival confirmed, 24h dispute window started
- `FinalTrancheReleased(tradeId, supplier, supplierSecondTranche)`: Final tranche released after dispute window
- `DisputeOpenedByBuyer(tradeId)`: Buyer opened dispute, trade frozen

**Dispute Events:**
- `DisputeSolutionProposed(proposalId, tradeId, disputeStatus, proposer)`: Admin proposed dispute solution
- `DisputeApproved(proposalId, approver, approvalCount, requiredApprovals)`: Admin approved dispute proposal
- `DisputeFinalized(proposalId, tradeId, disputeStatus)`: Dispute executed, funds distributed

**Governance Events:**
- `OracleUpdateProposed(proposalId, proposer, newOracle, eta)`: Oracle update proposed with timelock
- `OracleUpdateApproved(proposalId, approver, approvalCount, requiredApprovals)`: Admin approved oracle update
- `OracleUpdated(oldOracle, newOracle)`: Oracle address updated
- `AdminAddProposed(proposalId, proposer, newAdmin, eta)`: Admin addition proposed with timelock
- `AdminAddApproved(proposalId, approver, approvalCount, requiredApprovals)`: Admin approved admin addition
- `AdminAdded(newAdmin)`: New admin added to contract


### Contract: `MockUSDC.sol`

ERC20 test token for local development and testing.


## Tests:

### Test Coverage Summary
| Framework | Type | Files | Tests |
|-----------|------|-------|-------|
| Hardhat | Unit Tests | `tests/AgroasysEscrow.ts` | 27 tests |
| Foundry | Stateless Fuzz | `foundry/test/AgroasysEscrowFuzz.t.sol` | 9 tests |
| Foundry | Stateful Invariants | `foundry/test/AgroasysEscrowInvariant.t.sol` | 7 invariants |

---

### Unit Tests `AgroasysEscrow.ts`
```
  AgroasysEscrow
    Deployment
      ✔ Should set correct initial values
      ✔ Should reject invalid constructor params
    createTrade
      ✔ Should create a trade with valid signature
      ✔ Should create multiple trades with incrementing nonces
      ✔ Should reject invalid signature (wrong signer)
      ✔ Should reject replay signature
      ✔ Should reject with invalid parameters (zero addresses, bad hash, mismatched amounts)
      ✔ Should reject with bad nonce
      ✔ Should reject expired signature
    Complete Flow (Without dispute)
      ✔ Should complete full trade lifecycle without dispute
    releaseFundsStage1
      ✔ Should reject if not oracle
      ✔ Should reject if wrong status
    confirmArrival
      ✔ Should confirm arrival
      ✔ Should reject if not oracle
      ✔ Should reject if wrong status
    Dispute Flow
      ✔ Should allow buyer to open dispute within 24h
      ✔ Should reject dispute after 24h window
      ✔ Should reject dispute from non-buyer
      ✔ Should refund buyer after dispute REFUND resolution
      ✔ Should pay supplier after dispute RESOLVE resolution
      ✔ Should reject dispute proposal from non-admin
      ✔ Should reject dispute approval from non-admin
    Governance: Oracle Update
      ✔ Should update oracle with timelock
      ✔ Should reject execution before timelock
      ✔ Should reject oracle update from non-admin
    Governance: Add Admin
      ✔ Should add new admin with timelock
      ✔ Should reject add admin from non-admin


  27 passing (861ms)

---------------------|----------|----------|----------|----------|----------------|
File                 |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
---------------------|----------|----------|----------|----------|----------------|
 src/                |    96.99 |    64.37 |    91.67 |    97.66 |                |
  AgroasysEscrow.sol |    97.71 |    64.37 |    95.24 |    98.22 |    530,579,714 |
  MockUSDC.sol       |       50 |      100 |    66.67 |       50 |             10 |
---------------------|----------|----------|----------|----------|----------------|
All files            |    96.99 |    64.37 |    91.67 |    97.66 |                |
---------------------|----------|----------|----------|----------|----------------|
```

### Stateless Fuzzing tests `AgroasysEscrowFuzz.t.sol`

```
Ran 9 tests for test/AgroasysEscrowFuzz.t.sol:FuzzTest
[PASS] testFuzz_CannotOpenDisputeAfter24Hours(uint96,uint96,uint96,uint96,bytes32) (runs: 10001, μ: 507711, ~: 508132)
[PASS] testFuzz_CannotOpenDisputeBeforeArrival(uint96,uint96,uint96,uint96,bytes32) (runs: 10001, μ: 474708, ~: 475124)
[PASS] testFuzz_CannotReleaseStage2Before24Hours(uint96,uint96,uint96,uint96,bytes32) (runs: 10001, μ: 506888, ~: 507314)
[PASS] testFuzz_UpdateAdmins(address) (runs: 10000, μ: 319595, ~: 319595)
[PASS] testFuzz_UpdateOracle(address) (runs: 10000, μ: 275537, ~: 275537)
[PASS] testFuzz_completeUserFlowWithDisputeRefund(uint96,uint96,uint96,uint96,bytes32) (runs: 10001, μ: 908282, ~: 908720)
[PASS] testFuzz_completeUserFlowWithDisputeResolve(uint96,uint96,uint96,uint96,bytes32) (runs: 10001, μ: 929052, ~: 929484)
[PASS] testFuzz_completeUserFlowWithoutDispute(uint96,uint96,uint96,uint96,bytes32) (runs: 10001, μ: 636990, ~: 637415)
[PASS] test_Setup() (gas: 32378)
Suite result: ok. 9 passed; 0 failed; 0 skipped; finished in 11.04s (45.60s CPU time)

Ran 1 test suite in 11.04s (11.04s CPU time): 9 tests passed, 0 failed, 0 skipped (9 total tests)
```

### Statefull Fuzzing Invariant tests `AgroasysEscrowInvariant.t.sol`

**Handler:**
The handler functions call the contract using valid values derived from fuzzing tests inputs.

Example: If the fuzzing input looks like `tradeId = 999999`, the Handler converts it to a valid ID using `tradeId % tradeCounter` before calling the escrow contract.


**Invariants Tested:**

1. **`invariant_EscrowBalanceMatchesLockedFunds`**
   - Escrow USDC balance = sum of all locked funds

2. **`invariant_EscrowFundsConservation`**
   - Escrow balance = total deposited - total withdrawn

3. **`invariant_TotalWithdrawnNeverExceedsDeposited`**
   - Total withdrawn ≤ total deposited

4. **`invariant_TradeCreationNumber`**
   - Handler trade counter = contract trade counter

5. **`invariant_DisputesSolvedMatches`**
   - Number of DISPUTED trades = dispute execution count

6. **`invariant_TriggerStage1GreaterThanTriggerStage2`**
   - Stage 1 releases ≥ Stage 2 releases

7. **`invariant_DisputeRaisedGreaterThanDisputeSolved`**
   - Dispute proposals ≥ disputes executed



## Scripts: 
Deployement Scripts for the 2 contracts in:
```
ignition
└── modules
    ├── AgroasysEscrow.ts
    └── MockUSDC.ts
```

## Set Up project

### Hardhat Config
```bash
cd contracts
npm install
```

### Foundry Config
```bash
cd foundry
forge install --no-git foundry-rs/forge-std
forge install --no-git OpenZeppelin/openzeppelin-contracts
forge build
```


## Running Tests

### Hardhat Unit Tests
```bash
npm run compile
npm run test
npm run coverage
```

### Fondry Fuzzing Tests
```bash
cd foundry
forge build
forge test --match-contract FuzzTest -vvv
forge test --match-contract InvariantTest -vvv
```

## Deploy Contracts
```bash
npx hardhat ignition deploy ignition/modules/MockUSDC.ts --network polkadotTestnet
npx hardhat ignition deploy ignition/modules/AgroasysEscrow.ts --network polkadotTestnet
```

## Addresses

- mock-usdc: 0xEea5766E43D0c7032463134Afc121e63C9f9C260
- escrow: 0x8E1F0924a5aA0D22fB71e5f34f25111FF487379a

## Scripts
```bash
npx hardhat run scripts/trade/createTrade.ts --network polkadotTestnet
npx hardhat run scripts/trade/releaseStage1.ts --network polkadotTestnet
npx hardhat run scripts/trade/confirmArrival.ts --network polkadotTestnet
npx hardhat run scripts/trade/releaseFinalTranche.ts --network polkadotTestnet
npx hardhat run scripts/trade/openDisputeByBuyer.ts --network polkadotTestnet
```

```bash
```

```bash
```

```bash
```
