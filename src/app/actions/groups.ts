"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { lookupZip } from "@/lib/geo";
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
    .select({ id: groups.id, slug: groups.slug })
    .from(groups)
    .where(eq(groups.inviteToken, token))
    .limit(1);
  if (!group) return;

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
