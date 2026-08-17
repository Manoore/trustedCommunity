import { sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";

/**
 * Wipes all application data but leaves the schema in place. Run `npm run
 * db:seed` afterwards to repopulate.
 */
const TABLES = [
  "reviews",
  "inquiry_messages",
  "inquiries",
  "featured_orders",
  "listing_media",
  "listings",
  "verifications",
  "reports",
  "provider_members",
  "providers",
  "categories",
  "sessions",
  "users",
];

async function main() {
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`),
  );
  console.log(`Truncated ${TABLES.length} tables.`);
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
