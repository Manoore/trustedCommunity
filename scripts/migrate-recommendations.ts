import { sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";

/**
 * Adds the recommendation-layer columns to `providers` in place.
 *
 * Done by hand rather than through `drizzle-kit push` because push offers to
 * truncate the table to add the unique phone constraint, which would destroy
 * existing provider rows. Every new column is nullable or defaulted, and
 * normalized_phone starts out NULL everywhere, so the unique constraint applies
 * without conflict. Safe to run repeatedly.
 */
const STATEMENTS = [
  sql`DO $$ BEGIN
        CREATE TYPE contact_kind AS ENUM ('business', 'individual');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  sql`ALTER TABLE providers
        ADD COLUMN IF NOT EXISTS kind contact_kind NOT NULL DEFAULT 'business'`,
  sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS normalized_phone text`,
  sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS created_by_user_id uuid`,
  sql`ALTER TABLE providers
        ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone`,
  sql`ALTER TABLE providers
        ADD COLUMN IF NOT EXISTS removal_requested_at timestamp with time zone`,
  sql`ALTER TABLE providers
        ADD COLUMN IF NOT EXISTS hidden_at timestamp with time zone`,

  sql`DO $$ BEGIN
        ALTER TABLE providers ADD CONSTRAINT providers_created_by_user_id_users_id_fk
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  sql`DO $$ BEGIN
        ALTER TABLE providers ADD CONSTRAINT providers_phone_unique
          UNIQUE (normalized_phone);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  sql`CREATE INDEX IF NOT EXISTS providers_kind_idx ON providers (kind)`,
];

async function main() {
  for (const statement of STATEMENTS) {
    await db.execute(statement);
  }
  console.log(`Applied ${STATEMENTS.length} statements to providers.`);
  console.log("Now run: npx drizzle-kit push --force");
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
