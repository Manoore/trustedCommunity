import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  categories,
  providers,
  recommendations,
  shareLinks,
  users,
} from "@/db/schema";
import { profileVouchCondition, viewerScope } from "@/lib/social";

/** The category's parent group, e.g. "Home & Property Services". */
const parentCategory = alias(categories, "parent_category");

export type MyRecommendation = {
  id: string;
  relationship: string;
  strength: "recommend" | "highly_recommend" | "go_to";
  note: string | null;
  visibility: "private" | "connections" | "groups" | "link";
  createdAt: Date;
  providerId: string;
  providerSlug: string;
  name: string;
  kind: "business" | "individual";
  phone: string | null;
  city: string | null;
  state: string | null;
  websiteUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  groupName: string | null;
  groupSlug: string | null;
  /** How many other people have vouched for this contact. */
  otherRecommenders: number;
};

const baseSelect = {
  id: recommendations.id,
  relationship: recommendations.relationship,
  strength: recommendations.strength,
  note: recommendations.note,
  visibility: recommendations.visibility,
  createdAt: recommendations.createdAt,
  providerId: providers.id,
  providerSlug: providers.slug,
  name: providers.displayName,
  kind: providers.kind,
  phone: providers.contactPhone,
  city: providers.city,
  state: providers.state,
  websiteUrl: providers.websiteUrl,
  categoryId: categories.id,
  categoryName: categories.name,
  categorySlug: categories.slug,
  groupName: parentCategory.name,
  groupSlug: parentCategory.slug,
  otherRecommenders: sql<number>`(
    SELECT count(*)::int FROM recommendations r2
    WHERE r2.provider_id = ${providers.id}
      AND r2.visibility <> 'private'
      AND r2.recommender_user_id <> ${recommendations.recommenderUserId}
  )`,
};

/**
 * Everything the caller has recommended, newest first.
 *
 * Category and search filtering happen in SQL rather than in JS after the fact,
 * so this stays sane when a list runs to thousands of contacts.
 */
export async function getMyRecommendations(
  userId: string,
  categorySlug?: string,
  query?: string,
): Promise<MyRecommendation[]> {
  const conditions = [
    eq(recommendations.recommenderUserId, userId),
    isNull(providers.hiddenAt),
  ];

  if (categorySlug) {
    conditions.push(
      sql`(${categories.slug} = ${categorySlug} OR ${parentCategory.slug} = ${categorySlug})`,
    );
  }

  if (query?.trim()) {
    const like = `%${query.trim()}%`;
    conditions.push(
      sql`(
        ${providers.displayName} ILIKE ${like}
        OR ${recommendations.note} ILIKE ${like}
        OR ${categories.name} ILIKE ${like}
        OR ${providers.city} ILIKE ${like}
      )`,
    );
  }

  const rows = await db
    .select(baseSelect)
    .from(recommendations)
    .innerJoin(providers, eq(providers.id, recommendations.providerId))
    .leftJoin(categories, eq(categories.id, recommendations.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(and(...conditions))
    .orderBy(desc(recommendations.createdAt));

  return rows as MyRecommendation[];
}

export async function getRecommendationForEdit(id: string, userId: string) {
  const rows = await db
    .select({
      recommendation: recommendations,
      provider: providers,
    })
    .from(recommendations)
    .innerJoin(providers, eq(providers.id, recommendations.providerId))
    .where(
      and(eq(recommendations.id, id), eq(recommendations.recommenderUserId, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Contact fields safe for any viewer.
 *
 * The real phone number is absent by construction — only the last four digits
 * come back, which is enough for the masked form. The page fetches the real
 * value separately once it has established the viewer is allowed to see it, so
 * a page rendered for a stranger never holds it at all.
 */
const contactPublicColumns = {
  id: providers.id,
  slug: providers.slug,
  displayName: providers.displayName,
  kind: providers.kind,
  createdByUserId: providers.createdByUserId,
  websiteUrl: providers.websiteUrl,
  headline: providers.headline,
  bio: providers.bio,
  city: providers.city,
  state: providers.state,
  claimedAt: providers.claimedAt,
  selfListedAt: providers.selfListedAt,
  hasPhone: sql<boolean>`(${providers.contactPhone} IS NOT NULL)`,
  phoneTail: sql<string | null>`right(${providers.normalizedPhone}, 4)`,
};

/** A contact profile plus everyone who has vouched for them. */
export async function getContactProfile(slug: string, viewerId: string | null = null) {
  const rows = await db
    .select(contactPublicColumns)
    .from(providers)
    .where(and(eq(providers.slug, slug), isNull(providers.hiddenAt)))
    .limit(1);

  if (!rows.length) return null;
  const provider = rows[0];

  // Only the vouches this viewer is entitled to see. The count shown on the
  // page is derived from this same list, so it never reveals that a hidden
  // vouch exists.
  const { connectionIds, groupIds } = await viewerScope(viewerId);

  const vouches = await db
    .select({
      id: recommendations.id,
      relationship: recommendations.relationship,
      strength: recommendations.strength,
      note: recommendations.note,
      visibility: recommendations.visibility,
      createdAt: recommendations.createdAt,
      recommenderId: users.id,
      recommenderName: users.name,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(recommendations)
    .innerJoin(users, eq(users.id, recommendations.recommenderUserId))
    .leftJoin(categories, eq(categories.id, recommendations.categoryId))
    .where(
      and(
        eq(recommendations.providerId, provider.id),
        profileVouchCondition(viewerId, connectionIds, groupIds),
      ),
    )
    .orderBy(desc(recommendations.createdAt));

  return { provider, vouches };
}

/** Category counts for the caller's own list, used for the filter chips. */
export async function getMyCategoryCounts(userId: string) {
  const rows = (await db.execute(sql`
    SELECT
      COALESCE(parent.slug, c.slug) AS slug,
      COALESCE(parent.name, c.name) AS name,
      count(*)::int AS total
    FROM recommendations r
    JOIN providers p ON p.id = r.provider_id AND p.hidden_at IS NULL
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN categories parent ON parent.id = c.parent_id
    WHERE r.recommender_user_id = ${userId}
    GROUP BY 1, 2
    ORDER BY total DESC, name ASC
  `)) as unknown as Array<Record<string, unknown>>;

  return rows
    .filter((r) => r.slug)
    .map((r) => ({
      slug: String(r.slug),
      name: String(r.name),
      total: Number(r.total ?? 0),
    }));
}

/* ------------------------------------------------------------ share links */

export async function getShareLinkByToken(token: string) {
  const rows = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSharedRecommendation(recommendationId: string) {
  const rows = await db
    .select({
      ...baseSelect,
      recommenderName: users.name,
    })
    .from(recommendations)
    .innerJoin(providers, eq(providers.id, recommendations.providerId))
    .innerJoin(users, eq(users.id, recommendations.recommenderUserId))
    .leftJoin(categories, eq(categories.id, recommendations.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(
      and(
        eq(recommendations.id, recommendationId),
        isNull(providers.hiddenAt),
        // Same rule as the shared list: a link only exposes link-scoped entries.
        eq(recommendations.visibility, "link"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * A shared list contains only entries explicitly marked "anyone with the link".
 *
 * Not merely "everything that is not private": a recommendation scoped to your
 * connections or to one group was deliberately given a narrower audience, and a
 * public URL is wider than either. Anything less strict would quietly break the
 * promise the visibility picker makes.
 */
export async function getSharedList(userId: string) {
  const rows = await db
    .select({ ...baseSelect, recommenderName: users.name })
    .from(recommendations)
    .innerJoin(providers, eq(providers.id, recommendations.providerId))
    .innerJoin(users, eq(users.id, recommendations.recommenderUserId))
    .leftJoin(categories, eq(categories.id, recommendations.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(
      and(
        eq(recommendations.recommenderUserId, userId),
        isNull(providers.hiddenAt),
        eq(recommendations.visibility, "link"),
      ),
    )
    .orderBy(desc(recommendations.createdAt));
  return rows;
}

/** How many of the caller's entries a public link would actually expose. */
export async function countShareable(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(recommendations)
    .innerJoin(providers, eq(providers.id, recommendations.providerId))
    .where(
      and(
        eq(recommendations.recommenderUserId, userId),
        isNull(providers.hiddenAt),
        eq(recommendations.visibility, "link"),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function getMyShareLinks(userId: string) {
  return db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.userId, userId), isNull(shareLinks.revokedAt)));
}

export async function bumpShareView(token: string) {
  await db
    .update(shareLinks)
    .set({ viewCount: sql`${shareLinks.viewCount} + 1` })
    .where(eq(shareLinks.token, token));
}
