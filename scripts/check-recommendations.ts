import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import { providers, shareLinks, users } from "../src/db/schema";

/**
 * Integration checks for the recommendation layer. Hits the running server.
 *
 * The rules that matter here: a private individual's number is not public, a
 * `private` recommendation stays out of a shared list, and one phone number
 * means one contact.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function fetchPage(path: string, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { cookie: `classifieds_session=${token}` } : {},
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}

let ok = true;
function assert(label: string, condition: boolean) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) ok = false;
}

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error("usage: tsx scripts/check-recommendations.ts <buyer-session-token>");
    process.exit(1);
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "buyer@example.com"))
    .limit(1);

  // Sarah Johnson is seeded as a private individual.
  const [individual] = await db
    .select({
      slug: providers.slug,
      phone: providers.contactPhone,
      e164: providers.normalizedPhone,
    })
    .from(providers)
    .where(eq(providers.displayName, "Sarah Johnson"))
    .limit(1);

  const [business] = await db
    .select({ slug: providers.slug, phone: providers.contactPhone })
    .from(providers)
    .where(eq(providers.displayName, "Mike's Plumbing"))
    .limit(1);

  if (!owner || !individual || !business) {
    console.error("Fixtures missing. Run npm run db:seed then seed:recs.");
    process.exit(1);
  }

  /* ------------------------------------------------- individual privacy */

  const anonProfile = await fetchPage(`/p/${individual.slug}`);
  assert("individual profile loads for anyone", anonProfile.status === 200);
  assert(
    "anonymous: private individual's number is NOT shown",
    !anonProfile.html.includes(individual.phone ?? "@@"),
  );
  assert(
    "anonymous: masked form is shown instead",
    anonProfile.html.includes("only shared with people who"),
  );

  const ownerProfile = await fetchPage(`/p/${individual.slug}`, token);
  assert(
    "the person who added them CAN see the number",
    ownerProfile.html.includes(individual.phone ?? "@@"),
  );

  /* --------------------------------------------------- share visibility */

  const shareToken = randomBytes(9).toString("base64url");
  await db
    .insert(shareLinks)
    .values({ token: shareToken, kind: "list", userId: owner.id });

  const shared = await fetchPage(`/s/${shareToken}`);
  assert("shared list is public (no account)", shared.status === 200);
  assert(
    "shared list includes a link-visibility entry",
    shared.html.includes("Mike&#x27;s Plumbing") || shared.html.includes("Mike's Plumbing"),
  );
  assert(
    "shared list EXCLUDES a private entry",
    !shared.html.includes("Priya Nair"),
  );
  assert(
    "shared list shows the recommender's name",
    shared.html.includes("Dana Buyer"),
  );

  /* ------------------------------------------------------------ dedupe */

  const [dupes] = (await db.execute(sql`
    SELECT count(*)::int AS n FROM providers
    WHERE normalized_phone = ${individual.e164}
  `)) as unknown as Array<{ n: number }>;
  assert("one phone number maps to exactly one contact", Number(dupes.n) === 1);

  const [orphanPhones] = (await db.execute(sql`
    SELECT count(*)::int AS n FROM (
      SELECT normalized_phone FROM providers
      WHERE normalized_phone IS NOT NULL
      GROUP BY normalized_phone HAVING count(*) > 1
    ) d
  `)) as unknown as Array<{ n: number }>;
  assert("no duplicate phone numbers anywhere", Number(orphanPhones.n) === 0);

  /* ------------------------------------------------------- claim path */

  const claim = await fetchPage(`/claim/${individual.slug}`);
  assert("claim page reachable without an account", claim.status === 200);
  assert(
    "claim page offers removal",
    claim.html.includes("Remove me from this site"),
  );

  /* --------------------------------------------------- own list works */

  const list = await fetchPage("/list", token);
  assert("own list shows the private entry to its owner", list.html.includes("Priya Nair"));

  await db.delete(shareLinks).where(eq(shareLinks.token, shareToken));

  console.log(ok ? "\nAll recommendation checks passed." : "\nSome checks FAILED.");
  if (!ok) process.exitCode = 1;
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
