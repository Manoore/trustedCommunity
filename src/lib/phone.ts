import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Phone number is the identity key for a recommended contact.
 *
 * Two people adding "Mike's Plumbing" separately have to land on the same
 * profile, or the recommendation graph fragments into duplicate Mikes and
 * nothing downstream works. Everything is normalised to E.164 on write and that
 * value carries a unique index.
 *
 * The country is a parameter because the people using this are often between
 * two of them: a student with an Indian number in the US, a family keeping a
 * trusted doctor in Hyderabad. A number typed with its own "+" prefix is read
 * as written; one without is read as a number in `defaultCountry`.
 */
export type NormalizedPhone = {
  /** E.164, e.g. +19375550148. Unique across contacts. */
  e164: string;
  /** Pretty form for display, e.g. (937) 555-0148 or +91 98480 12345. */
  display: string;
  /** Last four digits, used for masked forms. */
  tail: string;
  /** The ISO country the number belongs to, when it can be told. */
  country: string | null;
};

export function normalizePhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = "US",
): NormalizedPhone | null {
  if (!input?.trim()) return null;

  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  if (!parsed?.isValid()) return null;

  const e164 = parsed.number;
  // Domestic numbers read naturally in national form; anything else needs its
  // country code or it is ambiguous to the person calling.
  const domestic = parsed.country === "US" && defaultCountry === "US";

  return {
    e164,
    display: domestic ? parsed.formatNational() : parsed.formatInternational(),
    tail: e164.slice(-4),
    country: parsed.country ?? null,
  };
}

export function isValidPhone(input: string | null | undefined) {
  return normalizePhone(input) !== null;
}

/** Formats an already-normalised E.164 value for display. */
export function formatPhone(e164: string | null | undefined) {
  if (!e164) return null;
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "US" ? parsed.formatNational() : parsed.formatInternational();
}
