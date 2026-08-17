import { eq } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import { categories, providers, recommendations, users } from "../src/db/schema";
import { lookupZip } from "../src/lib/geo";
import { normalizePhone } from "../src/lib/phone";
import { uniqueSlug } from "../src/lib/slug";

/**
 * Demo content for the recommendation layer, attached to buyer@example.com.
 * Mirrors what the add form does, including phone-based deduplication.
 */
const SEED = [
  {
    name: "Mike's Plumbing",
    phone: "937-555-0148",
    kind: "business" as const,
    category: "plumbing",
    zip: "45402",
    relationship: "used_personally" as const,
    strength: "go_to" as const,
    note: "Used them twice. Very responsive and reasonable — came out the same day when our water heater went.",
    visibility: "link" as const,
  },
  {
    name: "Dave's Electric",
    phone: "937-555-0210",
    kind: "business" as const,
    category: "electrical",
    zip: "45459",
    relationship: "used_personally" as const,
    strength: "highly_recommend" as const,
    note: "Rewired our kitchen. Clean work, pulled the permit himself, no surprises on the invoice.",
    visibility: "connections" as const,
  },
  {
    name: "Green Lawn Landscaping",
    phone: "937-555-0333",
    kind: "business" as const,
    category: "landscaping",
    zip: "45440",
    relationship: "used_personally" as const,
    strength: "recommend" as const,
    note: "Reliable weekly service, and they actually show up when they say they will.",
    visibility: "link" as const,
  },
  {
    name: "Sarah Johnson",
    phone: "937-555-0477",
    kind: "individual" as const,
    category: "real-estate-agents",
    zip: "45419",
    relationship: "worked_with" as const,
    strength: "go_to" as const,
    note: "Sold our house in nine days and talked us out of overpricing it. Straight with you.",
    visibility: "connections" as const,
  },
  {
    name: "Amar India",
    phone: "937-555-0512",
    kind: "business" as const,
    category: "restaurants-food",
    zip: "45459",
    relationship: "know_personally" as const,
    strength: "highly_recommend" as const,
    note: "Best dosa in the Dayton area. Ask for the family-style thali on weekends.",
    visibility: "link" as const,
  },
  {
    name: "Priya Nair",
    phone: "937-555-0688",
    kind: "individual" as const,
    category: "academic-tutoring",
    zip: "45458",
    relationship: "used_personally" as const,
    strength: "highly_recommend" as const,
    note: "Tutored my daughter through algebra. Patient, and she sends a summary after every session.",
    visibility: "private" as const,
  },
  {
    name: "Colonial Auto Service",
    phone: "937-555-0725",
    kind: "business" as const,
    category: "auto-repair",
    zip: "45409",
    relationship: "used_personally" as const,
    strength: "go_to" as const,
    note: "Told me a repair was not worth doing on an old car. Have not gone anywhere else since.",
    visibility: "link" as const,
  },
  {
    name: "Bright Start Cleaning",
    phone: "937-555-0891",
    kind: "business" as const,
    category: "house-cleaning",
    zip: "45429",
    relationship: "used_personally" as const,
    strength: "recommend" as const,
    note: "Same two people every visit, which matters more than I expected.",
    visibility: "connections" as const,
  },
];

async function main() {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "buyer@example.com"))
    .limit(1);

  if (!owner) {
    console.error("buyer@example.com not found. Run npm run db:seed first.");
    process.exit(1);
  }

  let created = 0;
  for (const entry of SEED) {
    const phone = normalizePhone(entry.phone);
    if (!phone) {
      console.warn(`Skipping ${entry.name}: unparseable phone`);
      continue;
    }

    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, entry.category))
      .limit(1);
    if (!category) {
      console.warn(`Skipping ${entry.name}: category ${entry.category} missing`);
      continue;
    }

    const geo = lookupZip(entry.zip);

    const existing = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.normalizedPhone, phone.e164))
      .limit(1);

    let providerId = existing[0]?.id;
    if (!providerId) {
      const [row] = await db
        .insert(providers)
        .values({
          type: entry.kind === "business" ? "entity" : "individual",
          kind: entry.kind,
          slug: uniqueSlug(entry.name),
          displayName: entry.name,
          contactPhone: phone.display,
          normalizedPhone: phone.e164,
          city: geo?.city ?? null,
          state: geo?.state ?? null,
          zip: geo?.zip ?? null,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          status: "active",
          createdByUserId: owner.id,
        })
        .returning({ id: providers.id });
      providerId = row.id;
    }

    await db
      .insert(recommendations)
      .values({
        recommenderUserId: owner.id,
        providerId,
        categoryId: category.id,
        relationship: entry.relationship,
        strength: entry.strength,
        note: entry.note,
        visibility: entry.visibility,
      })
      .onConflictDoNothing();

    created++;
  }

  console.log(`Seeded ${created} recommendations for buyer@example.com.`);
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
