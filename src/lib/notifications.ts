import "server-only";

import { cache } from "react";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { getOrigin } from "@/lib/site";

/**
 * In-app notifications.
 *
 * Email needs a provider key before it reaches anyone; this does not, so a
 * request, an answer or an accepted pickup is never just silently waiting
 * somewhere. Writing one must never fail the action that caused it, so errors
 * are swallowed.
 */
export type NewNotification = {
  kind: string;
  title: string;
  body?: string | null;
  /** Same-site path the notification opens. */
  href?: string | null;
};

export async function notify(
  userId: string,
  n: NewNotification,
  opts: { email?: boolean } = {},
) {
  try {
    await db.insert(notifications).values({
      userId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      href: n.href && n.href.startsWith("/") ? n.href : null,
    });

    // Email is the same message, for the moments that cannot wait for someone to
    // open the app. Without a provider key it is logged instead of sent.
    if (opts.email) {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user) {
        const link = n.href?.startsWith("/") ? `\n\nOpen it: ${await getOrigin()}${n.href}` : "";
        await sendEmail({
          to: user.email,
          subject: n.title,
          text: `${n.body ? `${n.body}\n` : ""}${link}`.trim() || n.title,
        });
      }
    }
  } catch (error) {
    console.error("[notify:failed]", error);
  }
}

export async function notifyMany(
  userIds: string[],
  n: NewNotification,
  opts: { email?: boolean } = {},
) {
  await Promise.all(userIds.map((id) => notify(id, n, opts)));
}

export const getUnreadCount = cache(async (userId: string): Promise<number> => {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(row?.n ?? 0);
});

export async function getNotifications(userId: string, limit = 60) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
