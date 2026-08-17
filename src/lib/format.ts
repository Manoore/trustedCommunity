import type { Listing } from "@/db/schema";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCents(cents: number | null | undefined) {
  if (cents == null) return null;
  return usd.format(cents / 100);
}

type PriceFields = Pick<Listing, "priceType" | "priceMinCents" | "priceMaxCents">;

export function formatPrice(listing: PriceFields): string {
  const min = formatCents(listing.priceMinCents);
  const max = formatCents(listing.priceMaxCents);

  switch (listing.priceType) {
    case "hourly":
      if (min && max && max !== min) return `${min}–${max}/hr`;
      return min ? `${min}/hr` : "Hourly";
    case "fixed":
      return min ?? "Fixed price";
    case "starting_at":
      return min ? `From ${min}` : "Request pricing";
    case "quote":
    default:
      return "Request a quote";
  }
}

const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export function timeAgo(date: Date | string) {
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((then.getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return relative.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return "just now";
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Contact masking. Buyers only see a provider's real phone/email once the
 * provider has replied - otherwise the whole marketplace leaks off-platform on
 * the first page view.
 */
export function maskEmail(email: string | null | undefined) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 1);
  return `${head}${"•".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••-••••";
  return `(•••) •••-${digits.slice(-4)}`;
}

/**
 * Masked forms built from fragments, so a page that is not allowed to show the
 * real contact details never loads them in the first place. The query layer
 * returns only the last four digits and the email's first letter plus domain -
 * everything else stays in Postgres.
 */
export function maskPhoneFromTail(tail: string | null | undefined) {
  if (!tail) return null;
  return `(•••) •••-${tail}`;
}

export function maskEmailFromParts(
  head: string | null | undefined,
  domain: string | null | undefined,
) {
  if (!head || !domain) return null;
  return `${head}•••••@${domain}`;
}

export function locationLabel(
  parts: { city?: string | null; state?: string | null; zip?: string | null },
  remoteOk?: boolean,
) {
  if (remoteOk) return "Remote · Nationwide";
  const { city, state, zip } = parts;
  if (city && state) return `${city}, ${state}`;
  return zip ?? "Location not set";
}

export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
