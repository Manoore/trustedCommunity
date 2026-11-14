/**
 * A blunt safety net for accommodation posts, not legal compliance.
 *
 * Posts about a room or a place to stay must not state a preference based on
 * race, colour, religion or national origin. A US court has held a roommate
 * site liable for soliciting and filtering on exactly that, so this site does
 * not offer such filters and rejects posts that spell one out.
 *
 * It looks only for an explicit preference ("only Indian", "no Muslims",
 * "Hindus preferred"). Dietary or lifestyle wording such as "vegetarian
 * household" is deliberately allowed: it is a real, common need and is not
 * itself a protected class. Gender is also left alone here, because shared
 * living has its own rules that need a lawyer rather than a word list.
 */
const GROUPS = [
  // religion
  "hindu", "hindus", "muslim", "muslims", "christian", "christians", "jewish",
  "jews", "sikh", "sikhs", "buddhist", "buddhists", "jain", "jains", "atheist",
  "atheists",
  // race / colour
  "white", "whites", "black", "blacks", "brown", "asian", "asians", "caucasian",
  "caucasians",
  // national origin / ethnicity
  "indian", "indians", "desi", "chinese", "korean", "koreans", "japanese",
  "pakistani", "pakistanis", "bangladeshi", "bangladeshis", "nepali", "nepalis",
  "sri lankan", "american", "americans", "african", "africans", "arab", "arabs",
  "mexican", "mexicans", "hispanic", "hispanics", "latino", "latinos", "latina",
  "latinas", "russian", "russians", "filipino", "filipinos", "vietnamese",
  "telugu", "tamil", "gujarati", "punjabi", "bengali", "malayali", "kannada",
  "marathi",
].join("|");

// "only Indian", "no Muslims", "prefer a Hindu"
const CUES =
  "only|no|not|never|prefer|preferably|exclusively|strictly|must be|should be|looking for";
const BEFORE = new RegExp(`\\b(?:${CUES})\\s+(?:an?\\s+|the\\s+)?(?:${GROUPS})\\b`, "i");

// "Hindus only", "Indian preferred"
const AFTER = new RegExp(`\\b(?:${GROUPS})\\s+(?:only|preferred|required|exclusively)\\b`, "i");

/** Returns the offending phrase, or null when the text is fine. */
export function findProtectedPreference(...texts: Array<string | null | undefined>) {
  const text = texts.filter(Boolean).join(" \n ");
  if (!text) return null;
  const match = BEFORE.exec(text) ?? AFTER.exec(text);
  return match ? match[0] : null;
}

export const FAIR_HOUSING_MESSAGE =
  "Please remove that. Posts about a room or a place to stay cannot state a preference based on race, colour, religion or national origin. Describe the place and the household's real needs instead (quiet hours, cleanliness, budget).";
