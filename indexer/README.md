# Indexer

This module indexes **AgroasysEscrow** on-chain events into a **queryable datastore** (PostgreSQL via TypeORM) and exposes a **read-only GraphQL** API for the Web2 platform layer.

It is designed for **auditability**, **idempotency**, and **re-org safety**, and must remain aligned with Agroasys business/security rules (especially around milestone releases, dispute flow, and fee handling).

---

## What this indexer does

### Core responsibilities

- **Ingest escrow contract events** from the target chain (Asset Hub Paseo / Polkadot Hub testnet environment).
- **Persist** normalized trade state + event history into Postgres (TypeORM models generated from `schema.graphql`).
- Provide a **read-only GraphQL interface** for the platform backend to query:
  - trades, participants, amounts, statuses
  - settlement milestones
  - dispute lifecycle and approvals
  - event timeline / audit trail
- Ensure indexing is:
  - **Idempotent** (replays do not duplicate rows or double-count amounts)
  - **Re-org safe** (handles block reorganizations with deterministic rollbacks)
  - **Config-driven** (no hardcoded RPC URLs / keys; env-based configuration)

### Events indexed (must match the on-chain contract)

The indexer is expected to capture and store the following escrow events:

- `TradeLocked`
- `FundsReleasedStage1`
- `PlatformFeesPaidStage1`
- `ArrivalConfirmed`
- `FinalTrancheReleased`
- `DisputeOpenedByBuyer`
- `DisputeSolutionProposed`
- `DisputeApproved`
- `DisputeFinalized`

> Note: If the contract changes event names/arguments, update:
> - the ABI/event decoder
> - `schema.graphql` types
> - mappings/handlers
> - this README’s event list

---

## Security & correctness requirements

### Configuration rules

- **No hardcoded RPC endpoints** or API keys.
- Use environment variables (`.env`) and validate configuration at startup.
- Use **approved/whitelisted endpoints only** (internal RPC or approved providers).
- Enforce **explicit block range limits** to avoid unbounded historical queries.

### Data integrity rules

- Writes must be **atomic and retry-safe**.
- Event handlers must:
  - validate the **expected contract address**
  - verify the **expected emitter/module** (where applicable)
  - enforce **deterministic primary keys** (e.g., `txHash + logIndex`) to guarantee idempotency

### Re-org handling

- Must handle chain **re-orgs** using finality checks and deterministic rollbacks.
- Avoid assumptions of immediate finality; prefer indexing based on finalized blocks where possible.

---

## Suggested directory layout

```text
indexer/
├── db/
├── src/
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── README.md
├── docker-compose.yml
├── package.json
├── schema.graphql
├── tsconfig.json
└── typegen.json
```
### Validation checklist

- Schema enforces strict types (no any equivalents).
- Event handlers verify the expected contract address and event types.
- Inserts/updates are idempotent and replay-safe.
- Re-org rollback behavior is deterministic and tested.
- GraphQL is read-only (no mutations).
- No secrets / endpoints are hardcoded in code.

---
### Local Dev

#### Prerequisites

- Node.js + npm
- Docker + Docker Compose
- A reachable RPC endpoint for the target network
- A deployed AgroasysEscrow contract address + deployment start block
- .env configured (see below)

#### Install and generate models/migrations

```
npm install

# generate TypeORM models from schema.graphql
npx squid-typeorm-codegen

# start the db container
docker compose up -d db

# generate migrations
rm -rf db/migrations
npx squid-typeorm-migration generate

# apply the migrations
npx squid-typeorm-migration apply
```

#### Build and run

```
# compile the code
npm run build

# run the indexer
node -r dotenv/config lib/main.js
```
---
### Updating `schema.graphql`

When you edit `schema.graphql`, you must re-generate models and migrations:

```
npx squid-typeorm-codegen

rm -rf db/migrations

npx squid-typeorm-migration generate

npx squid-typeorm-migration apply

npm run build
node -r dotenv/config lib/main.js
```
---
### Running the indexer in Docker

```
# generate TypeORM models
npx squid-typeorm-codegen

# start the db
docker compose up -d db

# regenerate migrations
rm -r db/migrations
npx squid-typeorm-migration generate

# apply migrations inside the container context
docker compose run --rm indexer npx squid-typeorm-migration apply

# start everything
docker compose up -d

# follow logs
docker compose logs -f
```

---
### Operational notes

1. Always confirm the gateway and rpc point to the same network dataset.
2. If you see missing blocks / “Failed to fetch block …” errors:
   - confirm your start block exists in the gateway dataset
   - confirm your gateway URL matches the deployed chain (Asset Hub Paseo vs Polkadot vs other)
   - reduce RPC rate limits if your provider is throttling

3. If events appear on Subscan but not in the indexer:
   - confirm the processor event filters match the emitted event names
   - confirm the ABI/decoder matches the deployed contract build
   - confirm contract address filtering is correct

---
### GraphQL API

The indexer exposes a GraphQL endpoint for read-only queries. Use it from the backend to retrieve:
- Trade lifecycle state (LOCKED → IN_TRANSIT → ARRIVAL_CONFIRMED → CLOSED/FROZEN)
- Milestone settlements (stage 1 releases and final tranche)
- Dispute proposals, approvals, and final outcomes
- Full event timelines for audits

> Do not expose write/mutation operations from this indexer.
