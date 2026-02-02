module.exports = class Data1769982313175 {
    name = 'Data1769982313175'

    async up(db) {
        await db.query(`CREATE TABLE "trade_event" ("id" character varying NOT NULL, "event_name" text NOT NULL, "block_number" integer NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "tx_hash" text NOT NULL, "trade_id" character varying, CONSTRAINT "PK_728d9646fc0b297fd53619fa5e5" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_3408756ee41eca556530a91ad2" ON "trade_event" ("trade_id") `)
        await db.query(`CREATE INDEX "IDX_4c9748fae6f5f59c1de6e58b51" ON "trade_event" ("event_name") `)
        await db.query(`CREATE TABLE "trade" ("id" character varying NOT NULL, "trade_id" text NOT NULL, "buyer" text NOT NULL, "supplier" text NOT NULL, "status" character varying(17) NOT NULL, "total_amount_locked" numeric NOT NULL, "ricardian_hash" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_d4097908741dc408f8274ebdc53" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_db4539cb8962bc3722950ebf19" ON "trade" ("trade_id") `)
        await db.query(`CREATE INDEX "IDX_cfb8d86a3f28435445e132a2dc" ON "trade" ("buyer") `)
        await db.query(`CREATE INDEX "IDX_32ee6fe694d94ee5834c17a3b5" ON "trade" ("supplier") `)
        await db.query(`ALTER TABLE "trade_event" ADD CONSTRAINT "FK_3408756ee41eca556530a91ad2b" FOREIGN KEY ("trade_id") REFERENCES "trade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
    }

    async down(db) {
        await db.query(`DROP TABLE "trade_event"`)
        await db.query(`DROP INDEX "public"."IDX_3408756ee41eca556530a91ad2"`)
        await db.query(`DROP INDEX "public"."IDX_4c9748fae6f5f59c1de6e58b51"`)
        await db.query(`DROP TABLE "trade"`)
        await db.query(`DROP INDEX "public"."IDX_db4539cb8962bc3722950ebf19"`)
        await db.query(`DROP INDEX "public"."IDX_cfb8d86a3f28435445e132a2dc"`)
        await db.query(`DROP INDEX "public"."IDX_32ee6fe694d94ee5834c17a3b5"`)
        await db.query(`ALTER TABLE "trade_event" DROP CONSTRAINT "FK_3408756ee41eca556530a91ad2b"`)
    }
}
