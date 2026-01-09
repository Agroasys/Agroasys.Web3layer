# **Agroasys Settlement Protocol**

_**The trustless settlement engine for cross-border commodities trade.**_

The Agroasys Web3 Layer is a modular, non-custodial settlement infrastructure built on Polkadot AssetHub. It is designed to replace traditional Letters of Credit (LC) with cryptographically secured, two-stage smart contract escrows.

While built as the settlement engine for the Agroasys Platform, this protocol is open-source and agnostic, allowing any B2B marketplace to integrate trustless stablecoin settlement with Ricardian legal enforceability.

## **Architecture**

This repository houses the "Settlement Layer" of the architecture. It is designed to operate seamlessly alongside off-chain "Shadow Ledgers" or Web2 marketplaces, serving as the immutable source of truth for funds.

![web3layer](https://github.com/user-attachments/assets/c2677f8f-b430-42f6-a267-285683da74df)

### Core Components

- **Escrow Smart Contract** (`/contracts`) : A Solidity-based state machine deployed on PolkaVM. It handles the locking, dispute resolution, and atomic splitting of funds.

- **Oracle Service** (`/oracle`): A hardened Node.js service that bridges real-world logistics events (API Webhooks) to on-chain triggers, enabling automated release of funds without human intervention.

- **Ricardian Proofs**: The protocol does not store PDF data on-chain. Instead, it enforces a "Hash-First" architecture where every trade is anchored by a SHA-256 hash of the off-chain legal contract.

- **Indexer Service** (`/indexer`): A custom SubQuery/Squid instance that indexes `TradeLocked` and `FundsReleased` events to sync on-chain state with off-chain UIs or databases.

## **How It Works**

The protocol implements a deterministic Two-Stage Settlement Mechanism. This architecture allows for capital efficiency in complex transactions where operational costs, platform fees, or partial milestones must be funded before final delivery, without compromising the security of the principal amount.

### The Lifecycle

**1. Lock (Encumbrance)**

- **Action**: The Payer (Buyer/Client) deposits `USDC` (or any asset ID) into the Escrow Contract.

- **State**: The protocol records the `ricardianHash` (Immutable Proof of Agreement) and encumbers the funds, splitting the total value into `stageOneAmount` (Operational/Fee) and `stageTwoAmount` (Net Settlement).

**2. Stage 1 Release (Intermediary / Operational)**

- **Trigger**: Validated documentation (e.g., Bill of Lading, Export Permit).
  
- **Action**: The protocol releases **40% (configurable)** of funds to the `TreasuryWallet` to cover immediate logistics and platform fees.

**3. Stage 2 Release (Final Settlement)**

- **Purpose**: Funding platform fees, shipping labels, down payments, or operational overhead.

- **Trigger**: A verified off-chain signal (e.g., `KYC_VERIFIED`, `SHIPPED`, or `MILESTONE_1_MET`) authenticated by the Oracle.

- **Action**: The protocol atomically releases the configurable Stage 1 % to the designated operational wallet (Treasury or Service Provider)

**3. Stage 2 Release (Final Settlement)**

- **Purpose**: Net payment to the ultimate beneficiary upon contract fulfillment.

- **Trigger**: Final confirmation signal (e.g., `DELIVERED`, `MERGED`, or `ACCEPTED`).

- **Action**: The protocol releases the remaining Stage 2 % directly to the Payee (Seller/Provider), closing the contract state.

## Tech Stack

The protocol is built on a modular stack designed for high throughput and cross-chain interoperability.

**Core Protocol & Languages**

- **Smart Contracts**: Solidity (via Solang/Revive compilers targeting RISC-V PolkaVM).

- **Scripting & Logic**: TypeScript (Node.js v18+ runtime).

- **Infrastructure**: Docker & Docker Compose (Containerization).

**Infrastructure Layers**

- **Network**: Polkadot AssetHub (System Parachain) – Utilized for low-cost, native stablecoin settlement.

- **Gas Abstraction**: Asset Conversion Pallet – Enables "Gasless" UX by allowing transaction fees to be paid in `USDC` rather than the native token (`DOT`).

- **Indexing & Querying**: SubQuery / Squid SDK (GraphQL interface over Postgres).

- **Development Framework**: Hardhat (primary testing environment) / Foundry (fuzzing).

- **Oracle Runtime**: Node.js (Isolated Environment for key management and webhook ingress).

## **Repository Structure**

```
agroasys-web3/
├── contracts/          # Solidity Smart Contracts (PolkaVM)
│   ├── AgroasysEscrow.sol
│   └── interfaces/     # IERC20 & Polkadot Precompiles
├── scripts/            # Deployment & Verification scripts
├── oracle/             # The Oracle Signing Service (Node.js)
├── indexer/            # SubQuery/Squid Indexer Schema
├── sdk/                # TypeScript SDK for Frontend Integration
└── test/               # Hardhat Unit & Integration Tests
```
## **Security & "Invisible Wallet" Features**

- **Gas Abstraction (The "Gas Station")** - This protocol utilizes the Asset Conversion Pallet. Users do not need to hold DOT to interact with the contract. The protocol automatically swaps a fraction of the deposited USDC to pay for execution gas, enabling a "Gasless" UX for enterprise clients.

- **Oracle Isolation** - The `releaseFunds` function is protected by an `onlyOracle` modifier. The Oracle Service is designed to run in a completely isolated environment (TEE or separate VPC) with restricted key access to prevent unauthorized draining of the escrow.

- **Ricardian Integrity** - The contract is agnostic to the content of the trade but strict about the Proof of Agreement. The `ricardianHash` is immutable once locked. This allows any court or auditor to mathematically verify that the funds on-chain correspond exactly to the PDF contract signed off-chain.

## **Contributing**

We welcome contributions from the Web3 and Trade Finance communities. Please read `CONTRIBUTING.md` for details on our code of conduct and the process for submitting pull requests.

##### Built with ❤️ for the future of Trade.
