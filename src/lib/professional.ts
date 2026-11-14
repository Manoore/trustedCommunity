/**
 * Healthcare and legal contacts.
 *
 * These are built to be the low-risk version: contact details only, an outbound
 * link to the practitioner's own website or portal, no money for placement, no
 * patient or client information handled here, and a licence check queued for an
 * admin. They are still OFF by default. Whether a free, vouch-based list of
 * lawyers counts as a "lawyer referral service" varies by state, and that is a
 * question for counsel before launch - not something to switch on because the
 * code is ready.
 *
 * Set ENABLE_PROFESSIONAL_CATEGORIES=true to turn them on.
 */
export function professionalEnabled() {
  return process.env.ENABLE_PROFESSIONAL_CATEGORIES === "true";
}

/** A category nobody may add a contact to right now, for whatever reason. */
export function isCategoryBlocked(category: { restricted: boolean; professional: boolean }) {
  return category.restricted || (category.professional && !professionalEnabled());
}

/**
 * A recommendation of a doctor or lawyer should not carry a story. "Dr. X treated
 * my depression" or "she won my custody case" is the recommender's own health or
 * legal information, and it lands in front of a whole group. Keep the note short
 * and ask people to leave the details out.
 */
export const PROFESSIONAL_NOTE_LIMIT = 200;

export const PROFESSIONAL_NOTE_WARNING =
  "Please leave out health or legal details — yours or anyone else's. Say what you would tell a friend: responsive, clear about fees, easy to reach.";

export const PROFESSIONAL_DISCLAIMER =
  "Recommended by people in the community. This is not medical or legal advice, and we have not checked their licence unless it says so below. For an emergency, call 911.";

export const IMMIGRATION_WARNING =
  "Only a licensed attorney or a DOJ-accredited representative may give immigration legal advice. Be careful of anyone else offering help with immigration papers — a “notario” or “consultant” is not a lawyer, and newcomers are their main targets.";
