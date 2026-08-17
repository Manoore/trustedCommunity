import "server-only";

import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  MIN_RESULTS_BEFORE_EXPANDING,
  RADIUS_LADDER,
  resolveLocation,
  type GeoPoint,
} from "@/lib/geo";

export type SortKey = "relevance" | "distance" | "rating" | "newest";

export type SearchParams = {
  q?: string;
  categorySlug?: string;
  loc?: string;
  radius?: number;
  remoteOnly?: boolean;
  sort?: SortKey;
  page?: number;
  perPage?: number;
};

export type SearchResult = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceType: "hourly" | "fixed" | "starting_at" | "quote";
  priceMinCents: number | null;
  priceMaxCents: number | null;
  remoteOk: boolean;
  city: string | null;
  state: string | null;
  zip: string | null;
  featured: boolean;
  createdAt: Date;
  distanceMiles: number | null;
  categoryName: string;
  categorySlug: string;
  licenseRequired: boolean;
  providerSlug: string;
  providerName: string;
  providerType: "individual" | "entity";
  providerVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  imageUrl: string | null;
};

export type SearchResponse = {
  items: SearchResult[];
  total: number;
  page: number;
  perPage: number;
  origin: GeoPoint | null;
  /** Radius actually used, after widening for thin supply. */
  appliedRadius: number;
  /** True when we had to widen past the requested radius to find anything. */
  expanded: boolean;
  requestedRadius: number;
  /** Result counts at each rung of the ladder, for the "widen search" UI. */
  radiusCounts: Record<number, number>;
};

const DEFAULT_PER_PAGE = 20;
const EARTH_RADIUS_MILES = 3958.8;

/**
 * Haversine in SQL. The bounding box below is what keeps the index in play.
 *
 * The earth radius is emitted as a literal rather than a bind parameter:
 * Postgres infers a parameter's type from its context, and `$1 * 2` types it as
 * integer, which then rejects 3958.8. The origin coordinates are still bound,
 * with an explicit cast for the same reason.
 */
function distanceExpr(origin: GeoPoint): SQL<number> {
  const R = sql.raw(EARTH_RADIUS_MILES.toFixed(4));
  const oLat = sql`${origin.lat}::double precision`;
  const oLng = sql`${origin.lng}::double precision`;
  return sql<number>`(${R} * 2 * asin(sqrt(
    power(sin(radians(l.lat - ${oLat}) / 2), 2) +
    cos(radians(${oLat})) * cos(radians(l.lat)) *
    power(sin(radians(l.lng - ${oLng}) / 2), 2)
  )))`;
}

function boundingBoxCondition(origin: GeoPoint, miles: number): SQL {
  const latDelta = miles / 69;
  const cosLat = Math.max(Math.cos((origin.lat * Math.PI) / 180), 0.01);
  const lngDelta = miles / (69 * cosLat);
  return sql`l.lat BETWEEN ${origin.lat - latDelta}::double precision AND ${origin.lat + latDelta}::double precision
         AND l.lng BETWEEN ${origin.lng - lngDelta}::double precision AND ${origin.lng + lngDelta}::double precision`;
}

/**
 * A listing matches a location if the buyer is inside the radius they chose,
 * or inside the radius the provider says they travel. Providers who cover a
 * whole state should not be hidden because the buyer searched "within 25 miles".
 */
function locationCondition(origin: GeoPoint, searchRadius: number): SQL {
  const dist = distanceExpr(origin);
  return sql`(
    l.remote_ok = true
    OR (
      l.lat IS NOT NULL AND l.lng IS NOT NULL
      AND (${boundingBoxCondition(origin, Math.max(searchRadius, 500))})
      AND ${dist} <= GREATEST(l.service_radius_miles, ${searchRadius})
    )
  )`;
}

function keywordCondition(q: string): SQL {
  return sql`(
    to_tsvector('english', coalesce(l.title, '') || ' ' || coalesce(l.description, ''))
      @@ websearch_to_tsquery('english', ${q})
    OR l.title ILIKE ${"%" + q + "%"}
    OR p.display_name ILIKE ${"%" + q + "%"}
    OR c.name ILIKE ${"%" + q + "%"}
  )`;
}

/** Resolves a category slug to itself plus every descendant id. */
async function categoryIds(slug: string): Promise<string[]> {
  const rows = (await db.execute(sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM categories WHERE slug = ${slug}
      UNION ALL
      SELECT c.id FROM categories c JOIN tree t ON c.parent_id = t.id
    )
    SELECT id FROM tree
  `)) as unknown as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export async function searchListings(params: SearchParams): Promise<SearchResponse> {
  const perPage = params.perPage ?? DEFAULT_PER_PAGE;
  const page = Math.max(params.page ?? 1, 1);
  const q = params.q?.trim() || undefined;
  const requestedRadius = params.radius ?? RADIUS_LADDER[0];
  const origin = resolveLocation(params.loc);

  const conditions: SQL[] = [
    sql`l.status = 'active'`,
    sql`p.status = 'active'`,
    // Restricted categories never surface, whatever the query says.
    sql`c.restricted = false`,
  ];

  if (q) conditions.push(keywordCondition(q));
  if (params.remoteOnly) conditions.push(sql`l.remote_ok = true`);

  if (params.categorySlug) {
    const ids = await categoryIds(params.categorySlug);
    if (!ids.length) {
      return {
        items: [],
        total: 0,
        page,
        perPage,
        origin,
        appliedRadius: requestedRadius,
        expanded: false,
        requestedRadius,
        radiusCounts: {},
      };
    }
    conditions.push(
      sql`l.category_id IN (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    );
  }

  const baseFrom = sql`
    FROM listings l
    JOIN providers p ON p.id = l.provider_id
    JOIN categories c ON c.id = l.category_id
  `;

  const baseWhere = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

  /* -------- pass 1: how many results sit at each rung of the radius ladder */

  let appliedRadius = requestedRadius;
  let expanded = false;
  const radiusCounts: Record<number, number> = {};

  if (origin && !params.remoteOnly) {
    const dist = distanceExpr(origin);
    const buckets = RADIUS_LADDER.map(
      (r) =>
        sql`count(*) FILTER (WHERE l.remote_ok = true OR (l.lat IS NOT NULL AND ${dist} <= GREATEST(l.service_radius_miles, ${r}))) AS "r${sql.raw(String(r))}"`,
    );

    const [counts] = (await db.execute(sql`
      SELECT ${sql.join(buckets, sql`, `)}
      ${baseFrom}
      ${baseWhere}
    `)) as unknown as Array<Record<string, string>>;

    for (const r of RADIUS_LADDER) {
      radiusCounts[r] = Number(counts?.[`r${r}`] ?? 0);
    }

    // Widen until there is enough on the page to be worth showing. A nationwide
    // launch means most ZIPs start empty; an auto-widened list beats a dead end.
    const ladder = RADIUS_LADDER.filter((r) => r >= requestedRadius);
    appliedRadius =
      ladder.find((r) => radiusCounts[r] >= MIN_RESULTS_BEFORE_EXPANDING) ??
      ladder[ladder.length - 1] ??
      requestedRadius;
    expanded = appliedRadius > requestedRadius;

    conditions.push(locationCondition(origin, appliedRadius));
  }

  const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

  /* --------------------------------------------------------- pass 2: rows */

  const distanceSelect = origin
    ? sql`CASE WHEN l.lat IS NULL THEN NULL ELSE ${distanceExpr(origin)} END`
    : sql`NULL::double precision`;

  const featuredExpr = sql`(l.featured_until IS NOT NULL AND l.featured_until > now())`;

  const relevanceExpr = q
    ? sql`ts_rank(
        to_tsvector('english', coalesce(l.title, '') || ' ' || coalesce(l.description, '')),
        websearch_to_tsquery('english', ${q})
      )`
    : sql`0`;

  let orderBy: SQL;
  switch (params.sort) {
    case "distance":
      orderBy = origin
        ? sql`${featuredExpr} DESC, "distance_miles" ASC NULLS LAST, l.created_at DESC`
        : sql`${featuredExpr} DESC, l.created_at DESC`;
      break;
    case "rating":
      orderBy = sql`${featuredExpr} DESC, p.rating_avg DESC, p.rating_count DESC, l.created_at DESC`;
      break;
    case "newest":
      orderBy = sql`${featuredExpr} DESC, l.created_at DESC`;
      break;
    case "relevance":
    default:
      orderBy = q
        ? sql`${featuredExpr} DESC, ${relevanceExpr} DESC, "distance_miles" ASC NULLS LAST, l.created_at DESC`
        : origin
          ? sql`${featuredExpr} DESC, "distance_miles" ASC NULLS LAST, p.rating_avg DESC, l.created_at DESC`
          : sql`${featuredExpr} DESC, p.rating_avg DESC, l.created_at DESC`;
  }

  const [countRow] = (await db.execute(sql`
    SELECT count(*)::int AS total ${baseFrom} ${where}
  `)) as unknown as Array<{ total: number }>;
  const total = Number(countRow?.total ?? 0);

  const rows = (await db.execute(sql`
    SELECT
      l.id, l.slug, l.title, l.description, l.price_type, l.price_min_cents,
      l.price_max_cents, l.remote_ok, l.city, l.state, l.zip, l.created_at,
      ${featuredExpr} AS featured,
      ${distanceSelect} AS "distance_miles",
      c.name AS category_name, c.slug AS category_slug, c.license_required,
      p.slug AS provider_slug, p.display_name AS provider_name, p.type AS provider_type,
      (p.verified_at IS NOT NULL) AS provider_verified,
      p.rating_avg, p.rating_count,
      (
        SELECT m.url FROM listing_media m
        WHERE m.listing_id = l.id
        ORDER BY m.sort_order ASC LIMIT 1
      ) AS image_url
    ${baseFrom}
    ${where}
    ORDER BY ${orderBy}
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `)) as unknown as Array<Record<string, unknown>>;

  const items: SearchResult[] = rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    description: String(r.description),
    priceType: r.price_type as SearchResult["priceType"],
    priceMinCents: r.price_min_cents == null ? null : Number(r.price_min_cents),
    priceMaxCents: r.price_max_cents == null ? null : Number(r.price_max_cents),
    remoteOk: Boolean(r.remote_ok),
    city: (r.city as string) ?? null,
    state: (r.state as string) ?? null,
    zip: (r.zip as string) ?? null,
    featured: Boolean(r.featured),
    createdAt: new Date(r.created_at as string),
    distanceMiles: r.distance_miles == null ? null : Number(r.distance_miles),
    categoryName: String(r.category_name),
    categorySlug: String(r.category_slug),
    licenseRequired: Boolean(r.license_required),
    providerSlug: String(r.provider_slug),
    providerName: String(r.provider_name),
    providerType: r.provider_type as "individual" | "entity",
    providerVerified: Boolean(r.provider_verified),
    ratingAvg: Number(r.rating_avg ?? 0),
    ratingCount: Number(r.rating_count ?? 0),
    imageUrl: (r.image_url as string) ?? null,
  }));

  return {
    items,
    total,
    page,
    perPage,
    origin,
    appliedRadius,
    expanded,
    requestedRadius,
    radiusCounts,
  };
}
