import "server-only";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { getCurrentUser, getMemberships, type Membership } from "@/lib/auth";

export async function requireUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(next: string) {
  const user = await requireUser(next);
  if (user.role !== "admin") redirect("/");
  return user;
}

/**
 * Every dashboard page runs through here: signed in, and attached to at least
 * one provider account. Anyone else lands on onboarding.
 */
export async function requireProvider(next: string) {
  const user = await requireUser(next);
  const memberships = await getMemberships(user.id);
  if (!memberships.length) redirect("/dashboard/onboarding");

  const membership: Membership = memberships[0];
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, membership.providerId))
    .limit(1);

  return { user, membership, provider };
}
