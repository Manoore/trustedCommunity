import { sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";

/** Shows what the most recent one-tap vouches actually stored. */
async function main() {
  const rows = (await db.execute(sql`
    SELECT u.email AS recommender, p.display_name AS contact, r.relationship, r.strength,
           r.visibility, r.note IS NULL AS no_note,
           (SELECT count(*)::int FROM recommendation_groups rg WHERE rg.recommendation_id = r.id) AS groups_scoped
    FROM recommendations r
    JOIN users u ON u.id = r.recommender_user_id
    JOIN providers p ON p.id = r.provider_id
    WHERE r.relationship = 'trusted_referral'
    ORDER BY r.created_at DESC
    LIMIT 5
  `)) as unknown as Array<Record<string, unknown>>;
  console.table(rows);
}

main()
  .then(() => conn.end())
  .catch(async (e) => {
    console.error(e);
    await conn.end();
    process.exit(1);
  });
