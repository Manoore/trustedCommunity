/** Tunables for phone verification. Plain values so a check script can read them. */
export const PHONE_CODE_TTL_MS = 10 * 60 * 1000;
/** A new code to the same number cannot be requested sooner than this. */
export const RESEND_COOLDOWN_MS = 60 * 1000;
/** Most codes any one number can be sent in an hour, whoever asks. Stops the number being used for harassment. */
export const MAX_SENDS_PER_NUMBER_PER_HOUR = 3;

/**
 * Most codes the whole site will send in a day. Every code costs money, and a
 * script asking for codes to numbers it does not own is the standard way that
 * bill gets run up ("SMS pumping"). Past this the feature pauses instead.
 */
export function dailySendCap() {
  const n = Number(process.env.OTP_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
}

/** Only ever send people back to a page on this site. */
export function safeNext(value: unknown, fallback = "/list") {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}
