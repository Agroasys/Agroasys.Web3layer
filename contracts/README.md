# Solidity Smart Contract (PolkaVM)

## Overview

A Solidity-based state machine deployed on PolkaVM. It handles the locking, dispute resolution, and atomic splitting of funds.

## Architecture
```bash
.
├── foundry
│   ├── foundry.toml // fondry config file
│   ├── src
│   │   ├── AgroasysEscrow.sol
│   │   └── MockUSDC.sol
│   └── test
│       ├── AgroasysEscrowFuzz.t.sol // Stateless Fuzzing test
│       └── AgroasysEscrowInvariant.t.sol // Statefull Invariant Tests
├── hardhat.config.ts // hardhat config file
├── package.json
├── README.md
├── scripts
├── src
│   ├── AgroasysEscrow.sol // Escrow smart contract
│   └── MockUSDC.sol
├── tests
│   └── AgroasysEscrow.ts // Uint tests
└── tsconfig.json
```

## Contracts structure

### Contract: `AgroasysEscrow.sol`

Escrow contract implementing secure trade execution with multi-stage fund releases and dispute resolution mechanisms.


#### **Enums**
**`TradeStatus`**
- `LOCKED` - Initial state, funds deposited in the escrow
- `IN_TRANSIT` - BOL verified, stage 1 funds released (logistics + fees + first tranche)
- `CLOSED` - Inspection passed, all funds released (second tranche)
- `DISPUTED` - Admin intervention executed, trade resolved manually

**`DisputeStatus`**
- `REFUND` - Return available funds to buyer
- `RESOLVE` - Pay supplier normally
- `PARTICULAR_ISSUE` - Send funds to treasury for complex manual resolution

#### **Struct**
**`Trade`**
Complete trade data structure stored on-chain:
- `tradeId` (uint256): Unique identifier, auto-incremented
- `ricardianHash` (bytes32): Immutable proof of agreement (SHA-256 of legal contract)
- `status` (TradeStatus): Current trade state
- `buyerAddress` (address): Create the trade
- `supplierAddress` (address): Receive first and second tranches
- `treasuryAddress` (address): Receive fees+logistics
- `totalAmountLocked` (uint256): Total Amount locked by the buyer
- `logisticsAmount` (uint256): Logistics fees (paid at stage 1)
- `platformFeesAmount` (uint256): Platform fees (paid at stage 1)
- `supplierFirstTranche` (uint256): First payment to supplier (paid at stage 1)
- `supplierSecondTranche` (uint256): Second payment to supplier (paid at stage 2)
- `createdAt` (uint256): Trade creation timestamp
- `updatedAt` (uint256): Last modification timestamp (used for 7-day timeout)

**`DisputeProposal`**
Multi-signature dispute proposal structure:
- `tradeId` (uint256): Trade being disputed
- `disputeStatus` (DisputeStatus): Proposed resolution method
- `approvalCount` (uint256): Number of admin approvals
- `hasApproved` (mapping(address=>bool)): Tracks which admins approved
- `executed` (bool): Prevents double execution
- `createdAt` (uint256): Proposal creation timestamp


#### **State Variables**
**Storage Mappings:**
- `trades` (mapping(uint256 => Trade)): All trades indexed by ID
- `disputeProposals` (mapping(uint256 => DisputeProposal)): All dispute proposals
- `isAdmin` (mapping(address => bool)): Admin list

**Counters:**
- `tradeCounter` (uint256): Auto-incrementing trade ID
- `disputeCounter` (uint256): Auto-incrementing dispute proposal ID

**Configuration:**
- `usdcToken` (IERC20): USDC token contract interface
- `oracleAddress` (address): Authorized oracle for fund releases
- `admins` (address[]): Array of admin addresses
- `requiredApprovals` (uint256): Threshold for dispute execution

#### **Functions**

**Public/External Functions:**

1. **`createTrade(supplier, treasury, totalAmount, logisticsAmount, platformFeesAmount, supplierFirstTranche, supplierSecondTranche, ricardianHash)`**
   - Creates new escrow trade
   - Returns: `tradeId`
   - Emits: `TradeLocked`
   - Access: Anyone (Buyer)

2. **`releaseFunds(tradeId, newStatus)`**
   - Releases funds based on trade progression
   - Stage 1 (IN_TRANSIT): Pays treasury (logistics+fees) + supplier (tranche1)
   - Stage 2 (CLOSED): Pays supplier (tranche2)
   - Emits: `FundsReleased`
   - Access: `onlyOracle`

3. **`proposeDispute(tradeId, disputeStatus)`**
   - Creates dispute proposal
   - Returns: `proposalId`
   - Emits: `DisputeProposed`
   - Access: `onlyAdmin`

4. **`approveDispute(proposalId)`**
   - Adds admin approval to dispute proposal
   - Auto-executes `_dispute()` when threshold reached
   - Emits: `DisputeApproved`
   - Access: `onlyAdmin`

**Internal Functions:**

5. **`_dispute(proposalId)`**
   - Executes dispute resolution
   - Distributes funds based on `DisputeStatus`:
     - `REFUND`: Available amount: buyer
     - `RESOLVE`: Remaining payments: supplier/treasury (normal flow)
     - `PARTICULAR_ISSUE`: Available amount: treasury
   - Emits: `DisputeRaised`
   - Access: called by `approveDispute()`


#### **Modifiers**
- `onlyOracle` - Restricts to authorized oracle address
- `onlyAdmin` - Restricts to approved admin addresses
- `nonReentrant` - OpenZeppelin protection against reentrancy attacks

#### **Events**
- `TradeLocked(tradeId, buyer, supplier, totalAmount, ricardianHash)`: New trade created
- `FundsReleased(tradeId, treasury, supplier, status, logisticsReleased, feesReleased, tranche1Released, tranche2Released, ricardianHash)`: Funds distributed
- `DisputeProposed(proposalId, tradeId, disputeStatus, proposer)`: Dispute proposal created
- `DisputeApproved(proposalId, approver, approvalCount, requiredApprovals)`: Admin approval registered
- `DisputeRaised(tradeId, status, buyer, supplier, treasury, ricardianHash)`: Dispute executed


### Contract: `MockUSDC.sol`

ERC20 test token for local development and testing.


## Tests:

### Test Coverage Summary
| Framework | Type | Files | Tests |
|-----------|------|-------|-------|
| Hardhat | Unit Tests | `tests/AgroasysEscrow.ts` | 31 tests |
| Foundry | Stateless Fuzz | `foundry/test/AgroasysEscrowFuzz.t.sol` | 9 tests |
| Foundry | Stateful Invariants | `foundry/test/AgroasysEscrowInvariant.t.sol` | 8 invariants |

---

### Unit Tests `AgroasysEscrow.ts`
```
  AgroasysEscrow: creation trade
    Success:
      ✔ Should create a trade successfully
      ✔ Should create multiple trades (45ms)
    Failure:
      ✔ Should reject invalid ricardian hash
      ✔ Should reject invalid supplier address
      ✔ Should reject invalid treasury address
      ✔ Should reject mismatched amounts
      ✔ Should reject without approval

  AgroasysEscrow: releaseFunds
    Success:
      ✔ Should release stage 1 funds (IN_TRANSIT)
      ✔ Sould release stage 2 funds (CLOSED) (46ms)
      ✔ Sould execute the full lifecycle: from LOCKED to CLOSED (67ms)
      ✔ Should correctly track updatedAt after releases
    Failure:
      ✔ Should reject someone else than oracle calls releaseFunds
      ✔ Should reject if the trade doesn't exist
      ✔ Should reject stage 1 if status is not LOCKED
      ✔ Should reject stage 2 if status is not IN_TRANSIT
      ✔ Should reject if called with CLOSED new_status
      ✔ Should reject if trade is already CLOSED (43ms)

  AgroasysEscrow: dispute
    Success:
      ✔ Should raise a dispute (REFUND) (propose+approve) while trade is LOCKED (43ms)
      ✔ Should raise a dispute (RESOLVE) (propose+approve) while trade is LOCKED (49ms)
      ✔ Should raise a dispute (PARTICULAR_ISSUE) while trade is LOCKED (41ms)
      ✔ Should raise a dispute (REFUND) while trade is IN_TRANSIT (64ms)
      ✔ Should raise a dispute (RESOLVE) while trade is IN_TRANSIT (68ms)
      ✔ Should raise a dispute (PARTICULAR_ISSUE) while trade is IN_TRANSIT (65ms)
    Failure:
      ✔ Should reject if caller is not admin
      ✔ Should reject if trade doesn't exist
      ✔ Should reject if trade is CLOSED (64ms)
      ✔ Should reject if trade is DISPUTED (44ms)
      ✔ Should reject if proposeDispute is called before 7 days of inactivity
      ✔ Should reject approval of non-existent proposal
      ✔ Should reject double approval from same admin
      ✔ Should reject approval if the proposal has already been executed (44ms)


  31 passing (3s)

---------------------|----------|----------|----------|----------|----------------|
File                 |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
---------------------|----------|----------|----------|----------|----------------|
 src/                |    97.75 |       75 |    90.91 |    98.21 |                |
  AgroasysEscrow.sol |    98.85 |       75 |      100 |    99.09 |            311 |
  MockUSDC.sol       |       50 |      100 |    66.67 |       50 |             10 |
---------------------|----------|----------|----------|----------|----------------|
All files            |    97.75 |       75 |    90.91 |    98.21 |                |
---------------------|----------|----------|----------|----------|----------------|
```

### Stateless Fuzzing tests `AgroasysEscrowFuzz.t.sol`

```
Ran 9 tests for test/AgroasysEscrowFuzz.t.sol:FuzzTest
[PASS] testFuzz_CreateTrade(uint96,uint96,uint96,uint96) (runs: 10000, μ: 398562, ~: 398562)
[PASS] testFuzz_Dispute_PARTICULAR_ISSUE_funds_IN_TRANSIT(uint96,uint96,uint96,uint96) (runs: 10000, μ: 660193, ~: 660193)
[PASS] testFuzz_Dispute_PARTICULAR_ISSUE_funds_LOCKED(uint96,uint96,uint96,uint96) (runs: 10000, μ: 599205, ~: 599205)
[PASS] testFuzz_Dispute_REFUND_funds_IN_TRANSIT(uint96,uint96,uint96,uint96) (runs: 10000, μ: 640103, ~: 640103)
[PASS] testFuzz_Dispute_REFUND_funds_LOCKED(uint96,uint96,uint96,uint96) (runs: 10000, μ: 554327, ~: 554327)
[PASS] testFuzz_Dispute_RESOLVE_funds_IN_TRANSIT(uint96,uint96,uint96,uint96) (runs: 10000, μ: 660752, ~: 660752)
[PASS] testFuzz_Dispute_RESOLVE_funds_LOCKED(uint96,uint96,uint96,uint96) (runs: 10000, μ: 637951, ~: 637951)
[PASS] testFuzz_ReleaseFunds(uint96,uint96,uint96,uint96) (runs: 10000, μ: 491731, ~: 491731)
[PASS] test_Setup() (gas: 22830)
Suite result: ok. 9 passed; 0 failed; 0 skipped; finished in 3.01s (21.09s CPU time)

Ran 1 test suite in 3.01s (3.01s CPU time): 9 tests passed, 0 failed, 0 skipped (9 total tests)
```

### Statefull Fuzzing Invariant tests `AgroasysEscrowInvariant.t.sol`

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

8. **`invariant_TranchesSumEqualsTotal`**
   - logistics + fees + tranche1 + tranche2 = totalAmountLocked


## Scripts: 


## Set Up project

### Hardhat Config
```bash
cd contracts
yarn install
```

### Fondry Config
```bash
cd foundry
forge install --no-git foundry-rs/forge-std
forge install --no-git OpenZeppelin/openzeppelin-contracts
forge build
```


## Running Tests

### Hardhat Unit Tests
```bash
yarn compile
yarn test
yarn coverage
```

### Fondry Fuzzing Tests
```bash
cd foundry
forge build
forge test --match-contract FuzzTest -vvv
forge test --match-contract InvariantTest -vvv
```


## Next Steps
- Depolyement Scripts to Testnet
- Add NatSpec comments