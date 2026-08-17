import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { providerMembers, providers, sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "classifieds_session";
const SESSION_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/**
 * The cookie carries the raw token; only its SHA-256 lives in the database, so
 * a leaked table dump cannot be replayed as a live session.
 */
function tokenId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ id: tokenId(token), userId, expiresAt });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, tokenId(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "user" | "admin";
};

/**
 * Memoized for the lifetime of one request, so a page that checks auth in the
 * layout, the header, and the page body still hits the database once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, tokenId(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return rows[0] ?? null;
});

export type Membership = {
  providerId: string;
  role: "owner" | "manager" | "staff";
  providerSlug: string;
  providerName: string;
  providerStatus: "draft" | "active" | "suspended";
  providerType: "individual" | "entity";
};

/** Every provider this user can act on behalf of. Empty for pure buyers. */
export const getMemberships = cache(
  async (userId: string): Promise<Membership[]> => {
    return db
      .select({
        providerId: providerMembers.providerId,
        role: providerMembers.role,
        providerSlug: providers.slug,
        providerName: providers.displayName,
        providerStatus: providers.status,
        providerType: providers.type,
      })
      .from(providerMembers)
      .innerJoin(providers, eq(providers.id, providerMembers.providerId))
      .where(eq(providerMembers.userId, userId));
  },
);

export async function getActiveMembership(userId: string) {
  const memberships = await getMemberships(userId);
  return memberships[0] ?? null;
}

/** Throws when the caller is not a member of the provider. */
export async function assertProviderAccess(
  userId: string,
  providerId: string,
  allowed: Array<"owner" | "manager" | "staff"> = ["owner", "manager", "staff"],
) {
  const memberships = await getMemberships(userId);
  const found = memberships.find((m) => m.providerId === providerId);
  if (!found || !allowed.includes(found.role)) {
    throw new Error("You do not have access to this provider account.");
  }
  return found;
}

export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin";
}
