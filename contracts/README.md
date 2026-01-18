# Solidity Smart Contracts (PolkaVM)

## What is implemented

### Contract: `AgroasysEscrow.sol`

#### **Enums**
- `TradeStatus`: LOCKED, IN_TRANSIT, CLOSED, DISPUTED
- `DisputeStatus`: REFUND, RESOLVE, PARTICULAR_ISSUE

#### **Struct**
- `Trade`: Complete trade data structure with:
  - Trade metadata (tradeId, ricardianHash, status)
  - Addresses (buyer, supplier, treasury)
  - Payment breakdown (logistics, platform fees, supplier tranches)
  - Timestamps (createdAt, updatedAt)

#### **State Variables**
- `trades`: Mapping of trade IDs to Trade structs
- `tradeCounter`: Auto-incrementing trade ID generator
- `oracleAddress`: Authorized oracle address
- `usdcToken`: IERC20 token interface
- `admins`: Admin access control mapping

#### **Functions Implemented**

1. **`createTrade()`** 
   - Locks funds from buyer into escrow
   - Validates all inputs and amounts
   - Stores trade data on-chain
   - Emits `TradeLocked` event

2. **`releaseFunds()`**
   - Oracle-only function to release payments
   - Stage 1 (IN_TRANSIT): Releases logistics + platform fees to treasury, 40% to supplier
   - Stage 2 (CLOSED): Releases remaining 60% to supplier
   - Atomic execution (all pass or nothing pass)
   - Emits `FundsReleased` event

3. **`dispute()`**
   - Admin emergency intervention function
   - 7-day timeout protection
   - Three resolution options: REFUND, RESOLVE, PARTICULAR_ISSUE
   - Emits `DisputeRaised` event

#### **Events**
- `TradeLocked`: Emitted when a new trade is created
- `FundsReleased`: Emitted when funds are released (Stage 1 or 2)
- `DisputeRaised`: Emitted when admin resolves a dispute

#### **Modifiers**
- `onlyOracle`: Restricts access to oracle address
- `onlyAdmin`: Restricts access to admin addresses
- `nonReentrant`: OpenZeppelin reentrancy protection


## What do to next

- Implement multisig for calling dispute
- In depth test with Hardhat and Foundry
- Deployement script on a Testnet
