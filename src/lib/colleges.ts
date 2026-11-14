import "server-only";

import { cache } from "react";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { colleges, groupMembers, groups, users } from "@/db/schema";
import { uniqueSlug } from "@/lib/slug";

export async function searchColleges(query: string, limit = 12) {
  const q = query.trim();
  const base = db
    .select({
      id: colleges.id,
      slug: colleges.slug,
      name: colleges.name,
      city: colleges.city,
      state: colleges.state,
      domain: colleges.domain,
    })
    .from(colleges);

  if (!q) return base.orderBy(asc(colleges.name)).limit(limit);

  const like = `%${q}%`;
  return base
    .where(
      or(
        ilike(colleges.name, like),
        ilike(colleges.city, like),
        ilike(colleges.domain, like),
        ilike(colleges.state, like),
      ),
    )
    .orderBy(asc(colleges.name))
    .limit(limit);
}

export const getCollegeById = cache(async (id: string) => {
  const [row] = await db.select().from(colleges).where(eq(colleges.id, id)).limit(1);
  return row ?? null;
});

/** What the signed-in user has said and proved about their college. */
export const getUserCollegeState = cache(async (userId: string) => {
  const [row] = await db
    .select({
      collegeId: users.collegeId,
      eduEmail: users.eduEmail,
      eduVerifiedAt: users.eduVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.collegeId) {
    return { college: null, verified: false, eduEmail: null as string | null };
  }

  const college = await getCollegeById(row.collegeId);
  return {
    college,
    verified: Boolean(row.eduVerifiedAt) && Boolean(college),
    eduEmail: row.eduEmail,
  };
});

/**
 * Whether this person is a verified member of this college's community. This is
 * the one check the help board and its responses sit behind.
 */
export async function isVerifiedMember(userId: string, collegeId: string) {
  const state = await getUserCollegeState(userId);
  return state.verified && state.college?.id === collegeId;
}

/** The community group for a college, created the first time anyone needs it. */
export async function ensureCollegeGroup(collegeId: string, creatorUserId: string) {
  const [existing] = await db
    .select({ id: groups.id, slug: groups.slug })
    .from(groups)
    .where(eq(groups.collegeId, collegeId))
    .limit(1);
  if (existing) return existing;

  const college = await getCollegeById(collegeId);
  if (!college) throw new Error("College not found.");

  const [created] = await db
    .insert(groups)
    .values({
      slug: uniqueSlug(`${college.name} community`),
      name: `${college.name} community`,
      kind: "school",
      description: `Students and recent graduates of ${college.name}. Verified with a college email address.`,
      city: college.city,
      state: college.state,
      joinPolicy: "link",
      inviteToken: randomBytes(9).toString("base64url"),
      createdByUserId: creatorUserId,
      collegeId: college.id,
      welcomeMessage:
        "Welcome. Add the people who helped you settle in — the grocery, the mechanic, the landlord worth trusting — so the next newcomer does not start from zero.",
    })
    .returning({ id: groups.id, slug: groups.slug });

  return created;
}

export async function addToCollegeGroup(collegeId: string, userId: string) {
  const group = await ensureCollegeGroup(collegeId, userId);
  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId, role: "member" })
    .onConflictDoNothing();
  return group;
}

export async function getCollegeGroup(collegeId: string) {
  const [row] = await db
    .select({ id: groups.id, slug: groups.slug, name: groups.name })
    .from(groups)
    .where(eq(groups.collegeId, collegeId))
    .limit(1);
  return row ?? null;
}

export async function countCollegeMembers(collegeId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.collegeId, collegeId), sql`${users.eduVerifiedAt} IS NOT NULL`));
  return Number(row?.n ?? 0);
}
