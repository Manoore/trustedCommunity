import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getConnectionIds, getSecondDegreeIds } from "@/lib/social";

import type { HelpDirection, HelpKind } from "@/lib/help-constants";

// Re-exported so server code can keep importing everything from one place.
export {
  ACCOMMODATION_KINDS,
  KIND_EMOJI,
  KIND_LABELS,
  type HelpDirection,
  type HelpKind,
} from "@/lib/help-constants";

export type PosterCard = {
  id: string;
  name: string;
  verified: boolean;
  helped: number;
  /** How the viewer is connected to them, if at all. */
  relation: "connection" | "friend_of_friend" | null;
};

export type HelpPostView = {
  id: string;
  direction: HelpDirection;
  kind: HelpKind;
  title: string;
  details: string | null;
  area: string | null;
  startsOn: string | null;
  endsOn: string | null;
  capacity: number;
  status: "open" | "closed" | "suspended";
  createdAt: Date;
  poster: PosterCard;
  acceptedCount: number;
  isMine: boolean;
  myResponse: { id: string; status: string } | null;
};

function toDateString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/**
 * How many newcomers each person has genuinely helped: completed responses where
 * they were the helper. For an offer the helper is the poster; for a need it is
 * whoever responded. Only the newcomer can mark one completed, so this cannot be
 * padded by a helper vouching for themselves.
 */
export async function getHelpedCounts(userIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!userIds.length) return out;

  const rows = (await db.execute(sql`
    SELECT
      CASE WHEN p.direction = 'offer' THEN p.user_id ELSE r.responder_user_id END AS helper_id,
      count(*)::int AS n
    FROM help_responses r
    JOIN help_posts p ON p.id = r.post_id
    WHERE r.status = 'completed'
    GROUP BY 1
    HAVING (CASE WHEN p.direction = 'offer' THEN p.user_id ELSE r.responder_user_id END)
      IN (${sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `)})
  `)) as unknown as Array<{ helper_id: string; n: number }>;

  for (const row of rows) out.set(row.helper_id, Number(row.n));
  return out;
}

/** Short quotes from newcomers this person helped. First names only. */
export async function getEndorsements(helperId: string, limit = 3) {
  const rows = (await db.execute(sql`
    SELECT r.endorsement, r.completed_at,
      split_part(
        CASE WHEN p.direction = 'offer' THEN ru.name ELSE pu.name END, ' ', 1
      ) AS newcomer_first_name
    FROM help_responses r
    JOIN help_posts p ON p.id = r.post_id
    JOIN users ru ON ru.id = r.responder_user_id
    JOIN users pu ON pu.id = p.user_id
    WHERE r.status = 'completed'
      AND r.endorsement IS NOT NULL AND r.endorsement <> ''
      AND (CASE WHEN p.direction = 'offer' THEN p.user_id ELSE r.responder_user_id END)
          = ${helperId}::uuid
    ORDER BY r.completed_at DESC
    LIMIT ${limit}
  `)) as unknown as Array<{ endorsement: string; newcomer_first_name: string }>;

  return rows.map((r) => ({ text: r.endorsement, from: r.newcomer_first_name }));
}

async function relationFor(viewerId: string) {
  const [first, second] = await Promise.all([
    getConnectionIds(viewerId),
    getSecondDegreeIds(viewerId),
  ]);
  return (id: string): PosterCard["relation"] =>
    first.includes(id) ? "connection" : second.includes(id) ? "friend_of_friend" : null;
}

type Row = Record<string, unknown>;

async function toViews(rows: Row[], viewerId: string): Promise<HelpPostView[]> {
  const posterIds = [...new Set(rows.map((r) => String(r.user_id)))];
  const [helped, relation] = await Promise.all([
    getHelpedCounts(posterIds),
    relationFor(viewerId),
  ]);

  return rows.map((r) => {
    const posterId = String(r.user_id);
    return {
      id: String(r.id),
      direction: r.direction as HelpDirection,
      kind: r.kind as HelpKind,
      title: String(r.title),
      details: (r.details as string) ?? null,
      area: (r.area as string) ?? null,
      startsOn: toDateString(r.starts_on),
      endsOn: toDateString(r.ends_on),
      capacity: Number(r.capacity ?? 1),
      status: r.status as HelpPostView["status"],
      createdAt: new Date(r.created_at as string),
      poster: {
        id: posterId,
        name: String(r.poster_name),
        verified: Boolean(r.poster_verified),
        helped: helped.get(posterId) ?? 0,
        relation: relation(posterId),
      },
      acceptedCount: Number(r.accepted_count ?? 0),
      isMine: posterId === viewerId,
      myResponse: r.my_response_id
        ? { id: String(r.my_response_id), status: String(r.my_response_status) }
        : null,
    };
  });
}

const POST_SELECT = (viewerId: string) => sql`
  SELECT p.id, p.user_id, p.direction, p.kind, p.title, p.details, p.area,
         p.starts_on, p.ends_on, p.capacity, p.status, p.created_at,
         u.name AS poster_name,
         (u.edu_verified_at IS NOT NULL AND u.college_id = p.college_id) AS poster_verified,
         (SELECT count(*)::int FROM help_responses r
           WHERE r.post_id = p.id AND r.status IN ('accepted', 'completed')) AS accepted_count,
         mr.id AS my_response_id, mr.status AS my_response_status
  FROM help_posts p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN help_responses mr
    ON mr.post_id = p.id AND mr.responder_user_id = ${viewerId}::uuid
`;

export async function getHelpBoard(
  viewerId: string,
  collegeId: string,
  filters: { direction?: HelpDirection; kind?: HelpKind } = {},
): Promise<HelpPostView[]> {
  const where = [sql`p.college_id = ${collegeId}::uuid`, sql`p.status = 'open'`];
  if (filters.direction) where.push(sql`p.direction = ${filters.direction}`);
  if (filters.kind) where.push(sql`p.kind = ${filters.kind}`);

  const rows = (await db.execute(sql`
    ${POST_SELECT(viewerId)}
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY p.starts_on ASC NULLS LAST, p.created_at DESC
    LIMIT 60
  `)) as unknown as Row[];

  return toViews(rows, viewerId);
}

export async function getHelpPost(postId: string, viewerId: string) {
  const rows = (await db.execute(sql`
    ${POST_SELECT(viewerId)}
    WHERE p.id = ${postId}::uuid
    LIMIT 1
  `)) as unknown as Row[];
  if (!rows.length) return null;

  const [view] = await toViews(rows, viewerId);
  const [row] = (await db.execute(sql`
    SELECT college_id, contact_phone FROM help_posts WHERE id = ${postId}::uuid
  `)) as unknown as Array<{ college_id: string; contact_phone: string | null }>;

  return { ...view, collegeId: row.college_id, contactPhone: row.contact_phone };
}

export type ResponseView = {
  id: string;
  status: "pending" | "accepted" | "declined" | "completed" | "cancelled";
  message: string | null;
  endorsement: string | null;
  createdAt: Date;
  responder: PosterCard;
  /** Present only once accepted, and only for the two people involved. */
  contact: { email: string; phone: string | null } | null;
};

/**
 * Responses to one post. The post owner sees everyone who responded; a
 * responder sees only their own. Contact details are attached only to accepted
 * responses, so nobody's email or phone leaks before they have agreed to help or
 * be helped.
 */
export async function getResponses(
  postId: string,
  viewerId: string,
  postOwnerId: string,
): Promise<ResponseView[]> {
  const ownerView = viewerId === postOwnerId;
  const rows = (await db.execute(sql`
    SELECT r.id, r.status, r.message, r.endorsement, r.created_at, r.contact_phone,
           r.responder_user_id, u.name AS responder_name, u.email AS responder_email,
           (u.edu_verified_at IS NOT NULL AND u.college_id = p.college_id) AS responder_verified
    FROM help_responses r
    JOIN help_posts p ON p.id = r.post_id
    JOIN users u ON u.id = r.responder_user_id
    WHERE r.post_id = ${postId}::uuid
      ${ownerView ? sql`` : sql`AND r.responder_user_id = ${viewerId}::uuid`}
    ORDER BY r.created_at ASC
  `)) as unknown as Row[];

  const ids = rows.map((r) => String(r.responder_user_id));
  const [helped, relation] = await Promise.all([getHelpedCounts(ids), relationFor(viewerId)]);

  return rows.map((r) => {
    const accepted = r.status === "accepted" || r.status === "completed";
    return {
      id: String(r.id),
      status: r.status as ResponseView["status"],
      message: (r.message as string) ?? null,
      endorsement: (r.endorsement as string) ?? null,
      createdAt: new Date(r.created_at as string),
      responder: {
        id: String(r.responder_user_id),
        name: String(r.responder_name),
        verified: Boolean(r.responder_verified),
        helped: helped.get(String(r.responder_user_id)) ?? 0,
        relation: relation(String(r.responder_user_id)),
      },
      contact:
        accepted && ownerView
          ? {
              email: String(r.responder_email),
              phone: (r.contact_phone as string) ?? null,
            }
          : null,
    };
  });
}

/**
 * The poster's contact details, for someone whose response they accepted.
 * Returns null for everyone else, so it is safe to call for any viewer.
 */
export async function getPosterContact(postId: string, viewerId: string) {
  const [row] = (await db.execute(sql`
    SELECT u.email, p.contact_phone AS phone
    FROM help_posts p
    JOIN users u ON u.id = p.user_id
    JOIN help_responses r
      ON r.post_id = p.id
     AND r.responder_user_id = ${viewerId}::uuid
     AND r.status IN ('accepted', 'completed')
    WHERE p.id = ${postId}::uuid
    LIMIT 1
  `)) as unknown as Array<{ email: string; phone: string | null }>;
  return row ? { email: row.email, phone: row.phone } : null;
}

/** Counts used by the arrival checklist. */
export async function getBoardCounts(collegeId: string) {
  const rows = (await db.execute(sql`
    SELECT kind, direction, count(*)::int AS n
    FROM help_posts
    WHERE college_id = ${collegeId}::uuid AND status = 'open'
    GROUP BY kind, direction
  `)) as unknown as Array<{ kind: HelpKind; direction: HelpDirection; n: number }>;

  const counts: Record<string, number> = {};
  for (const r of rows) counts[`${r.direction}:${r.kind}`] = Number(r.n);
  return counts;
}

/** Everything the viewer has posted or responded to, for their own overview. */
export async function getMyHelpActivity(userId: string) {
  const rows = (await db.execute(sql`
    SELECT p.id AS post_id, p.title, p.kind, p.direction, p.status AS post_status,
           r.id AS response_id, r.status AS response_status, 'responded' AS role
    FROM help_responses r JOIN help_posts p ON p.id = r.post_id
    WHERE r.responder_user_id = ${userId}::uuid AND r.status IN ('pending', 'accepted')
    UNION ALL
    SELECT p.id, p.title, p.kind, p.direction, p.status, NULL, NULL, 'posted'
    FROM help_posts p WHERE p.user_id = ${userId}::uuid AND p.status <> 'suspended'
    ORDER BY 1
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    postId: String(r.post_id),
    title: String(r.title),
    kind: r.kind as HelpKind,
    direction: r.direction as HelpDirection,
    postStatus: String(r.post_status),
    responseStatus: (r.response_status as string) ?? null,
    role: String(r.role) as "posted" | "responded",
  }));
}
