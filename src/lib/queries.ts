import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { professionalEnabled } from "@/lib/professional";
import {
  categories,
  listingMedia,
  listings,
  providerMembers,
  providers,
  reviews,
  users,
} from "@/db/schema";

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  licenseRequired: boolean;
  restricted: boolean;
  professional: boolean;
  listingCount: number;
  children: CategoryNode[];
};

/**
 * Whole taxonomy with live listing counts rolled up into the parent groups.
 * Counts drive the "be the first provider here" empty state, so they have to be
 * real rather than cached guesses.
 */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const rows = (await db.execute(sql`
    SELECT
      c.id, c.slug, c.name, c.description, c.license_required, c.restricted, c.professional,
      c.parent_id, c.sort_order,
      (
        SELECT count(*)::int FROM listings l
        JOIN providers p ON p.id = l.provider_id
        WHERE l.category_id = c.id AND l.status = 'active' AND p.status = 'active'
      ) AS listing_count
    FROM categories c
    ORDER BY c.sort_order ASC, c.name ASC
  `)) as unknown as Array<Record<string, unknown>>;

  const byId = new Map<string, CategoryNode & { parentId: string | null }>();
  for (const r of rows) {
    // Healthcare and legal do not exist anywhere in the product until switched on.
    if (Boolean(r.professional) && !professionalEnabled()) continue;

    byId.set(String(r.id), {
      id: String(r.id),
      slug: String(r.slug),
      name: String(r.name),
      description: (r.description as string) ?? null,
      licenseRequired: Boolean(r.license_required),
      restricted: Boolean(r.restricted),
      professional: Boolean(r.professional),
      listingCount: Number(r.listing_count ?? 0),
      children: [],
      parentId: (r.parent_id as string) ?? null,
    });
  }

  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId) byId.get(node.parentId)?.children.push(node);
    else roots.push(node);
  }
  // Roll child counts into their group.
  for (const root of roots) {
    root.listingCount += root.children.reduce((sum, c) => sum + c.listingCount, 0);
  }
  return roots;
}

export async function getCategoryBySlug(slug: string) {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/** Flat list for <select> menus, groups rendered as optgroup labels. */
export async function getCategoryOptions() {
  const tree = await getCategoryTree();
  return tree
    .filter((group) => !group.restricted)
    .map((group) => ({
      label: group.name,
      options: group.children
        .filter((c) => !c.restricted)
        .map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          licenseRequired: c.licenseRequired,
          professional: c.professional,
        })),
    }));
}

/**
 * Provider fields that are safe to load for any viewer.
 *
 * The real phone and email are deliberately absent. Instead Postgres returns
 * only the fragments needed to render the masked form, so a page rendered for
 * someone who has not earned the contact details never holds them in memory,
 * never puts them in a React tree, and cannot leak them through a serialised
 * payload. Call `getProviderContact` once access is established.
 */
export const providerPublicColumns = {
  id: providers.id,
  type: providers.type,
  slug: providers.slug,
  displayName: providers.displayName,
  legalName: providers.legalName,
  headline: providers.headline,
  bio: providers.bio,
  city: providers.city,
  state: providers.state,
  zip: providers.zip,
  yearsExperience: providers.yearsExperience,
  status: providers.status,
  ratingAvg: providers.ratingAvg,
  ratingCount: providers.ratingCount,
  verifiedAt: providers.verifiedAt,
  createdAt: providers.createdAt,
  hasPhone: sql<boolean>`(${providers.contactPhone} IS NOT NULL)`,
  hasEmail: sql<boolean>`(${providers.contactEmail} IS NOT NULL)`,
  hasWebsite: sql<boolean>`(${providers.websiteUrl} IS NOT NULL)`,
  phoneTail: sql<string | null>`right(regexp_replace(${providers.contactPhone}, '\\D', '', 'g'), 4)`,
  emailHead: sql<string | null>`left(${providers.contactEmail}, 1)`,
  emailDomain: sql<string | null>`split_part(${providers.contactEmail}, '@', 2)`,
};

/** Real contact details. Only call this after checking the viewer may see them. */
export async function getProviderContact(providerId: string) {
  const rows = await db
    .select({
      contactPhone: providers.contactPhone,
      contactEmail: providers.contactEmail,
      websiteUrl: providers.websiteUrl,
    })
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getListingBySlug(slug: string) {
  const rows = await db
    .select({
      listing: listings,
      provider: providerPublicColumns,
      category: categories,
    })
    .from(listings)
    .innerJoin(providers, eq(providers.id, listings.providerId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(eq(listings.slug, slug))
    .limit(1);

  if (!rows.length) return null;

  const media = await db
    .select()
    .from(listingMedia)
    .where(eq(listingMedia.listingId, rows[0].listing.id))
    .orderBy(listingMedia.sortOrder);

  return { ...rows[0], media };
}

export async function getListingById(id: string) {
  const rows = await db
    .select({ listing: listings, provider: providers, category: categories })
    .from(listings)
    .innerJoin(providers, eq(providers.id, listings.providerId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(eq(listings.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getProviderBySlug(slug: string) {
  const rows = await db
    .select(providerPublicColumns)
    .from(providers)
    .where(eq(providers.slug, slug))
    .limit(1);
  if (!rows.length) return null;

  const provider = rows[0];

  const providerListings = await db
    .select({ listing: listings, category: categories })
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(and(eq(listings.providerId, provider.id), eq(listings.status, "active")))
    .orderBy(desc(listings.createdAt));

  const providerReviews = await db
    .select({
      review: reviews,
      authorName: users.name,
      listingTitle: listings.title,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorUserId))
    .innerJoin(listings, eq(listings.id, reviews.listingId))
    .where(and(eq(reviews.providerId, provider.id), eq(reviews.status, "published")))
    .orderBy(desc(reviews.createdAt))
    .limit(25);

  const team =
    provider.type === "entity"
      ? await db
          .select({ name: users.name, role: providerMembers.role })
          .from(providerMembers)
          .innerJoin(users, eq(users.id, providerMembers.userId))
          .where(eq(providerMembers.providerId, provider.id))
      : [];

  return { provider, listings: providerListings, reviews: providerReviews, team };
}

/**
 * True once this buyer has an inquiry with the provider that the provider has
 * replied to. That reply is what reveals the provider's real phone and email.
 */
export async function hasUnlockedContact(userId: string, providerId: string) {
  const rows = (await db.execute(sql`
    SELECT 1 FROM inquiries
    WHERE buyer_user_id = ${userId}
      AND provider_id = ${providerId}
      AND contact_unlocked_at IS NOT NULL
    LIMIT 1
  `)) as unknown as unknown[];
  return rows.length > 0;
}

export async function getListingReviews(listingId: string) {
  return db
    .select({ review: reviews, authorName: users.name })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorUserId))
    .where(and(eq(reviews.listingId, listingId), eq(reviews.status, "published")))
    .orderBy(desc(reviews.createdAt))
    .limit(20);
}

/** Groups with the most live listings, for the home page. */
export async function getPopularCategories(limit = 12) {
  const rows = (await db.execute(sql`
    SELECT c.slug, c.name, parent.slug AS parent_slug, parent.name AS parent_name,
           count(l.id)::int AS listing_count
    FROM categories c
    LEFT JOIN categories parent ON parent.id = c.parent_id
    LEFT JOIN listings l
      ON l.category_id = c.id AND l.status = 'active'
    WHERE c.restricted = false AND c.parent_id IS NOT NULL
    GROUP BY c.slug, c.name, parent.slug, parent.name
    ORDER BY listing_count DESC, c.name ASC
    LIMIT ${limit}
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    slug: String(r.slug),
    name: String(r.name),
    parentSlug: (r.parent_slug as string) ?? null,
    parentName: (r.parent_name as string) ?? null,
    listingCount: Number(r.listing_count ?? 0),
  }));
}

export async function getMarketplaceStats() {
  const [row] = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM listings WHERE status = 'active') AS listings,
      (SELECT count(*)::int FROM providers WHERE status = 'active') AS providers,
      (SELECT count(DISTINCT state)::int FROM listings WHERE status = 'active' AND state IS NOT NULL) AS states,
      (SELECT count(*)::int FROM categories WHERE restricted = false AND parent_id IS NOT NULL) AS categories
  `)) as unknown as Array<Record<string, unknown>>;

  return {
    listings: Number(row?.listings ?? 0),
    providers: Number(row?.providers ?? 0),
    states: Number(row?.states ?? 0),
    categories: Number(row?.categories ?? 0),
  };
}
