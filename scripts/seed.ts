import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db, sql as conn } from "./_client";
import {
  categories,
  inquiries,
  inquiryMessages,
  listings,
  providerMembers,
  providers,
  reviews,
  users,
} from "../src/db/schema";
import {
  CATEGORY_TREE,
  flattenCategories,
  type CategorySeed,
} from "../src/lib/categories";
import { lookupZip } from "../src/lib/geo";
import { slugify, uniqueSlug } from "../src/lib/slug";

/* ------------------------------------------------------------ deterministic rng */

let rngState = 1337;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/* ----------------------------------------------------------------- categories */

/**
 * The taxonomy is two levels (group -> category), so it is upserted in two bulk
 * statements rather than one query per node. Same result, a handful of round
 * trips instead of hundreds - which is the difference between seconds and
 * minutes against a remote database.
 */
async function seedCategories() {
  const toRow = (node: CategorySeed, parentId: string | null, sortOrder: number) => ({
    parentId,
    slug: node.slug,
    name: node.name,
    description: node.description ?? null,
    licenseRequired: node.licenseRequired ?? false,
    restricted: node.restricted ?? false,
    professional: node.professional ?? false,
    sortOrder,
  });

  const upsert = (rows: ReturnType<typeof toRow>[]) =>
    db
      .insert(categories)
      .values(rows)
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          parentId: sql`excluded.parent_id`,
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          licenseRequired: sql`excluded.license_required`,
          restricted: sql`excluded.restricted`,
          professional: sql`excluded.professional`,
          sortOrder: sql`excluded.sort_order`,
        },
      })
      .returning({ id: categories.id, slug: categories.slug });

  const idBySlug = new Map<string, string>();

  const parents = await upsert(CATEGORY_TREE.map((node, i) => toRow(node, null, i)));
  for (const row of parents) idBySlug.set(row.slug, row.id);

  const childRows = CATEGORY_TREE.flatMap((parent) =>
    (parent.children ?? []).map((child, i) => toRow(child, idBySlug.get(parent.slug)!, i)),
  );
  const children = await upsert(childRows);
  for (const row of children) idBySlug.set(row.slug, row.id);

  console.log(`Categories seeded: ${idBySlug.size}`);
  return idBySlug;
}

/* -------------------------------------------------------------- demo content */

const METROS = [
  "10001", "90012", "60601", "77002", "85004", "19103", "78205", "92101",
  "75201", "78701", "32202", "43215", "28202", "46204", "98101", "80202",
  "02108", "37203", "97204", "33130", "30303", "55401", "48226", "89101",
];

const FIRST = [
  "Marcus", "Elena", "Devon", "Priya", "Jordan", "Alicia", "Terrence", "Mei",
  "Caleb", "Sofia", "Omar", "Hannah", "Luis", "Nadia", "Grant", "Yusuf",
  "Rosa", "Ethan", "Imani", "Bella",
];
const LAST = [
  "Webb", "Ortiz", "Nakamura", "Patel", "Brooks", "Okafor", "Lindqvist",
  "Ferreira", "Hollis", "Bright", "Vance", "Sandoval", "Ahmed", "Whitfield",
  "Moreau", "Castellanos",
];
const ENTITY_SUFFIX = [
  "LLC", "Co.", "Group", "& Sons", "Services", "Partners", "Collective",
];

/** Category slug -> a listing title template and a plausible price band. */
const LISTING_TEMPLATES: Record<
  string,
  { title: string; priceType: "hourly" | "fixed" | "starting_at" | "quote"; min: number; max: number }
> = {
  plumbing: { title: "Emergency & Repair Plumbing", priceType: "hourly", min: 9500, max: 18500 },
  electrical: { title: "Licensed Electrical Work", priceType: "hourly", min: 10500, max: 19500 },
  hvac: { title: "HVAC Install, Repair & Tune-Up", priceType: "starting_at", min: 14900, max: 0 },
  roofing: { title: "Roof Repair & Replacement", priceType: "quote", min: 0, max: 0 },
  handyman: { title: "Handyman & Small Repairs", priceType: "hourly", min: 6500, max: 11000 },
  painting: { title: "Interior & Exterior Painting", priceType: "quote", min: 0, max: 0 },
  "house-cleaning": { title: "Deep Clean & Recurring House Cleaning", priceType: "starting_at", min: 12000, max: 0 },
  landscaping: { title: "Landscape Design & Install", priceType: "quote", min: 0, max: 0 },
  "lawn-care": { title: "Weekly Lawn Maintenance", priceType: "starting_at", min: 4500, max: 0 },
  moving: { title: "Local & Long-Distance Moving", priceType: "hourly", min: 12000, max: 22000 },
  "junk-removal": { title: "Junk Removal & Hauling", priceType: "starting_at", min: 9900, max: 0 },
  "appliance-repair": { title: "Same-Day Appliance Repair", priceType: "fixed", min: 8900, max: 8900 },
  "auto-repair": { title: "Full-Service Auto Repair", priceType: "hourly", min: 11000, max: 16500 },
  "mobile-mechanic": { title: "Mobile Mechanic - We Come To You", priceType: "starting_at", min: 8900, max: 0 },
  "auto-detailing": { title: "Ceramic Coating & Full Detail", priceType: "starting_at", min: 19900, max: 0 },
  "hair-styling": { title: "Cut, Color & Balayage", priceType: "starting_at", min: 8500, max: 0 },
  barbering: { title: "Fades, Beard Work & Hot Towel", priceType: "fixed", min: 4000, max: 4000 },
  "massage-therapy": { title: "Deep Tissue & Sports Massage", priceType: "hourly", min: 9000, max: 14000 },
  "personal-training": { title: "1-on-1 Strength Coaching", priceType: "hourly", min: 7500, max: 12500 },
  photography: { title: "Wedding & Portrait Photography", priceType: "starting_at", min: 120000, max: 0 },
  videography: { title: "Event & Brand Videography", priceType: "starting_at", min: 95000, max: 0 },
  "dj-services": { title: "Wedding & Party DJ", priceType: "starting_at", min: 75000, max: 0 },
  catering: { title: "Full-Service Event Catering", priceType: "quote", min: 0, max: 0 },
  "event-planning": { title: "Wedding & Corporate Event Planning", priceType: "quote", min: 0, max: 0 },
  "graphic-design": { title: "Brand & Marketing Design", priceType: "hourly", min: 7500, max: 15000 },
  "web-development": { title: "Custom Websites & Web Apps", priceType: "hourly", min: 9500, max: 18500 },
  seo: { title: "Technical SEO & Content Strategy", priceType: "starting_at", min: 150000, max: 0 },
  copywriting: { title: "Website & Email Copywriting", priceType: "hourly", min: 8000, max: 15000 },
  "video-editing": { title: "Short-Form & YouTube Editing", priceType: "starting_at", min: 25000, max: 0 },
  "it-support": { title: "Small Business IT Support", priceType: "hourly", min: 9500, max: 16000 },
  bookkeeping: { title: "Monthly Bookkeeping & Cleanup", priceType: "starting_at", min: 45000, max: 0 },
  "business-consulting": { title: "Operations & Growth Consulting", priceType: "hourly", min: 15000, max: 35000 },
  "virtual-assistant": { title: "Executive Virtual Assistant", priceType: "hourly", min: 3500, max: 6500 },
  "academic-tutoring": { title: "Math & Science Tutoring", priceType: "hourly", min: 5000, max: 9000 },
  "music-lessons": { title: "Guitar & Piano Lessons", priceType: "hourly", min: 5500, max: 8500 },
  "test-prep": { title: "SAT & ACT Prep", priceType: "hourly", min: 7500, max: 15000 },
  "dog-walking": { title: "Daily Dog Walking & Drop-Ins", priceType: "fixed", min: 2500, max: 2500 },
  "pet-grooming": { title: "Full-Service Pet Grooming", priceType: "starting_at", min: 6500, max: 0 },
  "dog-training": { title: "Obedience & Behavior Training", priceType: "starting_at", min: 30000, max: 0 },
  "childcare-nanny": { title: "Experienced Full-Time Nanny", priceType: "hourly", min: 2200, max: 3500 },
  "senior-care": { title: "In-Home Senior Companionship", priceType: "hourly", min: 2800, max: 4200 },
  welding: { title: "Mobile Welding & Fabrication", priceType: "hourly", min: 9500, max: 16500 },
  "furniture-assembly": { title: "Furniture Assembly & Mounting", priceType: "hourly", min: 6000, max: 9500 },
  "restaurants-food": { title: "Neighborhood Kitchen & Catering", priceType: "quote", min: 0, max: 0 },
  "fitness-studios": { title: "Boutique Strength & Conditioning Studio", priceType: "starting_at", min: 12900, max: 0 },
};

const REMOTE_SLUGS = new Set([
  "graphic-design", "web-development", "seo", "copywriting", "video-editing",
  "bookkeeping", "business-consulting", "virtual-assistant", "test-prep",
]);

const LICENSED_SLUGS = new Set(["plumbing", "electrical", "hvac", "roofing", "hair-styling", "barbering", "massage-therapy"]);

const STATE_LICENSE_PREFIX = "LIC";

const CATEGORY_NAMES = new Map(
  flattenCategories().map((c) => [c.slug, c.name] as const),
);

/** "Hair Styling & Color" -> "Hair Styling", so entity names read naturally. */
function tradeNoun(categoryName: string) {
  return categoryName.split(" & ")[0].split(" - ")[0].trim();
}

function providerName(type: "individual" | "entity", city: string, catName: string) {
  if (type === "individual") return `${pick(FIRST)} ${pick(LAST)}`;
  const noun = tradeNoun(catName);
  const prefix = pick([city, pick(LAST)]);
  return `${prefix} ${noun} ${pick(ENTITY_SUFFIX)}`;
}

function description(catName: string, city: string, years: number) {
  return [
    `${catName} serving ${city} and the surrounding metro.`,
    `${years} years in the trade. Licensed and insured where required, upfront pricing, and no surprise add-ons at the end of the job.`,
    `Send an inquiry with your ZIP and a short description of what you need and you will get a written estimate back, usually the same day.`,
  ].join("\n\n");
}

async function seedDemoContent(idBySlug: Map<string, string>) {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Admin + a demo buyer, both idempotent by email.
  async function upsertUser(
    email: string,
    name: string,
    role: "user" | "admin",
    phone?: string,
  ) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length) return existing[0].id;
    const [row] = await db
      .insert(users)
      .values({ email, name, role, passwordHash, phone: phone ?? null })
      .returning({ id: users.id });
    return row.id;
  }

  const adminId = await upsertUser("admin@example.com", "Site Admin", "admin");
  const buyerId = await upsertUser("buyer@example.com", "Dana Buyer", "user", "555-0100");

  const existingProviders = await db.select({ id: providers.id }).from(providers).limit(1);
  if (existingProviders.length) {
    console.log("Providers already present - skipping demo content.");
    return { adminId, buyerId };
  }

  const templateSlugs = Object.keys(LISTING_TEMPLATES);
  let listingCount = 0;
  let providerCount = 0;
  const createdListings: { id: string; providerId: string }[] = [];

  for (const zip of METROS) {
    const geo = lookupZip(zip);
    if (!geo) continue;

    for (let n = 0; n < 3; n++) {
      const catSlug = pick(templateSlugs);
      const categoryId = idBySlug.get(catSlug);
      if (!categoryId) continue;

      const tpl = LISTING_TEMPLATES[catSlug];
      const type: "individual" | "entity" = rand() < 0.45 ? "individual" : "entity";
      const years = randInt(2, 24);
      const catName = CATEGORY_NAMES.get(catSlug) ?? tpl.title;
      const display = providerName(type, geo.city, catName);

      const ownerEmail = `${slugify(display)}-${providerCount}@example.com`;
      const ownerId = await upsertUser(ownerEmail, display, "user");

      const [provider] = await db
        .insert(providers)
        .values({
          type,
          slug: uniqueSlug(display),
          displayName: display,
          legalName: type === "entity" ? `${display}` : null,
          headline: `${tpl.title} in ${geo.city}, ${geo.state}`,
          bio: description(tpl.title, geo.city, years),
          contactEmail: ownerEmail,
          contactPhone: `555-01${String(randInt(10, 99))}`,
          city: geo.city,
          state: geo.state,
          zip: geo.zip,
          lat: geo.lat,
          lng: geo.lng,
          yearsExperience: years,
          status: "active",
          verifiedAt: rand() < 0.4 ? new Date() : null,
        })
        .returning({ id: providers.id });

      await db.insert(providerMembers).values({
        providerId: provider.id,
        userId: ownerId,
        role: "owner",
      });

      // Entities get a second seat, which is the whole point of the type split.
      if (type === "entity") {
        const staffId = await upsertUser(
          `staff-${providerCount}@example.com`,
          `${pick(FIRST)} ${pick(LAST)}`,
          "user",
        );
        await db.insert(providerMembers).values({
          providerId: provider.id,
          userId: staffId,
          role: "manager",
        });
      }

      const remote = REMOTE_SLUGS.has(catSlug);
      const [listing] = await db
        .insert(listings)
        .values({
          providerId: provider.id,
          categoryId,
          title: tpl.title,
          slug: uniqueSlug(`${tpl.title} ${geo.city}`),
          description: description(tpl.title, geo.city, years),
          priceType: tpl.priceType,
          priceMinCents: tpl.min || null,
          priceMaxCents: tpl.max || null,
          status: "active",
          remoteOk: remote,
          zip: geo.zip,
          city: geo.city,
          state: geo.state,
          lat: geo.lat,
          lng: geo.lng,
          serviceRadiusMiles: remote ? 3000 : pick([15, 25, 40, 60]),
          licenseNumber: LICENSED_SLUGS.has(catSlug)
            ? `${STATE_LICENSE_PREFIX}-${geo.state}-${randInt(100000, 999999)}`
            : null,
          licenseState: LICENSED_SLUGS.has(catSlug) ? geo.state : null,
          featuredUntil:
            rand() < 0.12
              ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
              : null,
          viewCount: randInt(0, 400),
        })
        .returning({ id: listings.id });

      createdListings.push({ id: listing.id, providerId: provider.id });
      listingCount++;
      providerCount++;
    }
  }

  // A handful of inquiries and the reviews they unlock, so ratings are non-zero.
  let reviewCount = 0;
  for (const item of createdListings) {
    if (rand() > 0.55) continue;
    const [inq] = await db
      .insert(inquiries)
      .values({
        listingId: item.id,
        providerId: item.providerId,
        buyerUserId: buyerId,
        buyerName: "Dana Buyer",
        buyerEmail: "buyer@example.com",
        buyerPhone: "555-0100",
        buyerZip: pick(METROS),
        status: "replied",
        contactUnlockedAt: new Date(),
      })
      .returning({ id: inquiries.id });

    await db.insert(inquiryMessages).values([
      { inquiryId: inq.id, senderUserId: buyerId, body: "Are you available next week?" },
    ]);

    const rating = randInt(3, 5);
    await db.insert(reviews).values({
      inquiryId: inq.id,
      listingId: item.id,
      providerId: item.providerId,
      authorUserId: buyerId,
      rating,
      title: rating >= 5 ? "Great work" : "Solid job",
      body: "Showed up on time, quoted clearly, and the work held up. Would hire again.",
    });
    reviewCount++;

    await db
      .update(providers)
      .set({ ratingAvg: rating, ratingCount: 1 })
      .where(eq(providers.id, item.providerId));
  }

  console.log(
    `Demo content: ${providerCount} providers, ${listingCount} listings, ${reviewCount} reviews.`,
  );
  return { adminId, buyerId };
}

async function main() {
  const idBySlug = await seedCategories();

  // `--categories-only` refreshes the taxonomy without touching demo content,
  // which is what you want after the category list changes.
  if (process.argv.includes("--categories-only")) return;

  await seedDemoContent(idBySlug);
  console.log("\nSign in with:");
  console.log("  admin@example.com / Password123!  (admin)");
  console.log("  buyer@example.com / Password123!  (buyer)");
}

main()
  .then(() => conn.end())
  .catch(async (err) => {
    console.error(err);
    await conn.end();
    process.exit(1);
  });
