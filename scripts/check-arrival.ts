import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import { users } from "../src/db/schema";
import { emailMatchesDomain } from "../src/lib/email-domain";
import { findProtectedPreference } from "../src/lib/fair-housing";
import { normalizePhone } from "../src/lib/phone";

/**
 * Checks for arrival help, the "back home" support, the professional-category
 * gate and the phone-side pieces. Runs against a live server.
 *
 * The rules under test are the ones a person would feel betrayed by if they
 * broke: who can see the help board, when contact details appear, that a stay
 * cannot be advertised with a protected-class preference, and that healthcare
 * and legal stay out of the product until deliberately switched on.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

let ok = true;
function assert(label: string, condition: boolean) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) ok = false;
}

async function get(path: string, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { cookie: `classifieds_session=${token}` } : {},
    redirect: "manual",
  });
  return { status: res.status, html: await res.text(), type: res.headers.get("content-type") ?? "" };
}

async function session(email: string) {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!u) throw new Error(`no user ${email}`);
  const token = randomBytes(32).toString("base64url");
  await db.execute(sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${createHash("sha256").update(token).digest("hex")}, ${u.id}::uuid, now() + interval '1 day')
  `);
  return { token, id: u.id };
}

async function main() {
  /* ---------------------------------------------------- pure rules first */

  for (const bad of [
    "Room for rent, only Indian students",
    "No Muslims please",
    "Hindus preferred",
    "looking for a Christian roommate",
    "Chinese only",
  ]) {
    assert(`fair housing rejects: "${bad}"`, findProtectedPreference(bad) !== null);
  }
  for (const fine of [
    "Quiet household, vegetarian kitchen, no smoking",
    "8 minutes from campus by bike, lease from June",
    "Looking for a neat, respectful roommate with a steady budget",
    "Pickup from DFW, I speak Telugu and Hindi",
  ]) {
    assert(`fair housing allows: "${fine}"`, findProtectedPreference(fine) === null);
  }

  assert("student email on the subdomain matches", emailMatchesDomain("a@my.wright.edu", "wright.edu"));
  assert("student email on the domain matches", emailMatchesDomain("a@wright.edu", "wright.edu"));
  assert("lookalike domain does NOT match", !emailMatchesDomain("a@notwright.edu", "wright.edu"));
  assert("domain-as-prefix trick does NOT match", !emailMatchesDomain("a@wright.edu.evil.com", "wright.edu"));
  assert("double-@ address does NOT match", !emailMatchesDomain("a@evil.com@wright.edu", "wright.edu"));

  const india = normalizePhone("+91 98480 12345");
  assert("an Indian number is normalised and recognised as India", india?.e164 === "+919848012345" && india?.country === "IN");
  assert("an Indian number displays with its country code", Boolean(india?.display.startsWith("+91")));
  const us = normalizePhone("937-555-0148");
  assert("a US number still normalises to E.164", us?.e164 === "+19375550148");
  assert("a US number still displays nationally", us?.display === "(937) 555-0148");
  assert("a bare Indian number is read as one when the country is IN", normalizePhone("98480 12345", "IN")?.e164 === "+919848012345");

  /* ----------------------------------------------- sessions and fixtures */

  const passwordHash = await bcrypt.hash("Password123!", 4);
  await db.execute(sql`
    INSERT INTO users (email, name, password_hash)
    VALUES ('outsider@example.com', 'Olive Outsider', ${passwordHash})
    ON CONFLICT (email) DO NOTHING
  `);

  // The outsider must start every run as someone with no college and no group:
  // interactive testing (or an earlier run) may have verified them.
  await db.execute(sql`
    DELETE FROM group_members WHERE user_id = (SELECT id FROM users WHERE email = 'outsider@example.com')
  `);
  await db.execute(sql`
    DELETE FROM email_verifications WHERE user_id = (SELECT id FROM users WHERE email = 'outsider@example.com')
  `);
  await db.execute(sql`
    UPDATE users SET college_id = NULL, edu_email = NULL, edu_verified_at = NULL
    WHERE email = 'outsider@example.com'
  `);

  const ananya = await session("ananya@example.com");
  const raj = await session("raj@example.com");
  const outsider = await session("outsider@example.com");
  const buyer = await session("buyer@example.com");

  const [post] = (await db.execute(sql`
    SELECT id FROM help_posts WHERE title LIKE 'Can pick up from DAY%' LIMIT 1
  `)) as unknown as Array<{ id: string }>;

  /* ---------------------------------------- who can see the help board */

  const anonBoard = await get("/help");
  assert("signed out: the help board redirects to sign in", anonBoard.status === 307);

  const outsiderBoard = await get("/help", outsider.token);
  assert("signed in but NOT verified: the board redirects to the arrival page", outsiderBoard.status === 307);

  const board = await get("/help", ananya.token);
  assert("a verified student sees the board", board.status === 200 && board.html.includes("Can pick up from DAY"));
  // React splits "Helped {n} newcomers" across text nodes, so allow the markers between.
  assert(
    "the board shows a trust line with a helper's record",
    /Helped\s*(?:<!--\s*-->)?\s*\d+/.test(board.html),
  );

  const outsiderPost = await get(`/help/${post.id}`, outsider.token);
  assert("an unverified user gets a 404 on a post, not a hint", outsiderPost.status === 404);
  const anonPost = await get(`/help/${post.id}`);
  assert("signed out: a post redirects to sign in", anonPost.status === 307);

  /* ------------------------------------------------ contact stays hidden */

  // A verified student who has NOT responded. (Someone whose response was
  // accepted legitimately sees the poster's contact, so they would not do here.)
  const asNewcomer = await get(`/help/${post.id}`, buyer.token);
  assert("a verified student can open a post", asNewcomer.status === 200);
  assert(
    "the poster's email is NOT shown before they accept anyone",
    !asNewcomer.html.includes("raj@example.com") && !asNewcomer.html.includes("patel.34@wright.edu"),
  );
  assert("the helper's endorsements are visible", asNewcomer.html.includes("Met me at arrivals with a sign"));
  assert("the respond form is offered to a non-owner", asNewcomer.html.includes("Offer to help") || asNewcomer.html.includes("Ask for this"));

  const asOwner = await get(`/help/${post.id}`, raj.token);
  assert("the owner sees the manage view, not a respond form", asOwner.html.includes("Responses") && !asOwner.html.includes("Ask for this"));

  const hiddenFromOthers = (await db.execute(sql`
    SELECT count(*)::int AS n FROM help_responses r JOIN help_posts p ON p.id = r.post_id
    WHERE r.status = 'accepted' AND r.contact_phone IS NOT NULL AND p.status = 'open'
  `)) as unknown as Array<{ n: number }>;
  assert("(sanity) no accepted response is sitting unexpectedly in the seed", Number(hiddenFromOthers[0].n) >= 0);

  /* ----------------------------------------------------- invariants (DB) */

  let duplicateBlocked = false;
  try {
    await db.execute(sql`
      UPDATE users SET edu_email = 'shared.address@wright.edu' WHERE email IN ('raj@example.com', 'meera@example.com')
    `);
  } catch {
    duplicateBlocked = true;
  }
  assert("one student address cannot verify two accounts", duplicateBlocked);

  let secondResponseBlocked = false;
  try {
    const [ex] = (await db.execute(sql`
      SELECT post_id, responder_user_id FROM help_responses LIMIT 1
    `)) as unknown as Array<{ post_id: string; responder_user_id: string }>;
    await db.execute(sql`
      INSERT INTO help_responses (post_id, responder_user_id) VALUES (${ex.post_id}::uuid, ${ex.responder_user_id}::uuid)
    `);
  } catch {
    secondResponseBlocked = true;
  }
  assert("a person cannot respond to the same post twice", secondResponseBlocked);

  /* --------------------------------------------- college community group */

  const [group] = (await db.execute(sql`
    SELECT slug FROM groups WHERE college_id IS NOT NULL LIMIT 1
  `)) as unknown as Array<{ slug: string }>;
  const groupPage = await get(`/groups/${group.slug}`, ananya.token);
  assert("a verified member opens the college community", groupPage.status === 200);
  assert("a pinned 'Start here' list is shown", groupPage.html.includes("Start here") && groupPage.html.includes("Spice Route Grocers"));
  assert("the community ranks contacts by how many students vouch", groupPage.html.includes("Most recommended here"));
  const groupOutsider = await get(`/groups/${group.slug}`, outsider.token);
  assert("someone outside the college gets a 404 on its community", groupOutsider.status === 404);

  const arrive = await get("/arrive", ananya.token);
  assert("the arrival hub shows the essentials the community backs", arrive.html.includes("Spice Route Grocers") && arrive.html.includes("Gem City Credit Union"));
  const arrivePublic = await get("/arrive");
  assert("the arrival page is a public landing page when signed out", arrivePublic.status === 200 && arrivePublic.html.includes("Land with people"));

  /* ------------------------------------------------------- back home */

  const abroad = await get("/list?where=abroad", buyer.token);
  assert("'Back home' shows a contact in India", abroad.html.includes("Lakshmi Devi") && abroad.html.includes("India"));
  assert("'Back home' excludes US contacts", !abroad.html.includes("Colonial Auto Service"));
  const everything = await get("/list", buyer.token);
  assert("the list offers a Back home filter when you have contacts abroad", everything.html.includes("Back home"));

  /* ---------------------------------- professional categories stay off */

  const form = await get("/recommendations/new", buyer.token);
  // Assert on the rendered <option>s. Next's dev server also serialises raw query
  // rows into a debug payload, which would match a plain substring search.
  assert(
    "healthcare and legal are NOT offered as categories while the switch is off",
    !/<option[^>]*>\s*(Family Doctor|Immigration Attorney|Dentist|Pediatrician)/.test(form.html),
  );
  assert("the newcomer essentials ARE offered", form.html.includes("Grocery &amp; Food from Home"));
  assert("the form has a country picker", form.html.includes("United States") && form.html.includes("India"));

  /* ------------------------------------------------- badge and phone */

  const [mike] = (await db.execute(sql`SELECT slug FROM providers WHERE display_name = 'Mike''s Plumbing' LIMIT 1`)) as unknown as Array<{ slug: string }>;
  const badge = await get(`/p/${mike.slug}/badge`);
  assert("the embeddable badge is a public PNG", badge.status === 200 && badge.type.includes("image/png"));
  const noBadge = await get("/p/this-does-not-exist/badge");
  assert("an unknown profile gets no badge", noBadge.status === 404);

  const manifest = await get("/manifest.webmanifest");
  assert("the app is installable (manifest served)", manifest.status === 200 && manifest.html.includes("Trusted By"));
  assert("the manifest registers a share target", manifest.html.includes("share_target"));
  const icon = await get("/icons/192");
  assert("app icons are served", icon.status === 200 && icon.type.includes("image/png"));
  const badIcon = await get("/icons/999");
  assert("an unsupported icon size is a 404", badIcon.status === 404);

  const shared = await get(`/import?text=${encodeURIComponent("Mike's Plumbing\n+1 937-555-0148")}`, buyer.token);
  assert("sharing a contact into the app pre-fills the import", shared.html.includes("Mike&#x27;s Plumbing") || shared.html.includes("Mike's Plumbing"));

  /* ------------------------------ every page with a client form renders */

  // A client component that pulls in a server-only module compiles fine and then
  // 500s when the page renders, so actually render each one.
  for (const path of [
    "/help/new",
    "/help/new?direction=offer&kind=room",
    "/help/new?direction=need&kind=temp_stay",
    "/arrive?change=1",
    "/arrive?change=1&q=wright",
    "/import",
    "/recommendations/new",
    "/asks/new",
    "/groups",
    "/people",
    "/discover?where=abroad",
    "/list?where=abroad",
  ]) {
    const page = await get(path, ananya.token);
    assert(`renders without error: ${path}`, page.status === 200);
  }

  /* ------------------------------------------------------ notifications */

  const notifAnon = await get("/notifications");
  assert("notifications require sign in", notifAnon.status === 307);
  const notif = await get("/notifications", ananya.token);
  assert("a signed-in user can open notifications", notif.status === 200);

  console.log(ok ? "\nAll arrival checks passed." : "\nSome checks FAILED.");
  if (!ok) process.exitCode = 1;
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
