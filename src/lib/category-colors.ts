/**
 * A colour per top-level category group.
 *
 * This is not decoration for its own sake: a list of thirty contacts is much
 * faster to scan when plumbing is always orange and tutoring is always yellow.
 * Keyed on the group slug, with a stable hash fallback so an unmapped category
 * still gets a consistent colour rather than a grey default.
 */
const GROUP_COLORS: Record<string, string> = {
  "home-improvement": "#f97316",
  "home-services": "#14b8a6",
  automotive: "#3b82f6",
  "beauty-wellness": "#ec4899",
  events: "#a855f7",
  "creative-digital": "#6366f1",
  "professional-services": "#0ea5e9",
  education: "#eab308",
  pets: "#84cc16",
  "care-services": "#f43f5e",
  "labor-trades": "#8b7355",
  "business-promotion": "#06b6d4",
};

const FALLBACK_PALETTE = [
  "#f97316",
  "#14b8a6",
  "#3b82f6",
  "#ec4899",
  "#a855f7",
  "#6366f1",
  "#eab308",
  "#84cc16",
  "#f43f5e",
  "#06b6d4",
];

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function categoryColor(slug: string | null | undefined): string {
  if (!slug) return "#8b8f98";
  return (
    GROUP_COLORS[slug] ?? FALLBACK_PALETTE[hash(slug) % FALLBACK_PALETTE.length]
  );
}

/** Same hue at low opacity, for chip and card backgrounds. */
export function categoryTint(slug: string | null | undefined, alpha = 0.12): string {
  const hex = categoryColor(slug);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* --------------------------------------------------------------- avatars */

const AVATAR_COLORS = [
  "#e0574a",
  "#e07a35",
  "#d99b16",
  "#71a832",
  "#1fa78b",
  "#2596be",
  "#4f74d8",
  "#7b5fd6",
  "#b855b0",
  "#d1477a",
];

export function avatarColor(seed: string): string {
  return AVATAR_COLORS[hash(seed) % AVATAR_COLORS.length];
}

/** "Mike's Plumbing" -> "MP", "Sarah Johnson" -> "SJ" */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
