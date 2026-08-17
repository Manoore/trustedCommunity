import "server-only";

import { cache } from "react";
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { connections, groupMembers, groups, users } from "@/db/schema";

/* ----------------------------------------------------------- connections */

/**
 * Connections are stored once, not twice: the row records who asked and who was
 * asked, and "my partner" is whichever end is not me. Everything below reads
 * from that single row.
 */
const partnerExpr = (userId: string) => sql<string>`CASE
  WHEN ${connections.requesterId} = ${userId}::uuid THEN ${connections.addresseeId}
  ELSE ${connections.requesterId}
END`;

export const getConnectionIds = cache(async (userId: string): Promise<string[]> => {
  const rows = (await db.execute(sql`
    SELECT CASE WHEN requester_id = ${userId}::uuid THEN addressee_id ELSE requester_id END AS uid
    FROM connections
    WHERE status = 'accepted'
      AND (requester_id = ${userId}::uuid OR addressee_id = ${userId}::uuid)
  `)) as unknown as Array<{ uid: string }>;
  return rows.map((r) => r.uid);
});

/**
 * Friends of friends. This is the raw material for "recommended by someone your
 * friend trusts" — the whole reason a trust graph beats a directory.
 */
export const getSecondDegreeIds = cache(async (userId: string): Promise<string[]> => {
  const rows = (await db.execute(sql`
    WITH first_degree AS (
      SELECT CASE WHEN requester_id = ${userId}::uuid THEN addressee_id ELSE requester_id END AS uid
      FROM connections
      WHERE status = 'accepted'
        AND (requester_id = ${userId}::uuid OR addressee_id = ${userId}::uuid)
    ),
    second_degree AS (
      SELECT DISTINCT
        CASE WHEN c.requester_id = f.uid THEN c.addressee_id ELSE c.requester_id END AS uid
      FROM connections c
      JOIN first_degree f
        ON f.uid = c.requester_id OR f.uid = c.addressee_id
      WHERE c.status = 'accepted'
    )
    SELECT uid FROM second_degree
    WHERE uid <> ${userId}::uuid
      AND uid NOT IN (SELECT uid FROM first_degree)
  `)) as unknown as Array<{ uid: string }>;
  return rows.map((r) => r.uid);
});

export async function getConnections(userId: string) {
  return db
    .select({
      connectionId: connections.id,
      userId: partnerExpr(userId),
      name: users.name,
      email: users.email,
      since: connections.respondedAt,
    })
    .from(connections)
    .innerJoin(users, eq(users.id, partnerExpr(userId)))
    .where(
      and(
        eq(connections.status, "accepted"),
        or(
          eq(connections.requesterId, userId),
          eq(connections.addresseeId, userId),
        ),
      ),
    );
}

export async function getPendingIncoming(userId: string) {
  return db
    .select({
      connectionId: connections.id,
      name: users.name,
      email: users.email,
      createdAt: connections.createdAt,
    })
    .from(connections)
    .innerJoin(users, eq(users.id, connections.requesterId))
    .where(
      and(eq(connections.addresseeId, userId), eq(connections.status, "pending")),
    );
}

export async function getPendingOutgoing(userId: string) {
  return db
    .select({
      connectionId: connections.id,
      name: users.name,
      email: users.email,
      createdAt: connections.createdAt,
    })
    .from(connections)
    .innerJoin(users, eq(users.id, connections.addresseeId))
    .where(
      and(eq(connections.requesterId, userId), eq(connections.status, "pending")),
    );
}

/**
 * Name search, restricted to friends of friends.
 *
 * There is no directory of every user on the app — that would let anyone browse
 * for anyone, which is exactly the creepiness a private trust graph is supposed
 * to avoid. But once someone is two hops away (your friend's friend), you have
 * a legitimate reason to find them by name: your friend already vouches for
 * knowing them. So search only reaches that far, never further.
 */
export async function searchSecondDegreeByName(userId: string, query: string) {
  if (!query.trim()) return [];

  const [connectionIds, secondDegreeIds] = await Promise.all([
    getConnectionIds(userId),
    getSecondDegreeIds(userId),
  ]);

  const candidateIds = secondDegreeIds.filter((id) => !connectionIds.includes(id));
  if (!candidateIds.length) return [];

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      and(
        sql`${users.id} IN (${sql.join(
          candidateIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`,
        sql`${users.name} ILIKE ${"%" + query.trim() + "%"}`,
      ),
    )
    .limit(10);

  // Who introduces the connection, so the requester knows why this name showed up.
  const withMutual = await Promise.all(
    rows.map(async (r) => {
      const theirConnections = await getConnectionIds(r.id);
      const mutualId = theirConnections.find((id) => connectionIds.includes(id));
      let mutualName: string | null = null;
      if (mutualId) {
        const [mutual] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, mutualId))
          .limit(1);
        mutualName = mutual?.name ?? null;
      }
      return { ...r, mutualName };
    }),
  );

  return withMutual;
}

/* --------------------------------------------------------------- groups */

export const getGroupIds = cache(async (userId: string): Promise<string[]> => {
  const rows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));
  return rows.map((r) => r.groupId);
});

export async function getMyGroups(userId: string) {
  return db
    .select({
      id: groups.id,
      slug: groups.slug,
      name: groups.name,
      kind: groups.kind,
      description: groups.description,
      city: groups.city,
      state: groups.state,
      inviteToken: groups.inviteToken,
      role: groupMembers.role,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members gm WHERE gm.group_id = ${groups.id}
      )`,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId));
}

export async function isGroupMember(userId: string, groupId: string) {
  const ids = await getGroupIds(userId);
  return ids.includes(groupId);
}

/* ------------------------------------------------------------ visibility */

/**
 * The single rule for who may see a recommendation, expressed once so every
 * feed, search, and profile page agrees.
 *
 *  - your own, always
 *  - `connections`, if the author is a connection of yours
 *  - `groups`, if it was shared into a group you belong to
 *  - `link`, only through a share link — never in a feed, so a link-shared
 *    entry does not quietly become browsable
 *  - `private`, never
 *
 * `r` is the alias the caller uses for the recommendations table.
 */
export function visibilityCondition(
  viewerId: string | null,
  connectionIds: string[],
  groupIds: string[],
  alias = "r",
): SQL {
  const r = sql.raw(alias);

  if (!viewerId) {
    // Signed-out visitors see nothing in feeds. Share links have their own path.
    return sql`false`;
  }

  const clauses: SQL[] = [sql`${r}.recommender_user_id = ${viewerId}::uuid`];

  if (connectionIds.length) {
    clauses.push(sql`(
      ${r}.visibility = 'connections'
      AND ${r}.recommender_user_id IN (${sql.join(
        connectionIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
    )`);
  }

  if (groupIds.length) {
    clauses.push(sql`(
      ${r}.visibility = 'groups'
      AND EXISTS (
        SELECT 1 FROM recommendation_groups rg
        WHERE rg.recommendation_id = ${r}.id
          AND rg.group_id IN (${sql.join(
            groupIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})
      )
    )`);
  }

  return sql`(${sql.join(clauses, sql` OR `)})`;
}

/** Convenience wrapper that loads the viewer's circles first. */
export async function viewerScope(viewerId: string | null) {
  if (!viewerId) {
    return { connectionIds: [] as string[], groupIds: [] as string[] };
  }
  const [connectionIds, groupIds] = await Promise.all([
    getConnectionIds(viewerId),
    getGroupIds(viewerId),
  ]);
  return { connectionIds, groupIds };
}
