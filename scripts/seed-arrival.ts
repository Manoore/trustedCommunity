import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import {
  categories,
  colleges,
  groupMembers,
  groupPins,
  groups,
  helpPosts,
  helpResponses,
  providers,
  recommendationGroups,
  recommendations,
  users,
} from "../src/db/schema";
import { normalizePhone } from "../src/lib/phone";
import { uniqueSlug } from "../src/lib/slug";

/**
 * Demo data for arrival help, set at Wright State University in Dayton so it
 * lines up with the other demo users. Five students, all verified; a couple of
 * helpers with a real track record (completed responses with endorsements); live
 * offers and needs; and the essentials the college community recommends.
 *
 * Verification is set directly here - in the product it takes an emailed code.
 */
const DOMAIN = "wright.edu";

const STUDENTS = [
  { email: "buyer@example.com", name: "Dana Buyer", edu: "dana.buyer@wright.edu" },
  { email: "raj@example.com", name: "Raj Patel", edu: "patel.34@wright.edu" },
  { email: "meera@example.com", name: "Meera Iyer", edu: "iyer.12@wright.edu" },
  { email: "ananya@example.com", name: "Ananya Reddy", edu: "reddy.88@wright.edu" },
  { email: "vikram@example.com", name: "Vikram Shah", edu: "shah.45@wright.edu" },
];

const ESSENTIAL_CONTACTS = [
  { name: "Spice Route Grocers", phone: "937-555-0401", category: "ethnic-grocery", by: ["raj@example.com", "meera@example.com", "vikram@example.com"], note: "Everything from home, and the owner remembers what you buy." },
  { name: "Dayton Desi Mart", phone: "937-555-0402", category: "ethnic-grocery", by: ["meera@example.com"], note: "Cheaper on lentils and rice, bigger packs." },
  { name: "FairMobile Wireless", phone: "937-555-0403", category: "mobile-plans", by: ["raj@example.com", "vikram@example.com"], note: "Student plan, no credit check for an international ID." },
  { name: "Gem City Credit Union", phone: "937-555-0404", category: "banking-remittance", by: ["raj@example.com", "meera@example.com"], note: "Opens an account with a passport and I-20, no SSN needed at first." },
  { name: "Safe Roads Driving School", phone: "937-555-0405", category: "driving-school", by: ["vikram@example.com"], note: "Patient instructor, and they book the test slot for you." },
];

function daysFromNow(n: number) {
  const d = new Date(Date.now() + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const [college] = await db.select().from(colleges).where(eq(colleges.domain, DOMAIN)).limit(1);
  if (!college) {
    console.error("Run `npx tsx scripts/seed-colleges.ts` first.");
    process.exit(1);
  }

  /* ---------------------------------------------------- students, verified */
  const ids = new Map<string, string>();
  for (const s of STUDENTS) {
    let [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, s.email)).limit(1);
    if (!u) {
      [u] = await db
        .insert(users)
        .values({ email: s.email, name: s.name, passwordHash })
        .returning({ id: users.id });
    }
    await db
      .update(users)
      .set({ collegeId: college.id, eduEmail: s.edu, eduVerifiedAt: new Date() })
      .where(eq(users.id, u.id));
    ids.set(s.email, u.id);
  }

  // Same shape the app creates the first time a student at a college verifies.
  let [group] = await db
    .select({ id: groups.id, slug: groups.slug })
    .from(groups)
    .where(eq(groups.collegeId, college.id))
    .limit(1);
  if (!group) {
    [group] = await db
      .insert(groups)
      .values({
        slug: uniqueSlug(`${college.name} community`),
        name: `${college.name} community`,
        kind: "school",
        description: `Students and recent graduates of ${college.name}. Verified with a college email address.`,
        city: college.city,
        state: college.state,
        joinPolicy: "link",
        inviteToken: randomBytes(9).toString("base64url"),
        createdByUserId: ids.get("raj@example.com")!,
        collegeId: college.id,
        welcomeMessage:
          "Welcome. Add the people who helped you settle in so the next newcomer does not start from zero.",
      })
      .returning({ id: groups.id, slug: groups.slug });
  }
  for (const [email, id] of ids) {
    await db
      .insert(groupMembers)
      .values({ groupId: group.id, userId: id, role: email === "raj@example.com" ? "owner" : "member" })
      .onConflictDoNothing();
  }

  /* --------------------------------------- essentials the community backs */
  for (const c of ESSENTIAL_CONTACTS) {
    const phone = normalizePhone(c.phone);
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, c.category))
      .limit(1);
    if (!phone || !category) continue;

    let [provider] = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.normalizedPhone, phone.e164))
      .limit(1);
    if (!provider) {
      [provider] = await db
        .insert(providers)
        .values({
          type: "entity",
          kind: "business",
          slug: uniqueSlug(c.name),
          displayName: c.name,
          contactPhone: phone.display,
          normalizedPhone: phone.e164,
          country: "US",
          city: "Fairborn",
          state: "OH",
          status: "active",
          createdByUserId: ids.get(c.by[0])!,
        })
        .returning({ id: providers.id });
    }

    for (const email of c.by) {
      const [rec] = await db
        .insert(recommendations)
        .values({
          recommenderUserId: ids.get(email)!,
          providerId: provider.id,
          categoryId: category.id,
          relationship: "used_personally",
          strength: "highly_recommend",
          note: c.note,
          visibility: "groups",
        })
        .onConflictDoUpdate({
          target: [recommendations.recommenderUserId, recommendations.providerId],
          set: { visibility: "groups", note: c.note },
        })
        .returning({ id: recommendations.id });

      await db
        .insert(recommendationGroups)
        .values({ recommendationId: rec.id, groupId: group.id })
        .onConflictDoNothing();
    }

    // Pin the first grocery as the owner's "start here".
    if (c.category === "ethnic-grocery" && c.name.startsWith("Spice")) {
      await db
        .insert(groupPins)
        .values({ groupId: group.id, providerId: provider.id, note: "Where nearly everyone shops first.", pinnedByUserId: ids.get("raj@example.com")! })
        .onConflictDoNothing();
    }
  }

  /* ------------------------------------------------- help posts, and history */
  const existing = await db.select({ id: helpPosts.id }).from(helpPosts).where(eq(helpPosts.collegeId, college.id)).limit(1);
  if (!existing.length) {
    const raj = ids.get("raj@example.com")!;
    const meera = ids.get("meera@example.com")!;
    const ananya = ids.get("ananya@example.com")!;
    const vikram = ids.get("vikram@example.com")!;
    const dana = ids.get("buyer@example.com")!;

    // Past, closed help with endorsements: this is what gives a helper a record.
    async function pastHelp(helperId: string, newcomerId: string, title: string, kind: "pickup" | "temp_stay", quote: string) {
      const [post] = await db
        .insert(helpPosts)
        .values({ userId: helperId, collegeId: college.id, direction: "offer", kind, title, area: "DAY (Dayton)", capacity: 1, status: "closed", closedAt: new Date() })
        .returning({ id: helpPosts.id });
      await db.insert(helpResponses).values({
        postId: post.id,
        responderUserId: newcomerId,
        message: "Thank you for offering — I land late in the evening.",
        status: "completed",
        endorsement: quote,
        respondedAt: new Date(),
        completedAt: new Date(),
      });
    }
    await pastHelp(raj, ananya, "Picked up newcomers last August", "pickup", "Met me at arrivals with a sign and a SIM card. I did not have to figure out a single thing.");
    await pastHelp(raj, dana, "Picked up newcomers last January", "pickup", "Drove me through a snowstorm and still waited while I sorted my bags.");
    await pastHelp(meera, vikram, "Hosted a newcomer for a week", "temp_stay", "Gave me the spare room until my lease started. Zero awkwardness.");

    // Live board.
    await db.insert(helpPosts).values([
      { userId: raj, collegeId: college.id, direction: "offer", kind: "pickup", title: "Can pick up from DAY or CMH, January arrivals", details: "I have a car and do this every semester. Tell me your flight and I will be at arrivals. Happy to drop you at campus housing or an apartment.", area: "DAY / CMH", startsOn: daysFromNow(40), endsOn: daysFromNow(46), capacity: 2 },
      { userId: vikram, collegeId: college.id, direction: "offer", kind: "room", title: "Room opening up near campus — I graduate in May", details: "Private room in a shared 3-bedroom, 8 minutes from Wright State by bike. Quiet household, lease takeover from June. Happy to do a video walk-through first.", area: "Fairborn, near campus", startsOn: daysFromNow(150), capacity: 1 },
      { userId: meera, collegeId: college.id, direction: "offer", kind: "temp_stay", title: "Spare bed for a newcomer's first week", details: "A clean spare room for up to 7 nights while you find your feet. Meals are shared. Video call first so you know who I am.", area: "Beavercreek", startsOn: daysFromNow(38), endsOn: daysFromNow(52), capacity: 1 },
      { userId: ananya, collegeId: college.id, direction: "need", kind: "pickup", title: "Landing at CMH on Jan 12, need a pickup", details: "Arriving on a late flight with two suitcases. Can meet you anywhere in arrivals. Happy to chip in for fuel.", area: "CMH (Columbus)", startsOn: daysFromNow(58), capacity: 1 },
      { userId: dana, collegeId: college.id, direction: "offer", kind: "item", title: "Desk, chair and kitchen basics — free to a newcomer", details: "Moving out. Everything works. Pickup from Dayton, I can drop it off if close.", area: "Dayton", capacity: 1 },
    ]);
  }

  // A seeded back-home contact so the "Back home" filter has something to show.
  const indiaPhone = normalizePhone("+91 98480 12345");
  const [care] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "parents-care-coordination")).limit(1);
  if (indiaPhone && care) {
    const [already] = await db.select({ id: providers.id }).from(providers).where(eq(providers.normalizedPhone, indiaPhone.e164)).limit(1);
    let providerId = already?.id;
    if (!providerId) {
      const [row] = await db
        .insert(providers)
        .values({ type: "individual", kind: "individual", slug: uniqueSlug("Lakshmi Devi"), displayName: "Lakshmi Devi", contactPhone: indiaPhone.display, normalizedPhone: indiaPhone.e164, country: "IN", city: "Hyderabad", status: "active", createdByUserId: ids.get("buyer@example.com")! })
        .returning({ id: providers.id });
      providerId = row.id;
    }
    await db
      .insert(recommendations)
      .values({ recommenderUserId: ids.get("buyer@example.com")!, providerId, categoryId: care.id, relationship: "used_personally", strength: "go_to", note: "Looks in on my parents twice a week and calls me the same day if anything is off.", visibility: "private" })
      .onConflictDoNothing();
  }

  console.log(`Seeded arrival demo at ${college.name}.`);
  console.log("Sign in as raj@, meera@, ananya@, vikram@ or buyer@example.com / Password123!");
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
