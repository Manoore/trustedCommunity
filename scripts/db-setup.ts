import { db, sql as conn } from "./_client";
import { extraIndexStatements } from "../src/db/schema";

/**
 * Applies the full-text indexes and check constraints that drizzle-kit cannot
 * express in the schema DSL. Safe to run repeatedly.
 */
async function main() {
  for (const statement of extraIndexStatements) {
    await db.execute(statement);
  }
  console.log(`Applied ${extraIndexStatements.length} extra DDL statements.`);
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
