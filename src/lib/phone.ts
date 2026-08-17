import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Phone number is the identity key for a recommended contact.
 *
 * Two people adding "Mike's Plumbing" separately have to land on the same
 * profile, or the recommendation graph fragments into duplicate Mikes and
 * nothing downstream works. Everything is normalised to E.164 on write and that
 * value carries a unique index.
 */
export type NormalizedPhone = {
  /** E.164, e.g. +19375550148. Unique across contacts. */
  e164: string;
  /** Pretty form for display, e.g. (937) 555-0148. */
  display: string;
  /** Last four digits, used for masked forms. */
  tail: string;
};

/** US-first: bare 10-digit input is assumed to be a US number. */
export function normalizePhone(
  input: string | null | undefined,
  defaultCountry: "US" = "US",
): NormalizedPhone | null {
  if (!input?.trim()) return null;

  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  if (!parsed?.isValid()) return null;

  const e164 = parsed.number;
  return {
    e164,
    display: parsed.formatNational(),
    tail: e164.slice(-4),
  };
}

export function isValidPhone(input: string | null | undefined) {
  return normalizePhone(input) !== null;
}

/** Formats an already-normalised E.164 value for display. */
export function formatPhone(e164: string | null | undefined) {
  if (!e164) return null;
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.formatNational() ?? e164;
}
