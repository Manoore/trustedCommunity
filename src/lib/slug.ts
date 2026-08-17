export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function shortId(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Slug with a random suffix, so two "House Cleaning" listings never collide. */
export function uniqueSlug(input: string): string {
  const base = slugify(input) || "listing";
  return `${base}-${shortId()}`;
}
