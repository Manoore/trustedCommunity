"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerMembers, providers, users } from "@/db/schema";
import { assertProviderAccess, getCurrentUser, getMemberships } from "@/lib/auth";
import { lookupZip } from "@/lib/geo";
import { uniqueSlug } from "@/lib/slug";
import {
  providerOnboardingSchema,
  teamInviteSchema,
  zodToState,
  type ActionState,
} from "@/lib/validation";

function readProviderForm(formData: FormData) {
  return {
    type: formData.get("type"),
    displayName: formData.get("displayName"),
    legalName: formData.get("legalName") ?? "",
    headline: formData.get("headline") ?? "",
    bio: formData.get("bio"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    zip: formData.get("zip"),
    yearsExperience: formData.get("yearsExperience") || undefined,
  };
}

export async function createProviderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/onboarding");

  const parsed = providerOnboardingSchema.safeParse(readProviderForm(formData));
  if (!parsed.success) return zodToState(parsed.error);

  const existing = await getMemberships(user.id);
  if (existing.length) {
    return {
      ok: false,
      message: "You already have a provider account. Edit it from the dashboard.",
    };
  }

  const geo = lookupZip(parsed.data.zip);
  if (!geo) {
    return { ok: false, fieldErrors: { zip: ["We do not recognise that ZIP code."] } };
  }

  const [provider] = await db
    .insert(providers)
    .values({
      type: parsed.data.type,
      slug: uniqueSlug(parsed.data.displayName),
      displayName: parsed.data.displayName,
      legalName: parsed.data.legalName || null,
      headline: parsed.data.headline || null,
      bio: parsed.data.bio,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone || null,
      websiteUrl: parsed.data.websiteUrl || null,
      city: geo.city,
      state: geo.state,
      zip: geo.zip,
      lat: geo.lat,
      lng: geo.lng,
      yearsExperience: parsed.data.yearsExperience ?? null,
      status: "active",
    })
    .returning({ id: providers.id });

  await db.insert(providerMembers).values({
    providerId: provider.id,
    userId: user.id,
    role: "owner",
  });

  revalidatePath("/dashboard");
  redirect("/dashboard/listings/new");
}

export async function updateProviderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const providerId = String(formData.get("providerId") ?? "");
  try {
    await assertProviderAccess(user.id, providerId, ["owner", "manager"]);
  } catch {
    return { ok: false, message: "You cannot edit this provider account." };
  }

  const parsed = providerOnboardingSchema.safeParse(readProviderForm(formData));
  if (!parsed.success) return zodToState(parsed.error);

  const geo = lookupZip(parsed.data.zip);
  if (!geo) {
    return { ok: false, fieldErrors: { zip: ["We do not recognise that ZIP code."] } };
  }

  await db
    .update(providers)
    .set({
      type: parsed.data.type,
      displayName: parsed.data.displayName,
      legalName: parsed.data.legalName || null,
      headline: parsed.data.headline || null,
      bio: parsed.data.bio,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone || null,
      websiteUrl: parsed.data.websiteUrl || null,
      city: geo.city,
      state: geo.state,
      zip: geo.zip,
      lat: geo.lat,
      lng: geo.lng,
      yearsExperience: parsed.data.yearsExperience ?? null,
      updatedAt: new Date(),
    })
    .where(eq(providers.id, providerId));

  revalidatePath("/dashboard/profile");
  return { ok: true, message: "Profile saved." };
}

/**
 * Team seats are the practical difference between an individual and an entity:
 * an entity can hand the inbox to staff without sharing one login.
 */
export async function addTeamMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const providerId = String(formData.get("providerId") ?? "");
  try {
    await assertProviderAccess(user.id, providerId, ["owner"]);
  } catch {
    return { ok: false, message: "Only the owner can manage the team." };
  }

  const parsed = teamInviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return zodToState(parsed.error);

  const [provider] = await db
    .select({ type: providers.type })
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);

  if (provider?.type !== "entity") {
    return {
      ok: false,
      message: "Team seats are available on business accounts. Switch your account type first.",
    };
  }

  const [invitee] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!invitee) {
    return {
      ok: false,
      fieldErrors: {
        email: ["No account with that email yet. Ask them to sign up first."],
      },
    };
  }

  const already = await db
    .select({ id: providerMembers.id })
    .from(providerMembers)
    .where(
      and(
        eq(providerMembers.providerId, providerId),
        eq(providerMembers.userId, invitee.id),
      ),
    )
    .limit(1);

  if (already.length) return { ok: false, message: "They are already on the team." };

  await db.insert(providerMembers).values({
    providerId,
    userId: invitee.id,
    role: parsed.data.role,
  });

  revalidatePath("/dashboard/team");
  return { ok: true, message: "Team member added." };
}

export async function removeTeamMemberAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const providerId = String(formData.get("providerId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");

  try {
    await assertProviderAccess(user.id, providerId, ["owner"]);
  } catch {
    return;
  }

  const [member] = await db
    .select({ role: providerMembers.role })
    .from(providerMembers)
    .where(eq(providerMembers.id, memberId))
    .limit(1);

  // Never strip the last owner - that would orphan the account.
  if (member?.role === "owner") return;

  await db.delete(providerMembers).where(eq(providerMembers.id, memberId));
  revalidatePath("/dashboard/team");
}
