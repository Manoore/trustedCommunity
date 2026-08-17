import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import {
  askTargets,
  asks,
  categories,
  connections,
  groupMembers,
  groups,
  providers,
  recommendationGroups,
  recommendations,
  users,
} from "../src/db/schema";
import { normalizePhone } from "../src/lib/phone";
import { uniqueSlug } from "../src/lib/slug";

/**
 * Demo data for the network layer: a couple of neighbours connected to the
 * demo buyer, a group they all belong to, recommendations scoped to each
 * audience, and one open ask. Enough to see Discover actually rank things.
 */
type SeedContact = {
  name: string;
  phone: string;
  category: string;
  kind?: "individual" | "business";
  strength: "go_to" | "highly_recommend" | "recommend";
  note: string;
  visibility: "connections" | "groups";
};

const NEIGHBOURS: { email: string; name: string; contacts: SeedContact[] }[] = [
  {
    email: "raj@example.com",
    name: "Raj Patel",
    contacts: [
      {
        name: "Sunrise Roofing",
        phone: "937-555-0301",
        category: "roofing",
        strength: "go_to",
        note: "Redid our roof after the hail. Worked with the insurance adjuster directly.",
        visibility: "connections",
      },
      {
        name: "Nita Sharma",
        phone: "937-555-0302",
        category: "childcare-nanny",
        kind: "individual",
        strength: "highly_recommend",
        note: "Watched our two for a year. Reliable and the kids adored her.",
        visibility: "groups",
      },
    ],
  },
  {
    email: "meera@example.com",
    name: "Meera Iyer",
    contacts: [
      {
        name: "Dayton Dental Care",
        phone: "937-555-0311",
        category: "professional-offices",
        strength: "recommend",
        note: "Front desk actually answers the phone, which is rarer than it should be.",
        visibility: "groups",
      },
      {
        name: "Bright Path Tutoring",
        phone: "937-555-0312",
        category: "test-prep",
        strength: "go_to",
        note: "Took my son from a 1180 to a 1390 on the SAT.",
        visibility: "connections",
      },
    ],
  },
];

async function upsertUser(email: string, name: string, passwordHash: string) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) return existing.id;

  const [row] = await db
    .insert(users)
    .values({ email, name, passwordHash })
    .returning({ id: users.id });
  return row.id;
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const [buyer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "buyer@example.com"))
    .limit(1);

  if (!buyer) {
    console.error("Run npm run db:seed first.");
    process.exit(1);
  }

  /* ------------------------------------------------------------- a group */

  let [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.slug, "oak-ridge-neighbours"))
    .limit(1);

  if (!group) {
    const [created] = await db
      .insert(groups)
      .values({
        slug: "oak-ridge-neighbours",
        name: "Oak Ridge neighbours",
        kind: "neighborhood",
        description:
          "Everyone on and around Oak Ridge Drive. Share the trades you actually trust.",
        city: "Dayton",
        state: "OH",
        joinPolicy: "link",
        inviteToken: randomBytes(9).toString("base64url"),
        createdByUserId: buyer.id,
      })
      .returning({ id: groups.id });
    group = created;
  }

  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId: buyer.id, role: "owner" })
    .onConflictDoNothing();

  /* -------------------------------------------- neighbours and their lists */

  let contactCount = 0;

  for (const neighbour of NEIGHBOURS) {
    const userId = await upsertUser(neighbour.email, neighbour.name, passwordHash);

    await db
      .insert(connections)
      .values({
        requesterId: userId,
        addresseeId: buyer.id,
        status: "accepted",
        respondedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .insert(groupMembers)
      .values({ groupId: group.id, userId, role: "member" })
      .onConflictDoNothing();

    for (const contact of neighbour.contacts) {
      const phone = normalizePhone(contact.phone);
      if (!phone) continue;

      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, contact.category))
        .limit(1);
      if (!category) continue;

      const [existing] = await db
        .select({ id: providers.id })
        .from(providers)
        .where(eq(providers.normalizedPhone, phone.e164))
        .limit(1);

      let providerId = existing?.id;
      if (!providerId) {
        const [row] = await db
          .insert(providers)
          .values({
            type: contact.kind === "individual" ? "individual" : "entity",
            kind: contact.kind ?? "business",
            slug: uniqueSlug(contact.name),
            displayName: contact.name,
            contactPhone: phone.display,
            normalizedPhone: phone.e164,
            city: "Dayton",
            state: "OH",
            zip: "45409",
            status: "active",
            createdByUserId: userId,
          })
          .returning({ id: providers.id });
        providerId = row.id;
      }

      const [rec] = await db
        .insert(recommendations)
        .values({
          recommenderUserId: userId,
          providerId,
          categoryId: category.id,
          relationship: "used_personally",
          strength: contact.strength,
          note: contact.note,
          visibility: contact.visibility,
        })
        .onConflictDoUpdate({
          target: [recommendations.recommenderUserId, recommendations.providerId],
          set: { visibility: contact.visibility, note: contact.note },
        })
        .returning({ id: recommendations.id });

      if (contact.visibility === "groups") {
        await db
          .insert(recommendationGroups)
          .values({ recommendationId: rec.id, groupId: group.id })
          .onConflictDoNothing();
      }

      contactCount++;
    }
  }

  /* --------------------------------------------------------------- an ask */

  const [rajUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "raj@example.com"))
    .limit(1);

  const [existingAsk] = await db
    .select({ id: asks.id })
    .from(asks)
    .where(and(eq(asks.userId, rajUser.id), eq(asks.status, "open")))
    .limit(1);

  if (!existingAsk) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, "house-cleaning"))
      .limit(1);

    const [ask] = await db
      .insert(asks)
      .values({
        userId: rajUser.id,
        categoryId: category?.id ?? null,
        title: "Anyone have a house cleaner they actually trust?",
        body: "Every two weeks, three bedrooms. Would rather have a name than a search result.",
        zip: "45409",
        city: "Dayton",
        state: "OH",
      })
      .returning({ id: asks.id });

    await db.insert(askTargets).values([
      { askId: ask.id, audience: "connections", groupId: null },
      { askId: ask.id, audience: "group", groupId: group.id },
    ]);
  }

  const [row] = await db
    .select({ inviteToken: groups.inviteToken })
    .from(groups)
    .where(eq(groups.id, group.id))
    .limit(1);

  console.log(`Seeded ${NEIGHBOURS.length} connected neighbours, ${contactCount} contacts.`);
  console.log("Group invite link: /join/" + row.inviteToken);
  console.log("Sign in as raj@example.com or meera@example.com / Password123!");
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
