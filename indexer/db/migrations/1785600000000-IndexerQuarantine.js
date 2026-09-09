module.exports = class IndexerQuarantine1785600000000 {
  name = 'IndexerQuarantine1785600000000';

  async up(db) {
    await db.query(`CREATE TABLE "indexer_quarantined_log" (
      "id" bigserial NOT NULL,
      "block_number" bigint NOT NULL,
      "block_hash" text NOT NULL,
      "tx_hash" text NOT NULL,
      "log_index" integer NOT NULL,
      "transaction_index" integer NOT NULL,
      "contract_address" text NOT NULL,
      "topics" text array NOT NULL,
      "data" text NOT NULL,
      "reason" text NOT NULL,
      "error_message" text NOT NULL,
      "abi_fingerprint" text NOT NULL,
      "event_name" text,
      "status" text NOT NULL DEFAULT 'UNRESOLVED',
      "first_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
      "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
      "occurrences" integer NOT NULL DEFAULT 1,
      "resolved_at" timestamp with time zone,
      "resolution_note" text,
      CONSTRAINT "pk_indexer_quarantined_log" PRIMARY KEY ("id"),
      CONSTRAINT "ck_indexer_quarantined_log_status" CHECK ("status" IN ('UNRESOLVED', 'RESOLVED')),
      CONSTRAINT "ck_indexer_quarantined_log_reason" CHECK ("reason" IN ('UNDECODABLE', 'UNKNOWN_EVENT', 'HANDLER_FAILURE'))
    )`);
    await db.query(
      `CREATE UNIQUE INDEX "uq_indexer_quarantined_log_identity" ON "indexer_quarantined_log" ("block_number", "tx_hash", "log_index")`,
    );
    await db.query(
      `CREATE INDEX "idx_indexer_quarantined_log_status" ON "indexer_quarantined_log" ("status")`,
    );
  }

  async down(db) {
    // Unresolved rows are the only durable evidence of an escrow log the
    // projection never absorbed. Dropping the table while any remain would
    // destroy that evidence and silently release the checkpoint hold.
    const unsafeResult = await db.query(`
      SELECT COUNT(*)::integer AS "count"
      FROM "indexer_quarantined_log"
      WHERE "status" = 'UNRESOLVED'
    `);
    const unresolved = Array.isArray(unsafeResult)
      ? Number(unsafeResult[0]?.count ?? 0)
      : Number(unsafeResult?.rows?.[0]?.count ?? 0);
    if (unresolved > 0) {
      throw new Error(
        `Refusing to drop indexer_quarantined_log while ${unresolved} quarantined log(s) are unresolved`,
      );
    }

    await db.query(`DROP INDEX "idx_indexer_quarantined_log_status"`);
    await db.query(`DROP INDEX "uq_indexer_quarantined_log_identity"`);
    await db.query(`DROP TABLE "indexer_quarantined_log"`);
  }
};
