import { isNotNull } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import { providers } from "../src/db/schema";

/** Prints profile URLs for seeded contacts, for manual poking around. */
async function main() {
  const rows = await db
    .select({ name: providers.displayName, slug: providers.slug, kind: providers.kind })
    .from(providers)
    .where(isNotNull(providers.normalizedPhone));

  for (const row of rows) {
    console.log(`${row.kind.padEnd(11)} ${row.name.padEnd(28)} /p/${row.slug}`);
  }
}

main()
  .then(() => conn.end())
  .catch(async (e) => {
    console.error(e);
    await conn.end();
    process.exit(1);
  });
