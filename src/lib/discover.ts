import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getConnectionIds, getGroupIds, getSecondDegreeIds } from "@/lib/social";

/**
 * Discovery across the trust graph.
 *
 * Ranking is the whole point. A directory sorts by distance or by who paid; this
 * sorts by how close the recommender is to you:
 *
 *   1. someone you are connected to
 *   2. someone in a group you belong to
 *   3. a friend of a friend
 *
 * A second-degree recommendation is only surfaced when the author scoped it to
 * their connections — reaching further than the author intended would break the
 * visibility promise, so the graph stops there rather than flattening into a
 * public directory.
 */
export type DiscoverResult = {
  id: string;
  name: string;
  providerSlug: string;
  kind: "business" | "individual";
  phone: string | null;
  city: string | null;
  state: string | null;
  websiteUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  groupName: string | null;
  groupSlug: string | null;
  note: string | null;
  relationship: string;
  strength: "recommend" | "highly_recommend" | "go_to";
  recommenderName: string;
  /** 1 = direct connection, 2 = same group, 3 = friend of a friend. */
  degree: number;
  degreeLabel: string;
  otherRecommenders: number;
};

const DEGREE_LABELS: Record<number, string> = {
  1: "Someone you know",
  2: "From one of your groups",
  3: "A friend of a friend",
};

function uuidList(ids: string[]) {
  return sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
}

export async function discover(
  viewerId: string,
  opts: { q?: string; categorySlug?: string } = {},
): Promise<DiscoverResult[]> {
  const [connectionIds, groupIds, secondDegreeIds] = await Promise.all([
    getConnectionIds(viewerId),
    getGroupIds(viewerId),
    getSecondDegreeIds(viewerId),
  ]);

  if (!connectionIds.length && !groupIds.length && !secondDegreeIds.length) {
    return [];
  }

  /* Each rung of the ladder, as its own visibility clause. */
  const clauses = [];

  if (connectionIds.length) {
    clauses.push(sql`(
      r.visibility IN ('connections', 'groups', 'link')
      AND r.recommender_user_id IN (${uuidList(connectionIds)})
    )`);
  }

  if (groupIds.length) {
    clauses.push(sql`(
      r.visibility = 'groups'
      AND EXISTS (
        SELECT 1 FROM recommendation_groups rg
        WHERE rg.recommendation_id = r.id AND rg.group_id IN (${uuidList(groupIds)})
      )
    )`);
  }

  if (secondDegreeIds.length) {
    clauses.push(sql`(
      r.visibility = 'connections'
      AND r.recommender_user_id IN (${uuidList(secondDegreeIds)})
    )`);
  }

  const degreeExpr = sql`CASE
    ${connectionIds.length ? sql`WHEN r.recommender_user_id IN (${uuidList(connectionIds)}) THEN 1` : sql``}
    ${groupIds.length ? sql`WHEN EXISTS (SELECT 1 FROM recommendation_groups rg WHERE rg.recommendation_id = r.id AND rg.group_id IN (${uuidList(groupIds)})) THEN 2` : sql``}
    ELSE 3
  END`;

  const filters = [
    sql`r.recommender_user_id <> ${viewerId}::uuid`,
    sql`p.hidden_at IS NULL`,
    sql`(${sql.join(clauses, sql` OR `)})`,
  ];

  if (opts.categorySlug) {
    filters.push(sql`(c.slug = ${opts.categorySlug} OR pc.slug = ${opts.categorySlug})`);
  }

  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`;
    filters.push(sql`(
      p.display_name ILIKE ${like}
      OR r.note ILIKE ${like}
      OR c.name ILIKE ${like}
      OR p.city ILIKE ${like}
    )`);
  }

  const rows = (await db.execute(sql`
    SELECT
      r.id, r.note, r.relationship, r.strength,
      p.display_name AS name, p.slug AS provider_slug, p.kind,
      p.contact_phone AS phone, p.city, p.state, p.website_url,
      c.name AS category_name, c.slug AS category_slug,
      pc.name AS group_name, pc.slug AS group_slug,
      u.name AS recommender_name,
      ${degreeExpr} AS degree,
      (
        SELECT count(*)::int FROM recommendations r2
        WHERE r2.provider_id = p.id AND r2.visibility <> 'private'
      ) AS other_recommenders
    FROM recommendations r
    JOIN providers p ON p.id = r.provider_id
    JOIN users u ON u.id = r.recommender_user_id
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE ${sql.join(filters, sql` AND `)}
    ORDER BY ${degreeExpr} ASC,
      CASE r.strength WHEN 'go_to' THEN 0 WHEN 'highly_recommend' THEN 1 ELSE 2 END ASC,
      r.created_at DESC
    LIMIT 60
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const degree = Number(row.degree ?? 3);
    return {
      id: String(row.id),
      name: String(row.name),
      providerSlug: String(row.provider_slug),
      kind: row.kind as "business" | "individual",
      phone: (row.phone as string) ?? null,
      city: (row.city as string) ?? null,
      state: (row.state as string) ?? null,
      websiteUrl: (row.website_url as string) ?? null,
      categoryName: (row.category_name as string) ?? null,
      categorySlug: (row.category_slug as string) ?? null,
      groupName: (row.group_name as string) ?? null,
      groupSlug: (row.group_slug as string) ?? null,
      note: (row.note as string) ?? null,
      relationship: String(row.relationship),
      strength: row.strength as DiscoverResult["strength"],
      recommenderName: String(row.recommender_name),
      degree,
      degreeLabel: DEGREE_LABELS[degree] ?? "In your wider network",
      otherRecommenders: Math.max(Number(row.other_recommenders ?? 1) - 1, 0),
    };
  });
}

export type GroupTopContact = {
  providerId: string;
  slug: string;
  name: string;
  kind: "business" | "individual";
  city: string | null;
  state: string | null;
  categoryName: string | null;
  groupSlug: string | null;
  /** Distinct members of this group who vouch for them. */
  members: number;
  /** Of those, how many say they used them personally. */
  usedPersonally: number;
  /** Whether the viewer already backs this contact. */
  mine: boolean;
  topNote: string | null;
  topNoteAuthor: string | null;
};

/**
 * One row per contact, ranked by how many members of the group vouch for them.
 *
 * This is the part that makes a group useful on day one: "Mike's Plumbing -
 * 7 members" says far more than seven separate cards. Only vouches that were
 * explicitly shared into this group count, so a private or connections-only
 * entry can never inflate - or reveal - a number here. Deliberately no phone
 * number: it links to the profile, where the privacy rules for individuals
 * are already enforced in one place.
 */
export async function getGroupTopContacts(
  groupId: string,
  viewerId: string,
): Promise<GroupTopContact[]> {
  const rows = (await db.execute(sql`
    SELECT
      p.id AS provider_id, p.slug, p.display_name AS name, p.kind, p.city, p.state,
      (array_agg(c.name ORDER BY r.created_at DESC) FILTER (WHERE c.name IS NOT NULL))[1] AS category_name,
      (array_agg(pc.slug ORDER BY r.created_at DESC) FILTER (WHERE pc.slug IS NOT NULL))[1] AS group_slug,
      count(DISTINCT r.recommender_user_id)::int AS members,
      (count(DISTINCT r.recommender_user_id)
        FILTER (WHERE r.relationship = 'used_personally'))::int AS used_personally,
      bool_or(r.recommender_user_id = ${viewerId}::uuid) AS mine,
      (array_agg(r.note ORDER BY
         CASE r.strength WHEN 'go_to' THEN 0 WHEN 'highly_recommend' THEN 1 ELSE 2 END,
         r.created_at DESC
       ) FILTER (WHERE r.note IS NOT NULL AND r.note <> ''))[1] AS top_note,
      (array_agg(u.name ORDER BY
         CASE r.strength WHEN 'go_to' THEN 0 WHEN 'highly_recommend' THEN 1 ELSE 2 END,
         r.created_at DESC
       ) FILTER (WHERE r.note IS NOT NULL AND r.note <> ''))[1] AS top_note_author
    FROM recommendation_groups rg
    JOIN recommendations r ON r.id = rg.recommendation_id AND r.visibility = 'groups'
    JOIN providers p ON p.id = r.provider_id AND p.hidden_at IS NULL
    JOIN users u ON u.id = r.recommender_user_id
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE rg.group_id = ${groupId}::uuid
    GROUP BY p.id
    ORDER BY members DESC, used_personally DESC, max(r.created_at) DESC
    LIMIT 25
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    providerId: String(row.provider_id),
    slug: String(row.slug),
    name: String(row.name),
    kind: row.kind as "business" | "individual",
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    categoryName: (row.category_name as string) ?? null,
    groupSlug: (row.group_slug as string) ?? null,
    members: Number(row.members ?? 0),
    usedPersonally: Number(row.used_personally ?? 0),
    mine: Boolean(row.mine),
    topNote: (row.top_note as string) ?? null,
    topNoteAuthor: (row.top_note_author as string) ?? null,
  }));
}

/** Recommendations explicitly shared into one group. */
export async function getGroupRecommendations(groupId: string, viewerId: string) {
  const rows = (await db.execute(sql`
    SELECT
      r.id, r.note, r.relationship, r.strength, r.visibility,
      p.display_name AS name, p.slug AS provider_slug, p.kind,
      p.contact_phone AS phone, p.city, p.state, p.website_url,
      c.name AS category_name, c.slug AS category_slug,
      pc.name AS group_name, pc.slug AS group_slug,
      u.name AS recommender_name,
      (
        SELECT count(*)::int FROM recommendations r2
        WHERE r2.provider_id = p.id
          AND r2.visibility <> 'private'
          AND r2.recommender_user_id <> r.recommender_user_id
      ) AS other_recommenders
    FROM recommendation_groups rg
    JOIN recommendations r ON r.id = rg.recommendation_id
    JOIN providers p ON p.id = r.provider_id
    JOIN users u ON u.id = r.recommender_user_id
    LEFT JOIN categories c ON c.id = r.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
    WHERE rg.group_id = ${groupId}::uuid
      AND r.visibility = 'groups'
      AND p.hidden_at IS NULL
    ORDER BY r.created_at DESC
    LIMIT 100
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    providerSlug: String(row.provider_slug),
    kind: row.kind as "business" | "individual",
    phone: (row.phone as string) ?? null,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    websiteUrl: (row.website_url as string) ?? null,
    categoryName: (row.category_name as string) ?? null,
    categorySlug: (row.category_slug as string) ?? null,
    groupName: (row.group_name as string) ?? null,
    groupSlug: (row.group_slug as string) ?? null,
    note: (row.note as string) ?? null,
    relationship: String(row.relationship),
    strength: row.strength as "recommend" | "highly_recommend" | "go_to",
    recommenderName: String(row.recommender_name),
    otherRecommenders: Number(row.other_recommenders ?? 0),
  }));
}
