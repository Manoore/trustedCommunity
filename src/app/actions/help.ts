"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { helpPosts, helpResponses } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getUserCollegeState, isVerifiedMember } from "@/lib/colleges";
import { FAIR_HOUSING_MESSAGE, findProtectedPreference } from "@/lib/fair-housing";
import { ACCOMMODATION_KINDS, KIND_LABELS } from "@/lib/help";
import { notify, notifyMany } from "@/lib/notifications";
import { normalizePhone } from "@/lib/phone";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { zodToState, type ActionState } from "@/lib/validation";

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .optional()
  .or(z.literal(""));

const postSchema = z
  .object({
    direction: z.enum(["offer", "need"]),
    kind: z.enum(["pickup", "temp_stay", "room", "item"]),
    title: z.string().trim().min(6, "Give it a clear title.").max(140),
    details: z.string().trim().max(2000).optional().or(z.literal("")),
    area: z.string().trim().max(120).optional().or(z.literal("")),
    startsOn: dateField,
    endsOn: dateField,
    capacity: z.coerce.number().int().min(1).max(10).default(1),
    contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "pickup" && !val.startsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startsOn"],
        message: "When? A pickup needs a date.",
      });
    }
    if (val.startsOn && val.endsOn && val.endsOn < val.startsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsOn"],
        message: "The end date is before the start date.",
      });
    }
  });

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Everything on the help board sits behind a verified student address. */
async function requireVerifiedStudent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/help");
  const state = await getUserCollegeState(user.id);
  if (!state.college || !state.verified) redirect("/arrive");
  return { user, college: state.college };
}

export async function createHelpPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, college } = await requireVerifiedStudent();

  const limit = await rateLimit("help", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = postSchema.safeParse({
    direction: formData.get("direction"),
    kind: formData.get("kind"),
    title: formData.get("title"),
    details: formData.get("details") ?? "",
    area: formData.get("area") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
    capacity: formData.get("capacity") || 1,
    contactPhone: formData.get("contactPhone") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);
  const data = parsed.data;

  if (data.startsOn && data.startsOn < today()) {
    return { ok: false, fieldErrors: { startsOn: ["That date has already passed."] } };
  }

  if (ACCOMMODATION_KINDS.includes(data.kind)) {
    const phrase = findProtectedPreference(data.title, data.details, data.area);
    if (phrase) {
      return {
        ok: false,
        message: `“${phrase}” — ${FAIR_HOUSING_MESSAGE}`,
        fieldErrors: { details: ["Remove the preference above."] },
      };
    }
  }

  let phone: string | null = null;
  if (data.contactPhone) {
    const normalised = normalizePhone(data.contactPhone);
    if (!normalised) {
      return {
        ok: false,
        fieldErrors: {
          contactPhone: ["Enter a valid number. For a non-US number, start with + and the country code."],
        },
      };
    }
    phone = normalised.display;
  }

  const [post] = await db
    .insert(helpPosts)
    .values({
      userId: user.id,
      collegeId: college.id,
      direction: data.direction,
      kind: data.kind,
      title: data.title,
      details: data.details || null,
      area: data.area || null,
      startsOn: data.startsOn || null,
      endsOn: data.endsOn || null,
      capacity: data.direction === "offer" ? data.capacity : 1,
      contactPhone: phone,
    })
    .returning({ id: helpPosts.id });

  // Matching: an arrival need reaches the seniors who offered the same kind of
  // help, and a new offer reaches the newcomers still waiting for it. In-app
  // only - this should be useful, not a blast.
  const opposite = data.direction === "need" ? "offer" : "need";
  const matches = (await db.execute(sql`
    SELECT DISTINCT user_id FROM help_posts
    WHERE college_id = ${college.id}::uuid
      AND status = 'open' AND direction = ${opposite} AND kind = ${data.kind}
      AND user_id <> ${user.id}::uuid
    LIMIT 25
  `)) as unknown as Array<{ user_id: string }>;

  await notifyMany(
    matches.map((m) => m.user_id),
    {
      kind: "help_match",
      title:
        data.direction === "need"
          ? `A newcomer needs: ${KIND_LABELS[data.kind].toLowerCase()}`
          : `Someone is offering: ${KIND_LABELS[data.kind].toLowerCase()}`,
      body: data.title,
      href: `/help/${post.id}`,
    },
  );

  revalidatePath("/help");
  redirect(`/help/${post.id}?posted=1`);
}

const respondSchema = z.object({
  postId: z.string().uuid(),
  message: z
    .string()
    .trim()
    .min(10, "Say a little — a sentence is enough.")
    .max(1000),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function respondToPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireVerifiedStudent();

  const limit = await rateLimit("help", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = respondSchema.safeParse({
    postId: formData.get("postId"),
    message: formData.get("message"),
    contactPhone: formData.get("contactPhone") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);

  const [post] = await db
    .select()
    .from(helpPosts)
    .where(eq(helpPosts.id, parsed.data.postId))
    .limit(1);

  if (!post || post.status !== "open") {
    return { ok: false, message: "That post is no longer open." };
  }
  if (!(await isVerifiedMember(user.id, post.collegeId))) {
    return { ok: false, message: "This post belongs to another college's community." };
  }
  if (post.userId === user.id) {
    return { ok: false, message: "That is your own post." };
  }

  const [{ taken }] = (await db.execute(sql`
    SELECT count(*)::int AS taken FROM help_responses
    WHERE post_id = ${post.id}::uuid AND status IN ('accepted', 'completed')
  `)) as unknown as Array<{ taken: number }>;
  if (Number(taken) >= post.capacity) {
    return { ok: false, message: "This one is already full." };
  }

  let phone: string | null = null;
  if (parsed.data.contactPhone) {
    const normalised = normalizePhone(parsed.data.contactPhone);
    if (!normalised) {
      return {
        ok: false,
        fieldErrors: {
          contactPhone: ["Enter a valid number. For a non-US number, start with + and the country code."],
        },
      };
    }
    phone = normalised.display;
  }

  try {
    await db.insert(helpResponses).values({
      postId: post.id,
      responderUserId: user.id,
      message: parsed.data.message,
      contactPhone: phone,
    });
  } catch {
    return { ok: false, message: "You already responded to this." };
  }

  await notify(
    post.userId,
    {
      kind: "help_response",
      title:
        post.direction === "need"
          ? `${user.name} can help with: ${post.title}`
          : `${user.name} would like: ${post.title}`,
      body: parsed.data.message.slice(0, 160),
      href: `/help/${post.id}`,
    },
    { email: true },
  );

  revalidatePath(`/help/${post.id}`);
  return { ok: true, message: "Sent. You will be told as soon as they answer." };
}

/** Works out who is helping and who is being helped for a response. */
async function loadResponse(responseId: string) {
  const [row] = await db
    .select({
      response: helpResponses,
      post: helpPosts,
    })
    .from(helpResponses)
    .innerJoin(helpPosts, eq(helpPosts.id, helpResponses.postId))
    .where(eq(helpResponses.id, responseId))
    .limit(1);
  if (!row) return null;

  const helperId =
    row.post.direction === "offer" ? row.post.userId : row.response.responderUserId;
  const newcomerId =
    row.post.direction === "offer" ? row.response.responderUserId : row.post.userId;
  return { ...row, helperId, newcomerId };
}

async function acceptedCount(postId: string) {
  const [row] = (await db.execute(sql`
    SELECT count(*)::int AS n FROM help_responses
    WHERE post_id = ${postId}::uuid AND status IN ('accepted', 'completed')
  `)) as unknown as Array<{ n: number }>;
  return Number(row?.n ?? 0);
}

export async function decideResponseAction(formData: FormData) {
  const { user } = await requireVerifiedStudent();

  const responseId = String(formData.get("responseId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!["accepted", "declined"].includes(decision)) return;

  const loaded = await loadResponse(responseId);
  if (!loaded) return;
  const { response, post } = loaded;

  // Only the person who posted decides, and only while it is still pending.
  if (post.userId !== user.id || response.status !== "pending") return;

  if (decision === "accepted") {
    if ((await acceptedCount(post.id)) >= post.capacity) return;

    await db
      .update(helpResponses)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(helpResponses.id, response.id));

    if ((await acceptedCount(post.id)) >= post.capacity) {
      await db
        .update(helpPosts)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(helpPosts.id, post.id));
    }

    await notify(
      response.responderUserId,
      {
        kind: "help_accepted",
        title: `${user.name} accepted — you are on`,
        body: `${post.title}. Their contact details are now on the page.`,
        href: `/help/${post.id}`,
      },
      { email: true },
    );
  } else {
    await db
      .update(helpResponses)
      .set({ status: "declined", respondedAt: new Date() })
      .where(eq(helpResponses.id, response.id));

    await notify(response.responderUserId, {
      kind: "help_declined",
      title: `${user.name} is not able to this time`,
      body: post.title,
      href: `/help/${post.id}`,
    });
  }

  revalidatePath(`/help/${post.id}`);
  revalidatePath("/help");
}

const completeSchema = z.object({
  responseId: z.string().uuid(),
  endorsement: z.string().trim().max(280, "Keep it under 280 characters.").optional().or(z.literal("")),
});

/**
 * Only the person who was helped can say it happened. That is what makes a
 * helper's count mean something: a helper cannot mark their own favours done.
 */
export async function completeResponseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireVerifiedStudent();

  const parsed = completeSchema.safeParse({
    responseId: formData.get("responseId"),
    endorsement: formData.get("endorsement") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);

  const loaded = await loadResponse(parsed.data.responseId);
  if (!loaded) return { ok: false, message: "That response no longer exists." };

  const { response, post, helperId, newcomerId } = loaded;
  if (newcomerId !== user.id) {
    return { ok: false, message: "Only the person who was helped can mark this done." };
  }
  if (response.status !== "accepted") {
    return { ok: false, message: "This one has not been accepted." };
  }

  await db
    .update(helpResponses)
    .set({
      status: "completed",
      completedAt: new Date(),
      endorsement: parsed.data.endorsement || null,
    })
    .where(eq(helpResponses.id, response.id));

  await notify(
    helperId,
    {
      kind: "help_completed",
      title: `${user.name} says you helped them`,
      body: parsed.data.endorsement
        ? `“${parsed.data.endorsement}”`
        : "It counts toward your helper total.",
      href: `/help/${post.id}`,
    },
    { email: true },
  );

  revalidatePath(`/help/${post.id}`);
  revalidatePath("/arrive");
  return { ok: true, message: "Thank you. That counts toward their helper total." };
}

export async function cancelResponseAction(formData: FormData) {
  const { user } = await requireVerifiedStudent();

  const loaded = await loadResponse(String(formData.get("responseId") ?? ""));
  if (!loaded) return;
  const { response, post } = loaded;

  // Either person involved can back out of a pending or accepted arrangement.
  const involved = response.responderUserId === user.id || post.userId === user.id;
  if (!involved || !["pending", "accepted"].includes(response.status)) return;

  const wasAccepted = response.status === "accepted";
  await db
    .update(helpResponses)
    .set({ status: "cancelled", respondedAt: new Date() })
    .where(eq(helpResponses.id, response.id));

  // A helper dropping out must not leave a newcomer stranded with a closed post.
  if (wasAccepted && post.status === "closed") {
    if ((await acceptedCount(post.id)) < post.capacity) {
      await db
        .update(helpPosts)
        .set({ status: "open", closedAt: null })
        .where(eq(helpPosts.id, post.id));
    }
  }

  const other = user.id === post.userId ? response.responderUserId : post.userId;
  await notify(
    other,
    {
      kind: "help_cancelled",
      title: `${user.name} can no longer do this`,
      body: post.title,
      href: `/help/${post.id}`,
    },
    { email: wasAccepted },
  );

  revalidatePath(`/help/${post.id}`);
  revalidatePath("/help");
}

export async function closePostAction(formData: FormData) {
  const { user } = await requireVerifiedStudent();
  const postId = String(formData.get("postId") ?? "");

  await db
    .update(helpPosts)
    .set({ status: "closed", closedAt: new Date() })
    .where(
      and(eq(helpPosts.id, postId), eq(helpPosts.userId, user.id), ne(helpPosts.status, "suspended")),
    );

  revalidatePath(`/help/${postId}`);
  revalidatePath("/help");
}

/** Used by the admin queue. */
export async function setHelpPostStatusAction(formData: FormData) {
  const me = await getCurrentUser();
  if (me?.role !== "admin") return;

  const postId = String(formData.get("postId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["open", "suspended", "closed"].includes(status)) return;

  const [post] = await db
    .update(helpPosts)
    .set({ status: status as "open" | "suspended" | "closed" })
    .where(eq(helpPosts.id, postId))
    .returning({ userId: helpPosts.userId, title: helpPosts.title });

  if (post && status === "suspended") {
    await notify(post.userId, {
      kind: "help_suspended",
      title: "A post of yours was taken down",
      body: `${post.title} was removed after a report. Read the content policy if you are unsure why.`,
      href: "/legal/content-policy",
    });
  }

  revalidatePath("/admin/reports");
  revalidatePath("/help");
}
