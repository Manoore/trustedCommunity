import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { askResponses, asks, categories, providers, users } from "@/db/schema";
import { getConnectionIds, getGroupIds } from "@/lib/social";

export async function getMyAsks(userId: string) {
  return db
    .select({
      ask: asks,
      categoryName: categories.name,
      responseCount: sql<number>`(
        SELECT count(*)::int FROM ask_responses ar WHERE ar.ask_id = ${asks.id}
      )`,
    })
    .from(asks)
    .leftJoin(categories, eq(categories.id, asks.categoryId))
    .where(eq(asks.userId, userId))
    .orderBy(desc(asks.createdAt));
}

/**
 * Asks addressed to the caller: either the author is a connection and sent it to
 * their connections, or it was sent to a group the caller belongs to.
 */
export async function getIncomingAsks(userId: string) {
  const [connectionIds, groupIds] = await Promise.all([
    getConnectionIds(userId),
    getGroupIds(userId),
  ]);

  if (!connectionIds.length && !groupIds.length) return [];

  const clauses = [];
  if (connectionIds.length) {
    clauses.push(sql`(
      t.audience = 'connections'
      AND a.user_id IN (${sql.join(
        connectionIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
    )`);
  }
  if (groupIds.length) {
    clauses.push(sql`(
      t.audience = 'group'
      AND t.group_id IN (${sql.join(
        groupIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
    )`);
  }

  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (a.id)
      a.id, a.title, a.body, a.city, a.state, a.status, a.created_at,
      u.name AS author_name,
      c.name AS category_name,
      (SELECT count(*)::int FROM ask_responses ar WHERE ar.ask_id = a.id) AS response_count,
      EXISTS (
        SELECT 1 FROM ask_responses ar
        WHERE ar.ask_id = a.id AND ar.responder_user_id = ${userId}::uuid
      ) AS answered_by_me
    FROM asks a
    JOIN ask_targets t ON t.ask_id = a.id
    JOIN users u ON u.id = a.user_id
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.status = 'open'
      AND a.user_id <> ${userId}::uuid
      AND (${sql.join(clauses, sql` OR `)})
    ORDER BY a.id, a.created_at DESC
  `)) as unknown as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    body: (r.body as string) ?? null,
    city: (r.city as string) ?? null,
    state: (r.state as string) ?? null,
    authorName: String(r.author_name),
    categoryName: (r.category_name as string) ?? null,
    createdAt: new Date(r.created_at as string),
    responseCount: Number(r.response_count ?? 0),
    answeredByMe: Boolean(r.answered_by_me),
  }));
}

/** An ask plus its answers. Returns null when the viewer may not see it. */
export async function getAsk(askId: string, viewerId: string) {
  const [row] = await db
    .select({
      ask: asks,
      authorName: users.name,
      authorId: users.id,
      categoryName: categories.name,
    })
    .from(asks)
    .innerJoin(users, eq(users.id, asks.userId))
    .leftJoin(categories, eq(categories.id, asks.categoryId))
    .where(eq(asks.id, askId))
    .limit(1);

  if (!row) return null;

  if (row.authorId !== viewerId) {
    const incoming = await getIncomingAsks(viewerId);
    if (!incoming.some((a) => a.id === askId)) return null;
  }

  const responses = await db
    .select({
      id: askResponses.id,
      note: askResponses.note,
      createdAt: askResponses.createdAt,
      responderName: users.name,
      providerName: providers.displayName,
      providerSlug: providers.slug,
      providerPhone: providers.contactPhone,
      providerCity: providers.city,
      providerState: providers.state,
    })
    .from(askResponses)
    .innerJoin(users, eq(users.id, askResponses.responderUserId))
    .leftJoin(providers, eq(providers.id, askResponses.providerId))
    .where(eq(askResponses.askId, askId))
    .orderBy(desc(askResponses.createdAt));

  return { ...row, responses, isAuthor: row.authorId === viewerId };
}

/** Everyone an ask should notify. */
export async function getAskRecipients(askId: string) {
  const rows = (await db.execute(sql`
    SELECT DISTINCT u.id, u.name, u.email
    FROM ask_targets t
    JOIN asks a ON a.id = t.ask_id
    LEFT JOIN connections c
      ON t.audience = 'connections'
     AND c.status = 'accepted'
     AND (c.requester_id = a.user_id OR c.addressee_id = a.user_id)
    LEFT JOIN group_members gm
      ON t.audience = 'group' AND gm.group_id = t.group_id
    JOIN users u
      ON u.id = COALESCE(
           gm.user_id,
           CASE WHEN c.requester_id = a.user_id THEN c.addressee_id ELSE c.requester_id END
         )
    WHERE t.ask_id = ${askId}::uuid
      AND u.id <> a.user_id
  `)) as unknown as Array<{ id: string; name: string; email: string }>;
  return rows;
}
