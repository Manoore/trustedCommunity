import type { CountryCode } from "libphonenumber-js";

/**
 * Countries offered when adding a contact. Short on purpose: the point is the
 * handful of places a diaspora actually keeps people, not a full ISO table.
 * Anything else can still be entered by typing the number with its "+" prefix.
 */
export const COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "IN", name: "India" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
  { code: "NP", name: "Nepal" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "LK", name: "Sri Lanka" },
  { code: "CN", name: "China" },
  { code: "KR", name: "South Korea" },
  { code: "JP", name: "Japan" },
  { code: "PH", name: "Philippines" },
  { code: "VN", name: "Vietnam" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "EG", name: "Egypt" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
];

const BY_CODE = new Map<string, string>(COUNTRIES.map((c) => [c.code, c.name]));

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return BY_CODE.get(code) ?? code;
}

export function isKnownCountry(code: string): code is CountryCode {
  return BY_CODE.has(code);
}
