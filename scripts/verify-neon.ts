import { sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";

async function main() {
  const rows = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM categories) AS categories,
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM providers) AS providers,
      (SELECT count(*)::int FROM recommendations) AS recommendations,
      (SELECT count(*)::int FROM groups) AS groups,
      (SELECT count(*)::int FROM connections) AS connections,
      (SELECT count(*)::int FROM asks) AS asks
  `)) as unknown as Array<Record<string, number>>;
  console.log(rows[0]);
}

main()
  .then(() => conn.end())
  .catch(async (e) => {
    console.error(e);
    await conn.end();
    process.exit(1);
  });
