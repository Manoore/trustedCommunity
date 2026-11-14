import "server-only";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Whether adding things needs a verified phone number.
 *
 * Off unless REQUIRE_PHONE_VERIFICATION=true, so the site works before the
 * WhatsApp account exists. When on, the gate sits at the first real action (a
 * recommendation, an ask, a help post, a new group), not at sign-up: people
 * should see what the product is before being asked to prove who they are.
 */
export function phoneVerificationRequired() {
  return process.env.REQUIRE_PHONE_VERIFICATION === "true";
}

export const PHONE_REQUIRED_MESSAGE =
  "Verify your phone number first. It takes under a minute: /verify/phone";

export async function isPhoneVerified(userId: string) {
  const [row] = await db
    .select({ at: users.phoneVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(row?.at);
}

/** For pages: send an unverified user to verify, and bring them back after. */
export async function requireVerifiedPhonePage(userId: string, next: string) {
  if (!phoneVerificationRequired()) return;
  if (!(await isPhoneVerified(userId))) {
    redirect(`/verify/phone?next=${encodeURIComponent(next)}`);
  }
}

/** For server actions: true when the action must stop and tell the user why. */
export async function phoneGateBlocks(userId: string) {
  return phoneVerificationRequired() && !(await isPhoneVerified(userId));
}
