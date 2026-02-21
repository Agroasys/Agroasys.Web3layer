# Ricardian Hash Reproducibility Runbook

## Purpose
Provide deterministic, operator-safe reproduction of Ricardian hash outputs for legal-to-chain integrity checks.

## Canonical Source Of Truth
- Hash builder: `ricardian/src/utils/hash.ts` (`buildRicardianHash`)
- Canonicalization: `ricardian/src/utils/canonicalize.ts` (`canonicalJsonStringify`)
- Rules version: `ricardian/src/types.ts` (`CANONICALIZATION_RULES_VERSION`)

The hash preimage is:
- `RICARDIAN_CANONICAL_V1:<canonicalJson>`

Where `canonicalJson` is built from this payload shape with sorted keys and `undefined` keys omitted:
- `{ "documentRef": <string>, "metadata": <object>, "terms": <object> }`

## Required Inputs
- `documentRef` (string, non-empty)
- `terms` (object)
- `metadata` (object, optional; defaults to `{}`)

`requestId` is accepted by the API but is not part of the hash preimage.

## Deterministic Reproduction Command
Prepare payload JSON:

```json
{
  "documentRef": "doc://trade-2026-0001",
  "metadata": {
    "tradeId": "1",
    "jurisdiction": "KE"
  },
  "terms": {
    "currency": "USDC",
    "incoterm": "FOB",
    "quantityMt": 100
  }
}
```

Run:

```bash
node scripts/reproduce-ricardian-hash.mjs --payload-file /tmp/ricardian-payload.json --pretty
```

Expected output format:

```json
{
  "documentRef": "doc://trade-2026-0001",
  "rulesVersion": "RICARDIAN_CANONICAL_V1",
  "canonicalJson": "{\"documentRef\":\"doc://trade-2026-0001\",\"metadata\":{\"jurisdiction\":\"KE\",\"tradeId\":\"1\"},\"terms\":{\"currency\":\"USDC\",\"incoterm\":\"FOB\",\"quantityMt\":100}}",
  "preimage": "RICARDIAN_CANONICAL_V1:{...canonicalJson...}",
  "hash": "<64-char lowercase hex>",
  "metadata": {
    "tradeId": "1",
    "jurisdiction": "KE"
  }
}
```

## API Contract (Required Payload + Output Format)
- Create hash:
  - `POST /api/ricardian/v1/hash`
  - Request payload fields:
    - `requestId?`, `documentRef`, `terms`, `metadata?`
  - Success response includes:
    - `id`, `requestId`, `documentRef`, `hash`, `rulesVersion`, `canonicalJson`, `metadata`, `createdAt`
- Fetch hash:
  - `GET /api/ricardian/v1/hash/:hash`
  - Returns the same typed record shape.

Controller behavior source: `ricardian/src/api/controller.ts`.

## SDK Helper Contract
- `sdk/src/modules/ricardianClient.ts`
  - `generateHash(payload)` expects `RicardianHashRequest`.
  - `getHash(hash)` returns `RicardianHashRecord`.
- Types are defined in `sdk/src/types/ricardian.ts`.

## Storage/Retrieval Path And Failure Handling
- Write path:
  - `ricardian/src/database/queries.ts#createRicardianHash`
  - Persists into `ricardian_hashes` with uniqueness on `(hash, document_ref)`.
  - Conflict behavior: update `metadata` and return row.
- Read path:
  - `ricardian/src/database/queries.ts#getRicardianHash`
  - Lookup by `hash`, latest row first.
- API failure mapping:
  - `400`: invalid payload or invalid hash format
  - `404`: hash not found
  - `500`: persistence/read failure

## Operator Failure Triage
1. Reproduce hash locally with `scripts/reproduce-ricardian-hash.mjs`.
2. Compare reproduced `canonicalJson` and `hash` with API response row.
3. If mismatch:
   - Verify payload field ordering/undefined handling assumptions.
   - Check `rulesVersion` consistency.
   - Check reconciliation findings for `HASH_MISMATCH`.
4. If API returns `500`, capture service logs and DB availability evidence, then escalate.

## Escalation Guidance
- Escalate immediately when:
  - same input set produces different hash across environments
  - repeated `HASH_MISMATCH` findings appear in reconciliation
  - Ricardian persistence/read path returns sustained `500`
- Include:
  - payload JSON
  - reproduced output (`canonicalJson`, `hash`, `rulesVersion`)
  - API request/response pair
  - relevant ricardian + reconciliation logs
