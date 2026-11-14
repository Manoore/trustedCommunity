"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { phoneVerifications, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { MAX_ATTEMPTS, generateCode, hashCode } from "@/lib/edu";
import { isKnownCountry } from "@/lib/countries";
import { normalizePhone } from "@/lib/phone";
import {
  MAX_SENDS_PER_NUMBER_PER_HOUR,
  PHONE_CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  dailySendCap,
} from "@/lib/phone-verify";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { zodToState, type ActionState } from "@/lib/validation";
import { isWhatsAppEnabled, sendWhatsAppCode } from "@/lib/whatsapp";
import { whatsAppFailureMessage } from "@/lib/whatsapp-format";

/**
 * The code is bound to the user AND the number, so a hash lifted from the table
 * cannot be replayed for another account or another number.
 */
const hashFor = (code: string, userId: string, phone: string) => hashCode(code, `${userId}:${phone}`);

export async function sendPhoneCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const limit = await rateLimit("phone", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const countryInput = String(formData.get("country") ?? "US").toUpperCase();
  const country = isKnownCountry(countryInput) ? countryInput : "US";
  const phone = normalizePhone(String(formData.get("phone") ?? ""), country);
  if (!phone) {
    return {
      ok: false,
      fieldErrors: {
        phone: ["That does not look like a valid number. Check the country and the digits."],
      },
    };
  }

  const [me] = await db
    .select({ verifiedPhone: users.verifiedPhone })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (me?.verifiedPhone === phone.e164) {
    return { ok: true, message: "That number is already verified on your account." };
  }

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.verifiedPhone, phone.e164))
    .limit(1);
  if (taken && taken.id !== user.id) {
    return {
      ok: false,
      fieldErrors: { phone: ["That number is already verified on another account."] },
    };
  }

  const live = isWhatsAppEnabled();
  const devVisible = !live && process.env.NODE_ENV !== "production";
  if (!live && !devVisible) {
    return {
      ok: false,
      message: "WhatsApp verification is not switched on for this site yet. Check back soon.",
    };
  }

  /* ---- throttles: per number, then per day across the whole site ---- */
  const now = Date.now();

  const [last] = await db
    .select({ createdAt: phoneVerifications.createdAt })
    .from(phoneVerifications)
    .where(eq(phoneVerifications.phone, phone.e164))
    .orderBy(desc(phoneVerifications.createdAt))
    .limit(1);
  if (last && now - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - last.createdAt.getTime())) / 1000);
    return { ok: false, message: `A code was just sent. You can ask for another in ${wait}s.` };
  }

  const [hour] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(phoneVerifications)
    .where(
      and(
        eq(phoneVerifications.phone, phone.e164),
        gt(phoneVerifications.createdAt, new Date(now - 60 * 60 * 1000)),
      ),
    );
  if ((hour?.n ?? 0) >= MAX_SENDS_PER_NUMBER_PER_HOUR) {
    return {
      ok: false,
      message: "Too many codes have been sent to that number. Try again in an hour.",
    };
  }

  const [day] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(phoneVerifications)
    .where(gt(phoneVerifications.createdAt, new Date(now - 24 * 60 * 60 * 1000)));
  if ((day?.n ?? 0) >= dailySendCap()) {
    return {
      ok: false,
      message: "Verification is paused for today because of unusually high demand. Try again tomorrow.",
    };
  }

  /* ---- send ---- */
  const code = generateCode();
  const [row] = await db
    .insert(phoneVerifications)
    .values({
      userId: user.id,
      phone: phone.e164,
      channel: "whatsapp",
      codeHash: hashFor(code, user.id, phone.e164),
      expiresAt: new Date(now + PHONE_CODE_TTL_MS),
    })
    .returning({ id: phoneVerifications.id });

  if (devVisible) {
    return {
      ok: true,
      message: `Development mode: your code is ${code}. (On a live site it is sent on WhatsApp to ${phone.display}.)`,
    };
  }

  const sent = await sendWhatsAppCode(phone.e164, code);
  if (!sent.ok) {
    // Void the code so a failed send cannot be guessed against later.
    await db
      .update(phoneVerifications)
      .set({ consumedAt: new Date() })
      .where(eq(phoneVerifications.id, row.id));
    return { ok: false, message: whatsAppFailureMessage(sent.reason) };
  }

  return {
    ok: true,
    message: `We sent a 6-digit code on WhatsApp to ${phone.display}. It expires in 10 minutes.`,
  };
}

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.") });

export async function confirmPhoneCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const limit = await rateLimit("phoneConfirm", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return zodToState(parsed.error);

  const [pending] = await db
    .select()
    .from(phoneVerifications)
    .where(and(eq(phoneVerifications.userId, user.id), isNull(phoneVerifications.consumedAt)))
    .orderBy(desc(phoneVerifications.createdAt))
    .limit(1);

  if (!pending || pending.expiresAt < new Date()) {
    return { ok: false, message: "That code has expired. Request a new one." };
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    return { ok: false, message: "Too many wrong tries. Request a new code." };
  }

  if (pending.codeHash !== hashFor(parsed.data.code, user.id, pending.phone)) {
    await db
      .update(phoneVerifications)
      .set({ attempts: pending.attempts + 1 })
      .where(eq(phoneVerifications.id, pending.id));
    return { ok: false, fieldErrors: { code: ["That code is not right."] } };
  }

  try {
    await db
      .update(users)
      .set({ verifiedPhone: pending.phone, phoneVerifiedAt: new Date() })
      .where(eq(users.id, user.id));
  } catch {
    return { ok: false, message: "That number was just verified on another account." };
  }

  await db
    .update(phoneVerifications)
    .set({ consumedAt: new Date() })
    .where(eq(phoneVerifications.id, pending.id));

  revalidatePath("/verify/phone");
  return { ok: true, message: "Your number is verified." };
}
