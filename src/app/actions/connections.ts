"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { connections, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { connectionRequestEmail, sendEmail } from "@/lib/email";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { getSecondDegreeIds } from "@/lib/social";
import { emailSchema, zodToState, type ActionState } from "@/lib/validation";
import { z } from "zod";

const inviteSchema = z.object({ email: emailSchema });

/** Shared by both entry points: email lookup and name-search results alike. */
async function createConnectionRequest(
  userId: string,
  userName: string,
  target: { id: string; name: string; email: string },
): Promise<ActionState> {
  if (target.id === userId) {
    return { ok: false, message: "That is you." };
  }

  const existing = await db
    .select({ id: connections.id, status: connections.status })
    .from(connections)
    .where(
      or(
        and(eq(connections.requesterId, userId), eq(connections.addresseeId, target.id)),
        and(eq(connections.requesterId, target.id), eq(connections.addresseeId, userId)),
      ),
    )
    .limit(1);

  if (existing.length) {
    const status = existing[0].status;
    return {
      ok: false,
      message:
        status === "accepted"
          ? "You are already connected."
          : status === "pending"
            ? "There is already a request open between you."
            : "That connection is blocked.",
    };
  }

  await db.insert(connections).values({
    requesterId: userId,
    addresseeId: target.id,
    status: "pending",
  });

  await sendEmail(connectionRequestEmail(target.email, userName));

  revalidatePath("/people");
  return { ok: true, message: `Request sent to ${target.name}.` };
}

/**
 * By email. This is the only way to reach someone outside your extended
 * network — deliberately no directory search across every user on the app, so
 * nobody can be found just because they signed up.
 */
export async function sendConnectionRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const limit = await rateLimit("connection", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return zodToState(parsed.error);

  if (parsed.data.email === user.email) {
    return { ok: false, message: "That is your own address." };
  }

  const [target] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!target) {
    return {
      ok: false,
      fieldErrors: {
        email: ["Nobody with that email yet. Ask them to sign up first."],
      },
    };
  }

  return createConnectionRequest(user.id, user.name, target);
}

/**
 * By user id, from a name-search result. Only reachable through
 * `searchSecondDegreeByName`, which already restricts candidates to friends of
 * friends — this action re-checks that server-side rather than trusting the
 * id came from that search, since form data is never trustworthy on its own.
 */
export async function sendConnectionRequestToUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const limit = await rateLimit("connection", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const targetId = String(formData.get("userId") ?? "");
  const secondDegree = await getSecondDegreeIds(user.id);
  if (!secondDegree.includes(targetId)) {
    return { ok: false, message: "That person is not in your extended network." };
  }

  const [target] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!target) return { ok: false, message: "That account no longer exists." };

  return createConnectionRequest(user.id, user.name, target);
}

export async function respondToConnectionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const connectionId = String(formData.get("connectionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!["accepted", "declined"].includes(decision)) return;

  // Only the person who was asked may answer.
  const [row] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(
        eq(connections.id, connectionId),
        eq(connections.addresseeId, user.id),
        eq(connections.status, "pending"),
      ),
    )
    .limit(1);
  if (!row) return;

  if (decision === "declined") {
    await db.delete(connections).where(eq(connections.id, connectionId));
  } else {
    await db
      .update(connections)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(connections.id, connectionId));
  }

  revalidatePath("/people");
  revalidatePath("/discover");
}

export async function removeConnectionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const connectionId = String(formData.get("connectionId") ?? "");

  // Either side can walk away.
  await db
    .delete(connections)
    .where(
      and(
        eq(connections.id, connectionId),
        or(
          eq(connections.requesterId, user.id),
          eq(connections.addresseeId, user.id),
        ),
      ),
    );

  revalidatePath("/people");
  revalidatePath("/discover");
}

export async function cancelConnectionRequestAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const connectionId = String(formData.get("connectionId") ?? "");
  await db
    .delete(connections)
    .where(
      and(
        eq(connections.id, connectionId),
        eq(connections.requesterId, user.id),
        eq(connections.status, "pending"),
      ),
    );

  revalidatePath("/people");
}
