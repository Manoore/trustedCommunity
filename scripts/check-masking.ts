import { sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";

/**
 * Integration check for the rule the whole marketplace depends on: a provider's
 * real phone and email must not appear on a listing page until that provider
 * has replied to that buyer's inquiry.
 *
 * Hits the running dev server, so start it first.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function fetchPage(path: string, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { cookie: `classifieds_session=${token}` } : {},
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}

function assert(label: string, condition: boolean) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  return condition;
}

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error("usage: tsx scripts/check-masking.ts <buyer-session-token>");
    process.exit(1);
  }

  // A listing whose inquiry from buyer@example.com is already unlocked.
  const [unlocked] = (await db.execute(sql`
    SELECT l.slug, p.contact_phone, p.contact_email
    FROM inquiries i
    JOIN listings l ON l.id = i.listing_id
    JOIN providers p ON p.id = i.provider_id
    JOIN users u ON u.id = i.buyer_user_id
    WHERE u.email = 'buyer@example.com'
      AND i.contact_unlocked_at IS NOT NULL
      AND p.contact_phone IS NOT NULL
    LIMIT 1
  `)) as unknown as Array<Record<string, string>>;

  // A listing this buyer has never contacted.
  const [locked] = (await db.execute(sql`
    SELECT l.slug, p.contact_phone, p.contact_email
    FROM listings l
    JOIN providers p ON p.id = l.provider_id
    WHERE l.status = 'active'
      AND p.contact_phone IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM inquiries i
        JOIN users u ON u.id = i.buyer_user_id
        WHERE i.provider_id = p.id AND u.email = 'buyer@example.com'
      )
    LIMIT 1
  `)) as unknown as Array<Record<string, string>>;

  if (!unlocked || !locked) {
    console.error("Could not find suitable fixtures. Re-run npm run db:seed.");
    process.exit(1);
  }

  let ok = true;

  const anonLocked = await fetchPage(`/listings/${locked.slug}`);
  ok = assert("anonymous: listing page loads", anonLocked.status === 200) && ok;
  ok =
    assert(
      "anonymous: provider phone is NOT exposed",
      !anonLocked.html.includes(locked.contact_phone),
    ) && ok;
  ok =
    assert(
      "anonymous: provider email is NOT exposed",
      !anonLocked.html.includes(locked.contact_email),
    ) && ok;
  ok =
    assert(
      "anonymous: masked placeholder is shown",
      anonLocked.html.includes("Full details unlock"),
    ) && ok;

  const buyerLocked = await fetchPage(`/listings/${locked.slug}`, token);
  ok =
    assert(
      "buyer with no inquiry: phone still NOT exposed",
      !buyerLocked.html.includes(locked.contact_phone),
    ) && ok;

  const anonUnlocked = await fetchPage(`/listings/${unlocked.slug}`);
  ok =
    assert(
      "anonymous on a replied listing: phone still NOT exposed",
      !anonUnlocked.html.includes(unlocked.contact_phone),
    ) && ok;

  const buyerUnlocked = await fetchPage(`/listings/${unlocked.slug}`, token);
  ok =
    assert(
      "buyer after provider replied: phone IS exposed",
      buyerUnlocked.html.includes(unlocked.contact_phone),
    ) && ok;
  ok =
    assert(
      "buyer after provider replied: email IS exposed",
      buyerUnlocked.html.includes(unlocked.contact_email),
    ) && ok;

  // Restricted categories must never surface in search.
  const search = await fetchPage("/search?q=legal");
  ok =
    assert(
      "search: restricted categories excluded",
      !search.html.includes("Legal Services"),
    ) && ok;

  // Thin-supply behaviour: a remote ZIP should widen rather than dead-end.
  const thin = await fetchPage("/search?loc=59001&category=house-cleaning");
  ok =
    assert(
      "search: thin area widens or offers the first-provider CTA",
      thin.html.includes("widened to") || thin.html.includes("the spot is open"),
    ) && ok;

  console.log(ok ? "\nAll masking checks passed." : "\nSome checks FAILED.");
  if (!ok) process.exitCode = 1;
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
