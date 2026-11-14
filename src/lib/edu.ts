import "server-only";

import { createHash, randomInt } from "node:crypto";

/**
 * Student-email verification.
 *
 * Proving someone controls an address at a college is what lets us treat them
 * as part of that college's community without ever asking about where they are
 * from. It is the single gate in front of the riskiest things here (staying with
 * someone, the help board), so it is strict:
 *
 *  - the address must be on the college's own domain;
 *  - the code is six digits, expires in 15 minutes and allows 5 guesses;
 *  - only a hash of the code is stored;
 *  - one student address can verify one account.
 */
export const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Salted with the user id so a leaked table cannot be replayed across accounts. */
export function hashCode(code: string, userId: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

export { emailMatchesDomain } from "@/lib/email-domain";

/** Dev convenience only: shows the code on screen when no email provider exists. */
export function canShowDevCode(emailEnabled: boolean) {
  return !emailEnabled && process.env.NODE_ENV !== "production";
}
