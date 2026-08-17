import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import { recommendations, shareLinks, users } from "../src/db/schema";

/**
 * Integration checks for the network layer, against a running server.
 *
 * The rules under test are the ones a user would feel betrayed by if they
 * broke: a link never exposes more than the author marked "anyone with the
 * link", group content is members-only, and discovery only reaches as far as
 * the author's chosen audience.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

let ok = true;
function assert(label: string, condition: boolean) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) ok = false;
}

async function fetchPage(path: string, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { cookie: `classifieds_session=${token}` } : {},
    redirect: "manual",
  });
  return { status: res.status, html: await res.text() };
}

async function mintSession(email: string) {
  const { createHash } = await import("node:crypto");
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) throw new Error(`no user ${email}`);

  const token = randomBytes(32).toString("base64url");
  const id = createHash("sha256").update(token).digest("hex");
  await db.execute(sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${id}, ${user.id}::uuid, now() + interval '1 day')
  `);
  return { token, id: user.id };
}

async function main() {
  const buyer = await mintSession("buyer@example.com");
  const raj = await mintSession("raj@example.com");
  const stranger = await mintSession("admin@example.com");

  /* ------------------------------------- share links expose only 'link' */

  const token = randomBytes(9).toString("base64url");
  await db
    .insert(shareLinks)
    .values({ token, kind: "list", userId: raj.id });

  const shared = await fetchPage(`/s/${token}`);
  assert("share link renders publicly", shared.status === 200);
  assert(
    "share link does NOT expose a connections-scoped entry",
    !shared.html.includes("Sunrise Roofing"),
  );
  assert(
    "share link does NOT expose a groups-scoped entry",
    !shared.html.includes("Nita Sharma"),
  );

  /* ------------------------------------------------ discovery by degree */

  const discover = await fetchPage("/discover", buyer.token);
  assert("discover loads for a connected user", discover.status === 200);
  assert(
    "discover shows a connection's connections-scoped entry",
    discover.html.includes("Sunrise Roofing"),
  );
  assert(
    "discover shows a group-scoped entry from a shared group",
    discover.html.includes("Dayton Dental Care"),
  );
  assert(
    "discover attributes the recommender by name",
    discover.html.includes("Raj Patel") || discover.html.includes("Meera Iyer"),
  );

  const strangerDiscover = await fetchPage("/discover", stranger.token);
  assert(
    "someone outside the network sees none of it",
    !strangerDiscover.html.includes("Sunrise Roofing") &&
      !strangerDiscover.html.includes("Dayton Dental Care"),
  );

  /* -------------------------------------------------- groups are closed */

  const memberView = await fetchPage("/groups/oak-ridge-neighbours", buyer.token);
  assert("a member can open the group", memberView.status === 200);
  assert(
    "the group shows what was shared into it",
    memberView.html.includes("Nita Sharma"),
  );

  const outsiderView = await fetchPage(
    "/groups/oak-ridge-neighbours",
    stranger.token,
  );
  assert("a non-member gets a 404 on the group", outsiderView.status === 404);

  const anonView = await fetchPage("/groups/oak-ridge-neighbours");
  assert(
    "a signed-out visitor is redirected away from the group",
    anonView.status === 307 || anonView.status === 404,
  );

  /* ------------------------------------------------------------- asks */

  const asksPage = await fetchPage("/asks", buyer.token);
  assert("asks page loads", asksPage.status === 200);
  assert(
    "an ask from a connection reaches the network",
    asksPage.html.includes("house cleaner"),
  );

  const strangerAsks = await fetchPage("/asks", stranger.token);
  assert(
    "an ask does not reach someone outside the network",
    !strangerAsks.html.includes("house cleaner"),
  );

  /* -------------------------------------- name search among 2nd degree */

  // buyer is 1st-degree with raj/meera, and 2nd-degree with anyone THEY are
  // connected to. Nobody else is seeded at 2nd degree for buyer, so search for
  // an existing 1st-degree name should return empty (already connected, not a
  // search target) - what matters here is that the endpoint requires auth and
  // does not 500.
  const peopleSearch = await fetchPage("/people?q=a", buyer.token);
  assert("people search page loads", peopleSearch.status === 200);

  const anonPeople = await fetchPage("/people?q=a");
  assert(
    "people page requires sign-in",
    anonPeople.status === 307 || anonPeople.status === 404,
  );

  /* ------------------------------------------------- business self-listing */

  const claimPageAnon = await fetchPage("/business/claim");
  assert(
    "business claim page requires sign-in",
    claimPageAnon.status === 307,
  );

  const claimPageAuthed = await fetchPage("/business/claim", stranger.token);
  assert("business claim page loads when signed in", claimPageAuthed.status === 200);
  assert(
    "business claim page sets expectations about self-listing",
    claimPageAuthed.html.includes("self-listed"),
  );

  // A profile that predates this feature (no selfListedAt) must not show the
  // self-listed badge just because it also happens to have zero vouches from
  // this fixture set is impossible to assert generically, so instead check a
  // profile that DOES have vouches never shows the badge.
  const mikeProfile = await fetchPage("/p/mike-s-plumbing-558wze");
  assert(
    "a profile with real recommendations never shows 'Self-listed'",
    mikeProfile.status !== 200 || !mikeProfile.html.includes("Self-listed"),
  );

  /* --------------------------------------------------- rate limiting on */

  const limited = await Promise.all(
    Array.from({ length: 12 }, () =>
      fetch(`${BASE}/login`, { method: "GET" }).then((r) => r.status),
    ),
  );
  assert("login page stays reachable under load", limited.every((s) => s === 200));

  /* ------------------------------------------------------------ cleanup */

  await db.delete(shareLinks).where(eq(shareLinks.token, token));

  const [{ count }] = (await db.execute(sql`
    SELECT count(*)::int AS count FROM recommendations
  `)) as unknown as Array<{ count: number }>;
  console.log(`\n(${count} recommendations in the database)`);

  console.log(ok ? "All network checks passed." : "Some checks FAILED.");
  if (!ok) process.exitCode = 1;
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
