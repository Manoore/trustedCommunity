"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { askResponses, askTargets, asks, recommendations, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { PHONE_REQUIRED_MESSAGE, phoneGateBlocks } from "@/lib/phone-gate";
import { askAnsweredEmail, askBroadcastEmail, sendEmail } from "@/lib/email";
import { notify, notifyMany } from "@/lib/notifications";
import { getAsk, getAskRecipients, getIncomingAsks } from "@/lib/asks";
import { lookupZip } from "@/lib/geo";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { getGroupIds } from "@/lib/social";
import { zodToState, type ActionState } from "@/lib/validation";

const askSchema = z.object({
  title: z.string().trim().min(6, "What do you need? A sentence is enough.").max(160),
  body: z.string().trim().max(2000).optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  zip: z.string().trim().optional().or(z.literal("")),
});

/**
 * An ask is a broadcast to chosen circles, not a public post. It reaches your
 * connections and the groups you picked, and nobody else.
 */
export async function createAskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/asks/new");
  if (await phoneGateBlocks(user.id)) return { ok: false, message: PHONE_REQUIRED_MESSAGE };

  const limit = await rateLimit("ask", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = askSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    zip: formData.get("zip") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);

  const toConnections = formData.get("toConnections") === "on";
  const chosenGroups = formData.getAll("groupIds").map(String).filter(Boolean);
  const myGroups = await getGroupIds(user.id);
  const groupIds = chosenGroups.filter((id) => myGroups.includes(id));

  if (!toConnections && !groupIds.length) {
    return {
      ok: false,
      message: "Pick who to ask — your connections, a group, or both.",
    };
  }

  const geo = parsed.data.zip ? lookupZip(parsed.data.zip) : null;
  if (parsed.data.zip && !geo) {
    return { ok: false, fieldErrors: { zip: ["We do not recognise that ZIP code."] } };
  }

  const [ask] = await db
    .insert(asks)
    .values({
      userId: user.id,
      categoryId: parsed.data.categoryId || null,
      title: parsed.data.title,
      body: parsed.data.body || null,
      zip: geo?.zip ?? null,
      city: geo?.city ?? null,
      state: geo?.state ?? null,
    })
    .returning({ id: asks.id });

  const targets = [
    ...(toConnections
      ? [{ askId: ask.id, audience: "connections" as const, groupId: null }]
      : []),
    ...groupIds.map((groupId) => ({
      askId: ask.id,
      audience: "group" as const,
      groupId,
    })),
  ];
  await db.insert(askTargets).values(targets);

  // Notifications are best-effort; a failed send must not lose the ask.
  const recipients = await getAskRecipients(ask.id);
  await Promise.all(
    recipients.map((r) =>
      sendEmail(askBroadcastEmail(r.email, user.name, parsed.data.title, ask.id)),
    ),
  );
  await notifyMany(
    recipients.map((r) => r.id),
    {
      kind: "ask",
      title: `${user.name} is asking: ${parsed.data.title}`,
      body: "If you know someone good, you can pass on their details.",
      href: `/asks/${ask.id}`,
    },
  );

  revalidatePath("/asks");
  redirect(`/asks/${ask.id}`);
}

/**
 * Answering with one of your own recommendations, so an answer is always a real
 * vouch rather than a name typed into a box.
 */
export async function answerAskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const askId = String(formData.get("askId") ?? "");
  const recommendationId = String(formData.get("recommendationId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!recommendationId) {
    return { ok: false, message: "Pick someone from your list." };
  }

  // The ask has to be one addressed to this person.
  const incoming = await getIncomingAsks(user.id);
  if (!incoming.some((a) => a.id === askId)) {
    return { ok: false, message: "That request is not open to you." };
  }

  const [rec] = await db
    .select({ providerId: recommendations.providerId })
    .from(recommendations)
    .where(
      and(
        eq(recommendations.id, recommendationId),
        eq(recommendations.recommenderUserId, user.id),
      ),
    )
    .limit(1);

  if (!rec) return { ok: false, message: "That is not one of your recommendations." };

  await db
    .insert(askResponses)
    .values({
      askId,
      responderUserId: user.id,
      providerId: rec.providerId,
      note: note || null,
    })
    .onConflictDoNothing();

  const ask = await getAsk(askId, user.id);
  if (ask) {
    const [author] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, ask.ask.userId))
      .limit(1);

    const contactName =
      ask.responses.find((r) => r.responderName === user.name)?.providerName ??
      "someone";

    if (author) {
      await sendEmail(
        askAnsweredEmail(author.email, user.name, contactName, askId),
      );
    }
    await notify(ask.ask.userId, {
      kind: "ask_answer",
      title: `${user.name} suggested ${contactName}`,
      body: `An answer to: ${ask.ask.title}`,
      href: `/asks/${askId}`,
    });
  }

  revalidatePath(`/asks/${askId}`);
  return { ok: true, message: "Answer sent." };
}

/**
 * Closing the loop: the asker says which answer they actually hired.
 *
 * This is the only signal in the product that something worked out, so it is
 * the asker's call alone, and the person whose recommendation was used is told
 * - a thank-you that costs nothing and makes people keep answering.
 */
export async function markHiredAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const responseId = String(formData.get("responseId") ?? "");

  const [row] = await db
    .select({
      responseId: askResponses.id,
      responderId: askResponses.responderUserId,
      providerId: askResponses.providerId,
      askId: askResponses.askId,
      askOwnerId: asks.userId,
      askTitle: asks.title,
    })
    .from(askResponses)
    .innerJoin(asks, eq(asks.id, askResponses.askId))
    .where(eq(askResponses.id, responseId))
    .limit(1);

  // Only the person who asked can say who they hired.
  if (!row || row.askOwnerId !== user.id) return;

  await db
    .update(askResponses)
    .set({ hiredAt: new Date() })
    .where(eq(askResponses.id, row.responseId));

  await notify(
    row.responderId,
    {
      kind: "ask_hired",
      title: `${user.name} hired your recommendation`,
      body: `Your answer to “${row.askTitle}” worked out. Thank you for passing the name on.`,
      href: `/asks/${row.askId}`,
    },
    { email: true },
  );

  revalidatePath(`/asks/${row.askId}`);
  revalidatePath("/list");
}

export async function closeAskAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const askId = String(formData.get("askId") ?? "");
  await db
    .update(asks)
    .set({ status: "closed", closedAt: new Date() })
    .where(and(eq(asks.id, askId), eq(asks.userId, user.id)));

  revalidatePath("/asks");
  revalidatePath(`/asks/${askId}`);
}
