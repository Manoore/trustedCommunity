import { sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";

/**
 * Phone verification, applied by hand.
 *
 * `drizzle-kit push` cannot be trusted on the production database (it offers to
 * truncate tables for constraints that already exist), so everything this
 * feature needs is written out here. Every statement is additive and safe to
 * repeat: nothing is dropped, nothing is truncated, no existing row changes.
 */
const STATEMENTS = [
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_phone text`,
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at timestamp with time zone`,
  sql`DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_verified_phone_unique UNIQUE (verified_phone);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  sql`CREATE TABLE IF NOT EXISTS phone_verifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        user_id uuid NOT NULL,
        phone text NOT NULL,
        channel text NOT NULL DEFAULT 'whatsapp',
        code_hash text NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        expires_at timestamp with time zone NOT NULL,
        consumed_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT phone_verifications_user_id_users_id_fk
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade ON UPDATE no action
      )`,
  sql`CREATE INDEX IF NOT EXISTS phone_verifications_user_idx ON phone_verifications (user_id)`,
  sql`CREATE INDEX IF NOT EXISTS phone_verifications_phone_idx ON phone_verifications (phone, created_at)`,
];

async function main() {
  for (const statement of STATEMENTS) await db.execute(statement);
  console.log(`Applied ${STATEMENTS.length} statements.`);
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
