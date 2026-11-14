"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { colleges, emailVerifications, groupMembers, groups, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { addToCollegeGroup, getUserCollegeState } from "@/lib/colleges";
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  canShowDevCode,
  emailMatchesDomain,
  generateCode,
  hashCode,
} from "@/lib/edu";
import { isEmailEnabled, sendEmail } from "@/lib/email";
import { lookupCityState } from "@/lib/geo";
import { notify } from "@/lib/notifications";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { uniqueSlug } from "@/lib/slug";
import { emailSchema, zodToState, type ActionState } from "@/lib/validation";

/**
 * Saying which college you attend. This claims nothing and unlocks nothing -
 * the help board and the community group open only after the student address is
 * verified - so it is safe to let anyone pick.
 */
export async function selectCollegeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/arrive");

  const collegeId = String(formData.get("collegeId") ?? "");
  const [college] = await db
    .select({ id: colleges.id })
    .from(colleges)
    .where(eq(colleges.id, collegeId))
    .limit(1);
  if (!college) redirect("/arrive");

  const [current] = await db
    .select({ collegeId: users.collegeId })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (current?.collegeId && current.collegeId !== college.id) {
    // Switching colleges voids the old proof and the old community.
    const [oldGroup] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.collegeId, current.collegeId))
      .limit(1);
    if (oldGroup) {
      await db
        .delete(groupMembers)
        .where(and(eq(groupMembers.groupId, oldGroup.id), eq(groupMembers.userId, user.id)));
    }
    await db
      .update(users)
      .set({ collegeId: college.id, eduEmail: null, eduVerifiedAt: null })
      .where(eq(users.id, user.id));
  } else {
    await db.update(users).set({ collegeId: college.id }).where(eq(users.id, user.id));
  }

  revalidatePath("/arrive");
  redirect("/arrive");
}

const collegeSchema = z.object({
  name: z.string().trim().min(3, "Enter the college's full name.").max(120),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^(?:[a-z0-9-]+\.)+edu$/,
      "Enter the student email domain, ending in .edu (for example utdallas.edu).",
    ),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use the two-letter state code, e.g. TX."),
  airport: z.string().trim().max(80).optional().or(z.literal("")),
});

/** Adds a college that is missing. Domain is required and must be unique. */
export async function createCollegeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/arrive");

  const limit = await rateLimit("college", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = collegeSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    city: formData.get("city"),
    state: formData.get("state"),
    airport: formData.get("airport") ?? "",
  });
  if (!parsed.success) return zodToState(parsed.error);

  const [dupe] = await db
    .select({ name: colleges.name })
    .from(colleges)
    .where(eq(colleges.domain, parsed.data.domain))
    .limit(1);
  if (dupe) {
    return {
      ok: false,
      fieldErrors: { domain: [`${dupe.name} already uses that domain — search for it above.`] },
    };
  }

  const geo = lookupCityState(`${parsed.data.city}, ${parsed.data.state}`);

  const [created] = await db
    .insert(colleges)
    .values({
      slug: uniqueSlug(parsed.data.name),
      name: parsed.data.name,
      city: parsed.data.city,
      state: parsed.data.state,
      domain: parsed.data.domain,
      airport: parsed.data.airport || null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      createdByUserId: user.id,
    })
    .returning({ id: colleges.id });

  await db.update(users).set({ collegeId: created.id }).where(eq(users.id, user.id));
  revalidatePath("/arrive");
  redirect("/arrive");
}

const eduEmailSchema = z.object({ email: emailSchema });

export async function sendEduCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const limit = await rateLimit("edu", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = eduEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return zodToState(parsed.error);
  const email = parsed.data.email;

  const state = await getUserCollegeState(user.id);
  if (!state.college) return { ok: false, message: "Choose your college first." };
  if (state.verified) return { ok: true, message: "You are already verified." };

  if (!state.college.domain) {
    return {
      ok: false,
      message: "This college has no student email domain on file yet, so it cannot be verified.",
    };
  }

  if (!emailMatchesDomain(email, state.college.domain)) {
    return {
      ok: false,
      fieldErrors: {
        email: [`Use your ${state.college.name} address — it ends in @${state.college.domain}.`],
      },
    };
  }

  // One student address backs one account.
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.eduEmail, email))
    .limit(1);
  if (taken && taken.id !== user.id) {
    return {
      ok: false,
      fieldErrors: { email: ["That student address is already verified on another account."] },
    };
  }

  const emailLive = isEmailEnabled();
  const devVisible = canShowDevCode(emailLive);
  if (!emailLive && !devVisible) {
    return {
      ok: false,
      message:
        "Email is not set up on this site yet, so verification codes cannot be sent. Check back soon.",
    };
  }

  const code = generateCode();
  await db.insert(emailVerifications).values({
    userId: user.id,
    email,
    codeHash: hashCode(code, user.id),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  await sendEmail({
    to: email,
    subject: `Your Trusted By code: ${code}`,
    text: [
      `Your verification code is ${code}.`,
      "",
      `It proves you have a ${state.college.name} address, and unlocks the student community.`,
      "It expires in 15 minutes. If you did not ask for it, ignore this email.",
    ].join("\n"),
  });

  return {
    ok: true,
    message: devVisible
      ? `Development mode: your code is ${code}. (On a live site it is emailed to ${email}.)`
      : `We sent a 6-digit code to ${email}. It expires in 15 minutes.`,
  };
}

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.") });

export async function confirmEduCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const limit = await rateLimit("eduConfirm", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return zodToState(parsed.error);

  const state = await getUserCollegeState(user.id);
  if (!state.college) return { ok: false, message: "Choose your college first." };

  const [pending] = await db
    .select()
    .from(emailVerifications)
    .where(and(eq(emailVerifications.userId, user.id), isNull(emailVerifications.consumedAt)))
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1);

  if (!pending || pending.expiresAt < new Date()) {
    return { ok: false, message: "That code has expired. Request a new one." };
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    return { ok: false, message: "Too many wrong tries. Request a new code." };
  }

  if (pending.codeHash !== hashCode(parsed.data.code, user.id)) {
    await db
      .update(emailVerifications)
      .set({ attempts: pending.attempts + 1 })
      .where(eq(emailVerifications.id, pending.id));
    return { ok: false, fieldErrors: { code: ["That code is not right."] } };
  }

  // The address must still belong to this college (they may have switched).
  if (!state.college.domain || !emailMatchesDomain(pending.email, state.college.domain)) {
    return { ok: false, message: "That address does not match your college. Start again." };
  }

  try {
    await db
      .update(users)
      .set({ eduEmail: pending.email, eduVerifiedAt: new Date() })
      .where(eq(users.id, user.id));
  } catch {
    return {
      ok: false,
      message: "That student address was just verified on another account.",
    };
  }

  await db
    .update(emailVerifications)
    .set({ consumedAt: new Date() })
    .where(eq(emailVerifications.id, pending.id));

  await addToCollegeGroup(state.college.id, user.id);

  await notify(user.id, {
    kind: "verified",
    title: `You are verified at ${state.college.name}`,
    body: "The help board and your college community are now open to you.",
    href: "/arrive",
  });

  revalidatePath("/arrive");
  revalidatePath("/help");
  return { ok: true, message: "Verified. The student community is open to you." };
}
