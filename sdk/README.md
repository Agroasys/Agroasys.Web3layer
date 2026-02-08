# TypeScript SDK for Frontend Integration

## Overview

This SDK provides a **type-safe, role-based interface** to the Agroasys smart contract.


## Architecture

The SDK is organized into **three role-based modules**:

* **BuyerSDK** - Create trades, approve USDC, open disputes
* **OracleSDK** - Release funds at logistics milestones, confirm arrival, finalize trade (**Auth verification**)
* **AdminSDK** - Solve frozen trades, propose/approve/execute governance actions (oracle/admin updates) (**Auth verification**)

All modules extend a shared **Client** base class, which handles provider initialization and common contract reads.

### Project Structure

```
.
├── jest.config.js
├── package.json
├── README.md
├── src
│   ├── client.ts
│   ├── config.ts
│   ├── index.ts
│   ├── modules
│   │   ├── adminSDK.ts
│   │   ├── buyerSDK.ts
│   │   └── oracleSDK.ts
│   ├── types
│   │   ├── dispute.ts
│   │   ├── errors.ts
│   │   ├── governance.ts
│   │   ├── oracle.ts
│   │   ├── trade.ts
│   │   └── typechain-types
│   │       └── // copied from contract module
│   └── utils
│       ├── signature.ts
│       └── validation.ts
├── tests
│   ├── adminSDK.test.ts
│   ├── buyerSDK.test.ts
│   ├── oracleSDK.test.ts
│   └── setup.ts
└── tsconfig.json
```



## Installation & Configuration

```
import { BuyerSDK } from '@agroasys/sdk';

const config = {
  rpc: '',
  chainId: 420420417,
  escrowAddress: '',
  usdcAddress: ''
};

const buyerSDK = new BuyerSDK(config);

const result = await buyerSDK.createTrade(tradeParams, buyerSigner);
```


## Functions

### BuyerSDK

| Method                         | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `getBuyerNonce(address)`       | Retrieve the current nonce for signature         |
| `approveUSDC(amount, signer)`  | Approve the escrow contract to spend USDC        |
| `getUSDCBalance(address)`      | Check USDC balance                               |
| `getUSDCAllowance(address)`    | Check current USDC allowance for escrow          |
| `createTrade(params, signer)`  | Lock funds and create a new trade                |
| `openDispute(tradeId, signer)` | Open a dispute on an existing trade              |



### OracleSDK

| Method                                        | Description                                              |
| --------------------------------------------- | -------------------------------------------------------- |
| `releaseFundsStage1(tradeId, signer)`         | Release first tranche                                    |
| `confirmArrival(tradeId, signer)`             | Confirm goods arrival at destination                     |
| `finalizeAfterDisputeWindow(tradeId, signer)` | Release final tranche after dispute window               |



### AdminSDK

| Method                                            | Description                                          |
| ------------------------------------------------- | ---------------------------------------------------- |
| `proposeDisputeSolution(tradeId, status, signer)` | Propose a dispute resolution (`REFUND` or `RESOLVE`) |
| `approveDisputeSolution(proposalId, signer)`      | Approve a pending dispute proposal                   |
| `proposeOracleUpdate(newOracle, signer)`          | Propose a new oracle address                         |
| `approveOracleUpdate(proposalId, signer)`         | Approve oracle update proposal                       |
| `executeOracleUpdate(proposalId, signer)`         | Execute approved oracle update                       |
| `proposeAddAdmin(newAdmin, signer)`               | Propose adding a new admin                           |
| `approveAddAdmin(proposalId, signer)`             | Approve admin addition proposal                      |
| `executeAddAdmin(proposalId, signer)`             | Execute approved admin addition                      |



## Testing

Integration tests require the `.env` values below. If required values are missing, the SDK integration suites are skipped.

```
npm run test:buyer
npm run test:oracle
npm run test:admin
```



## Environment Variables

Create a `.env` file at the project root:

```
# Network configuration
RPC_URL=
CHAIN_ID=

# Contract addresses
ESCROW_ADDRESS=
USDC_ADDRESS=

# Test wallets
BUYER_PRIVATE_KEY=
ORACLE_PRIVATE_KEY=
ADMIN1_PRIVATE_KEY=
ADMIN2_PRIVATE_KEY=
```
