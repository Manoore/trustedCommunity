import { sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";

/**
 * Adds the one unique constraint on an existing table that `drizzle-kit push`
 * would otherwise offer to apply by truncating `users`.
 *
 * edu_email starts out NULL on every row and Postgres treats NULLs as distinct
 * in a unique constraint, so this applies without conflict and without touching
 * any data. Run it BEFORE `npx drizzle-kit push --force`; safe to repeat.
 */
const STATEMENTS = [
  sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS edu_email text`,
  sql`DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_edu_email_unique UNIQUE (edu_email);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

async function main() {
  for (const statement of STATEMENTS) await db.execute(statement);
  console.log(`Applied ${STATEMENTS.length} statements to users.`);
  console.log("Now run: npx drizzle-kit push --force");
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
