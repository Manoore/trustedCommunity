"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  groupMembers,
  groupPins,
  groups,
  providers,
  recommendationGroups,
  recommendations,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { lookupZip } from "@/lib/geo";
import { notify } from "@/lib/notifications";
import { uniqueSlug } from "@/lib/slug";
import { zodToState, type ActionState } from "@/lib/validation";

const groupSchema = z.object({
  name: z.string().trim().min(2, "Give the group a name.").max(80),
  kind: z.enum([
    "temple",
    "church",
    "neighborhood",
    "social",
    "school",
    "workplace",
    "other",
  ]),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  zip: z.string().trim().optional().or(z.literal("")),
});

/**
 * Groups are self-serve on purpose. The communities worth reaching — a temple
 * with 300 families, a street, a school parent circle — have no administrator
 * and no budget, so creating one is a form and an invite link, nothing more.
 */
export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/groups");

  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    description: formData.get("description") ?? "",
    zip: formData.get("zip") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);

  const geo = parsed.data.zip ? lookupZip(parsed.data.zip) : null;
  if (parsed.data.zip && !geo) {
    return { ok: false, fieldErrors: { zip: ["We do not recognise that ZIP code."] } };
  }

  const [group] = await db
    .insert(groups)
    .values({
      slug: uniqueSlug(parsed.data.name),
      name: parsed.data.name,
      kind: parsed.data.kind,
      description: parsed.data.description || null,
      city: geo?.city ?? null,
      state: geo?.state ?? null,
      joinPolicy: "link",
      inviteToken: randomBytes(9).toString("base64url"),
      createdByUserId: user.id,
    })
    .returning({ id: groups.id, slug: groups.slug });

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: user.id,
    role: "owner",
  });

  revalidatePath("/groups");
  redirect(`/groups/${group.slug}`);
}

/** Joining by invite link. The token is the only credential needed. */
export async function joinGroupAction(formData: FormData) {
  const user = await getCurrentUser();
  const token = String(formData.get("token") ?? "");
  if (!user) redirect(`/login?next=/join/${token}`);

  const [group] = await db
    .select({ id: groups.id, slug: groups.slug, memberLimit: groups.memberLimit })
    .from(groups)
    .where(eq(groups.inviteToken, token))
    .limit(1);
  if (!group) return;

  // A small, close-knit group can stay small. Existing members are never
  // blocked from "joining" again; only a new person is turned away at the cap.
  if (group.memberLimit) {
    const [already] = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)))
      .limit(1);

    if (!already) {
      const [{ n }] = (await db.execute(sql`
        SELECT count(*)::int AS n FROM group_members WHERE group_id = ${group.id}::uuid
      `)) as unknown as Array<{ n: number }>;
      if (Number(n) >= group.memberLimit) redirect(`/join/${token}?full=1`);
    }
  }

  await db
    .insert(groupMembers)
    .values({ groupId: group.id, userId: user.id, role: "member" })
    .onConflictDoNothing();

  revalidatePath("/groups");
  redirect(`/groups/${group.slug}`);
}

export async function leaveGroupAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const groupId = String(formData.get("groupId") ?? "");

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    )
    .limit(1);
  if (!membership) return;

  if (membership.role === "owner") {
    const [{ owners }] = (await db.execute(sql`
      SELECT count(*)::int AS owners FROM group_members
      WHERE group_id = ${groupId}::uuid AND role = 'owner'
    `)) as unknown as Array<{ owners: number }>;
    // Never leave a group ownerless.
    if (Number(owners) <= 1) return;
  }

  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    );

  revalidatePath("/groups");
}

/** The caller's role in a group, or null when they are not a member. */
async function managerRole(userId: string, groupId: string) {
  const [m] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return m?.role === "owner" || m?.role === "admin" ? m.role : null;
}

const settingsSchema = z.object({
  groupId: z.string().uuid(),
  welcomeMessage: z.string().trim().max(500, "Keep it under 500 characters.").optional().or(z.literal("")),
  memberLimit: z
    .string()
    .trim()
    .regex(/^\d*$/, "Use a whole number, or leave it blank for no limit.")
    .optional()
    .or(z.literal("")),
});

export async function updateGroupSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const parsed = settingsSchema.safeParse({
    groupId: formData.get("groupId"),
    welcomeMessage: formData.get("welcomeMessage") ?? "",
    memberLimit: formData.get("memberLimit") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);

  if (!(await managerRole(user.id, parsed.data.groupId))) {
    return { ok: false, message: "Only an owner or admin can change this." };
  }

  const limit = parsed.data.memberLimit ? Number(parsed.data.memberLimit) : null;
  if (limit !== null && (limit < 2 || limit > 5000)) {
    return { ok: false, fieldErrors: { memberLimit: ["Choose between 2 and 5000."] } };
  }

  // Never cap a group below the number of people already in it.
  if (limit !== null) {
    const [{ n }] = (await db.execute(sql`
      SELECT count(*)::int AS n FROM group_members WHERE group_id = ${parsed.data.groupId}::uuid
    `)) as unknown as Array<{ n: number }>;
    if (limit < Number(n)) {
      return {
        ok: false,
        fieldErrors: { memberLimit: [`There are already ${n} members, so the limit cannot be lower.`] },
      };
    }
  }

  await db
    .update(groups)
    .set({ welcomeMessage: parsed.data.welcomeMessage || null, memberLimit: limit })
    .where(eq(groups.id, parsed.data.groupId));

  revalidatePath("/groups");
  return { ok: true, message: "Saved." };
}

/** Pins a contact to the top of the group's page as a starter list. */
export async function pinContactAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const groupId = String(formData.get("groupId") ?? "");
  const providerId = String(formData.get("providerId") ?? "");
  if (!(await managerRole(user.id, groupId))) return;

  const [provider] = await db
    .select({ id: providers.id })
    .from(providers)
    .where(and(eq(providers.id, providerId), isNull(providers.hiddenAt)))
    .limit(1);
  if (!provider) return;

  await db
    .insert(groupPins)
    .values({ groupId, providerId, pinnedByUserId: user.id })
    .onConflictDoNothing();

  revalidatePath("/groups");
}

export async function unpinContactAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const groupId = String(formData.get("groupId") ?? "");
  const providerId = String(formData.get("providerId") ?? "");
  if (!(await managerRole(user.id, groupId))) return;

  await db
    .delete(groupPins)
    .where(and(eq(groupPins.groupId, groupId), eq(groupPins.providerId, providerId)));

  revalidatePath("/groups");
}

/**
 * Takes one entry out of the group. It removes the sharing, not the person's
 * recommendation: it stays on their own list, just no longer shown here. The
 * author is told, so removal is never silent.
 */
export async function removeEntryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const groupId = String(formData.get("groupId") ?? "");
  const recommendationId = String(formData.get("recommendationId") ?? "");
  if (!(await managerRole(user.id, groupId))) return;

  await db
    .delete(recommendationGroups)
    .where(
      and(
        eq(recommendationGroups.groupId, groupId),
        eq(recommendationGroups.recommendationId, recommendationId),
      ),
    );

  // If that was its last group, it should not sit half-shared.
  const [left] = await db
    .select({ id: recommendationGroups.id })
    .from(recommendationGroups)
    .where(eq(recommendationGroups.recommendationId, recommendationId))
    .limit(1);

  const [rec] = await db
    .update(recommendations)
    .set(left ? {} : { visibility: "private", updatedAt: new Date() })
    .where(eq(recommendations.id, recommendationId))
    .returning({ authorId: recommendations.recommenderUserId });

  const [group] = await db
    .select({ name: groups.name })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (rec && group) {
    await notify(rec.authorId, {
      kind: "group_entry_removed",
      title: `An entry of yours was taken out of ${group.name}`,
      body: "It is still on your own list. You can share it again from there.",
      href: "/list",
    });
  }

  revalidatePath("/groups");
}

export async function removeMemberAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const groupId = String(formData.get("groupId") ?? "");
  const memberUserId = String(formData.get("userId") ?? "");
  if (!(await managerRole(user.id, groupId))) return;
  if (memberUserId === user.id) return;

  const [target] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberUserId)))
    .limit(1);
  // An owner cannot be removed by anyone else.
  if (!target || target.role === "owner") return;

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberUserId)));

  // Whatever they shared into the group stops being shown there with them.
  await db.execute(sql`
    DELETE FROM recommendation_groups rg
    USING recommendations r
    WHERE rg.recommendation_id = r.id
      AND rg.group_id = ${groupId}::uuid
      AND r.recommender_user_id = ${memberUserId}::uuid
  `);

  revalidatePath("/groups");
}

export async function rotateInviteTokenAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const groupId = String(formData.get("groupId") ?? "");

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
    )
    .limit(1);
  if (membership?.role !== "owner" && membership?.role !== "admin") return;

  await db
    .update(groups)
    .set({ inviteToken: randomBytes(9).toString("base64url") })
    .where(eq(groups.id, groupId));

  revalidatePath("/groups");
}
