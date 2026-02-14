# Oracle Signing Service

Secure oracle service that automates blockchain transactions in the Agroasys ecosystem.

## Files
```
.
├── docker-compose.yml
├── Dockerfile
├── jest.config.js
├── package.json
├── README.md
├── src
│   ├── api
│   │   ├── controller.ts
│   │   └── routes.ts
│   ├── blockchain
│   │   ├── indexer-client.ts
│   │   └── sdk-client.ts
│   ├── config.ts
│   ├── core
│   │   ├── state-validator.ts
│   │   └── trigger-manager.ts
│   ├── database
│   │   ├── connection.ts
│   │   ├── migrations.ts
│   │   ├── queries.ts
│   │   └── schema.sql
│   ├── middleware
│   │   └── middleware.ts
│   ├── server.ts
│   ├── types
│   │   ├── api.ts
│   │   ├── config.ts
│   │   ├── index.ts
│   │   └── trigger.ts
│   ├── utils
│   │   ├── crypto.ts
│   │   ├── errors.ts
│   │   └── logger.ts
│   └── worker
│       └── confirmation-worker.ts
├── tests
│   └── oracle.test.ts
└── tsconfig.json
```


## Purpose

The oracle automatically executes trade state transitions (release funds, confirm arrival, finalize) while ensuring:

* Idempotency - No double execution
* Resilience - Automatic retries with exponential backoff
* Verification - Confirmation via indexer and on-chain state


## Main Flow

1. Web2 Backend
   `POST /release-stage1`

2. Oracle API

   * Generates `action_key` and `request_id`
   * Checks idempotency (database lookup)

3. Trigger Manager

   * Validates trade state on-chain
   * Creates trigger in database

4. Retry Loop

   * Executes blockchain action via SDK
   * Applies exponential backoff on failure

5. Transaction Submitted

   * Status: `SUBMITTED`
   * Stores `tx_hash` and `block_number`

6. Confirmation Worker (polls every 10 seconds)

   * Verifies event in indexer
   * Status: `CONFIRMED`


## Trigger Statuses

* `PENDING` - Waiting to execute
* `EXECUTING` - Execution in progress
* `SUBMITTED` - Transaction sent to network
* `CONFIRMED` - Confirmed by indexer
* `EXHAUSTED_NEEDS_REDRIVE` - Max retries reached, requires redrive
* `TERMINAL_FAILURE` - Permanent failure (validation error)


## Idempotency Model

The action key represents the business identity of the operation.
The request ID is unique per execution attempt.

This design allows the system to distinguish a single business action from multiple retry attempts and prevents duplicate execution.


## Authentication

All requests require HMAC signature verification and API key.


## Endpoints

* POST /release-stage1
* POST /confirm-arrival
* POST /finalize-trade
* POST /redrive
* GET /health

