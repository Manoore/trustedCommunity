"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  providers,
  recommendationGroups,
  recommendations,
  shareLinks,
  verifications,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { PHONE_REQUIRED_MESSAGE, phoneGateBlocks } from "@/lib/phone-gate";
import { countryName, isKnownCountry } from "@/lib/countries";
import { getGroupIds } from "@/lib/social";
import { lookupZip } from "@/lib/geo";
import { normalizePhone } from "@/lib/phone";
import {
  PROFESSIONAL_NOTE_LIMIT,
  PROFESSIONAL_NOTE_WARNING,
  isCategoryBlocked,
} from "@/lib/professional";
import { rateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { uniqueSlug } from "@/lib/slug";
import {
  recommendationSchema,
  zodToState,
  type ActionState,
} from "@/lib/validation";

function readForm(formData: FormData) {
  return {
    name: formData.get("name"),
    phone: formData.get("phone"),
    kind: formData.get("kind"),
    categoryId: formData.get("categoryId"),
    zip: formData.get("zip") ?? "",
    country: formData.get("country") ?? "",
    city: formData.get("city") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    relationship: formData.get("relationship"),
    strength: formData.get("strength"),
    note: formData.get("note") ?? "",
    visibility: formData.get("visibility"),
  };
}

/**
 * Creates or updates the caller's recommendation for a contact.
 *
 * The contact itself is deduplicated on the normalised phone number, so two
 * people who add the same plumber attach to one profile rather than creating
 * two. An existing contact's details are never overwritten by a later
 * recommender - whoever added them first owns the record, and everyone else
 * just attaches their own recommendation to it.
 */
export async function saveRecommendationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/recommendations/new");
  if (await phoneGateBlocks(user.id)) return { ok: false, message: PHONE_REQUIRED_MESSAGE };

  const limit = await rateLimit("recommendation", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = recommendationSchema.safeParse(readForm(formData));
  if (!parsed.success) return zodToState(parsed.error);

  // A contact is not assumed to be American: a doctor for parents in Hyderabad
  // is as valid as a plumber in Dayton. Unknown codes fall back to the US.
  const countryInput = (parsed.data.country || "US").toUpperCase();
  const country = isKnownCountry(countryInput) ? countryInput : "US";
  const abroad = country !== "US";

  const phone = normalizePhone(parsed.data.phone, country);
  if (!phone) {
    return {
      ok: false,
      fieldErrors: {
        phone: [
          abroad
            ? `That does not look like a valid ${countryName(country)} number. You can also start it with + and the country code.`
            : "That does not look like a valid US phone number. For a number from another country, choose it above or start with +.",
        ],
      },
    };
  }

  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, parsed.data.categoryId))
    .limit(1);

  if (!category) return { ok: false, fieldErrors: { categoryId: ["Pick a category."] } };
  if (isCategoryBlocked(category)) {
    return {
      ok: false,
      message: `${category.name} is not accepted here — see the content policy.`,
    };
  }

  // Healthcare and legal: short notes, no stories. It is the recommender's own
  // health or legal information otherwise, and it would be shown to a group.
  if (category.professional && (parsed.data.note?.length ?? 0) > PROFESSIONAL_NOTE_LIMIT) {
    return {
      ok: false,
      fieldErrors: {
        note: [
          `Keep it under ${PROFESSIONAL_NOTE_LIMIT} characters for a doctor or lawyer. ${PROFESSIONAL_NOTE_WARNING}`,
        ],
      },
    };
  }

  // In the US we locate by ZIP; elsewhere there is no ZIP, so a city is enough.
  const geo = !abroad && parsed.data.zip ? lookupZip(parsed.data.zip) : null;
  if (!abroad && parsed.data.zip && !geo) {
    return { ok: false, fieldErrors: { zip: ["We do not recognise that ZIP code."] } };
  }
  const abroadCity = abroad ? parsed.data.city?.trim() || null : null;

  // Dedupe on the phone number.
  const existing = await db
    .select({
      id: providers.id,
      hiddenAt: providers.hiddenAt,
      displayName: providers.displayName,
    })
    .from(providers)
    .where(eq(providers.normalizedPhone, phone.e164))
    .limit(1);

  if (existing[0]?.hiddenAt) {
    return {
      ok: false,
      message:
        "This person asked to be removed from the site. We cannot accept a recommendation for them.",
    };
  }

  let providerId = existing[0]?.id;

  /**
   * The number already belongs to a contact under a different name. Attaching
   * is correct - one number is one contact - but silently filing the entry
   * under a name the user did not type looks like a bug, so we say so.
   */
  const matchedUnder =
    existing[0] &&
    existing[0].displayName.trim().toLowerCase() !==
      parsed.data.name.trim().toLowerCase()
      ? existing[0].displayName
      : null;

  if (!providerId) {
    const [created] = await db
      .insert(providers)
      .values({
        // `type` is the legacy directory column; `kind` is what this layer uses.
        type: parsed.data.kind === "business" ? "entity" : "individual",
        kind: parsed.data.kind,
        slug: uniqueSlug(parsed.data.name),
        displayName: parsed.data.name,
        contactPhone: phone.display,
        normalizedPhone: phone.e164,
        country,
        websiteUrl: parsed.data.websiteUrl || null,
        city: geo?.city ?? abroadCity,
        state: geo?.state ?? null,
        zip: geo?.zip ?? null,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        status: "active",
        createdByUserId: user.id,
      })
      .returning({ id: providers.id });
    providerId = created.id;
  }

  // A doctor or lawyer gets a licence check queued for an admin, once. The
  // recommender cannot supply the licence number - it is not theirs - so the
  // admin looks it up (NPI registry for clinicians, the state bar for lawyers).
  if (category.professional && category.licenseRequired) {
    const [queued] = await db
      .select({ id: verifications.id })
      .from(verifications)
      .where(and(eq(verifications.providerId, providerId), eq(verifications.kind, "license")))
      .limit(1);
    if (!queued) {
      await db.insert(verifications).values({
        providerId,
        kind: "license",
        notes: `Added through a recommendation in ${category.name}. Look up the licence (the NPI registry for clinicians, the state bar for attorneys) and approve or reject.`,
      });
    }
  }

  const [saved] = await db
    .insert(recommendations)
    .values({
      recommenderUserId: user.id,
      providerId,
      categoryId: category.id,
      relationship: parsed.data.relationship,
      strength: parsed.data.strength,
      note: parsed.data.note || null,
      visibility: parsed.data.visibility,
    })
    .onConflictDoUpdate({
      target: [recommendations.recommenderUserId, recommendations.providerId],
      set: {
        categoryId: category.id,
        relationship: parsed.data.relationship,
        strength: parsed.data.strength,
        note: parsed.data.note || null,
        visibility: parsed.data.visibility,
        updatedAt: new Date(),
      },
    })
    .returning({ id: recommendations.id });

  // Group scoping is rewritten from scratch each save, and only kept while the
  // recommendation is actually scoped to groups.
  await db
    .delete(recommendationGroups)
    .where(eq(recommendationGroups.recommendationId, saved.id));

  if (parsed.data.visibility === "groups") {
    const chosen = formData.getAll("groupIds").map(String).filter(Boolean);
    const mine = await getGroupIds(user.id);
    const allowed = chosen.filter((id) => mine.includes(id));

    if (!allowed.length) {
      return {
        ok: false,
        fieldErrors: {
          visibility: ["Pick at least one group, or choose a different audience."],
        },
      };
    }

    await db.insert(recommendationGroups).values(
      allowed.map((groupId) => ({ recommendationId: saved.id, groupId })),
    );
  }

  revalidatePath("/list");
  redirect(
    matchedUnder
      ? `/list?saved=1&matched=${encodeURIComponent(matchedUnder)}`
      : "/list?saved=1",
  );
}

export async function deleteRecommendationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const id = String(formData.get("recommendationId") ?? "");
  await db
    .delete(recommendations)
    .where(
      and(eq(recommendations.id, id), eq(recommendations.recommenderUserId, user.id)),
    );

  revalidatePath("/list");
  redirect("/list");
}

/** Only same-site relative paths may be used as a post-action destination. */
function safeReturn(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

/**
 * One-tap "+1": vouch for a contact someone else already added.
 *
 * Most members will back a recommendation long before they will fill in a
 * form, so this is the cheapest way to add weight to a name. Two choices keep it
 * honest:
 *
 *  - The relationship is recorded as "someone I trust recommended them", not
 *    "I used them personally". A +1 must not put a first-hand claim in someone's
 *    mouth that they did not make; they can upgrade it from the edit page.
 *  - From a group page it is shared with that group. From anywhere else it is
 *    saved privately - saving to your own list must never publish anything.
 */
export async function quickVouchAction(formData: FormData) {
  const returnTo = safeReturn(formData.get("returnTo"), "/list");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);

  const limit = await rateLimit("recommendation", user.id);
  if (!limit.ok) redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}vouch=limited`);

  const providerId = String(formData.get("providerId") ?? "");
  const groupId = String(formData.get("groupId") ?? "") || null;
  const sep = returnTo.includes("?") ? "&" : "?";

  const [provider] = await db
    .select({ id: providers.id })
    .from(providers)
    .where(and(eq(providers.id, providerId), isNull(providers.hiddenAt)))
    .limit(1);
  if (!provider) redirect(`${returnTo}${sep}vouch=missing`);

  if (groupId) {
    const mine = await getGroupIds(user.id);
    if (!mine.includes(groupId)) redirect(`${returnTo}${sep}vouch=missing`);
  }

  // Borrow the category the group already files this contact under.
  const [source] = await db
    .select({ categoryId: recommendations.categoryId })
    .from(recommendations)
    .where(eq(recommendations.providerId, provider.id))
    .orderBy(desc(recommendations.createdAt))
    .limit(1);

  const [existing] = await db
    .select({ id: recommendations.id, visibility: recommendations.visibility })
    .from(recommendations)
    .where(
      and(
        eq(recommendations.recommenderUserId, user.id),
        eq(recommendations.providerId, provider.id),
      ),
    )
    .limit(1);

  let recommendationId = existing?.id;

  if (!existing) {
    const [created] = await db
      .insert(recommendations)
      .values({
        recommenderUserId: user.id,
        providerId: provider.id,
        categoryId: source?.categoryId ?? null,
        relationship: "trusted_referral",
        strength: "recommend",
        visibility: groupId ? "groups" : "private",
      })
      .returning({ id: recommendations.id });
    recommendationId = created.id;
  } else if (groupId) {
    // Already on their list. Only widen it to the group when it was private or
    // already group-scoped; a connections/link audience is a deliberate choice
    // and is not silently replaced.
    if (existing.visibility === "private") {
      await db
        .update(recommendations)
        .set({ visibility: "groups", updatedAt: new Date() })
        .where(eq(recommendations.id, existing.id));
    } else if (existing.visibility !== "groups") {
      redirect(`${returnTo}${sep}vouch=exists`);
    }
  } else {
    redirect(`${returnTo}${sep}vouch=exists`);
  }

  if (groupId && recommendationId) {
    await db
      .insert(recommendationGroups)
      .values({ recommendationId, groupId })
      .onConflictDoNothing();
  }

  revalidatePath("/list");
  revalidatePath(returnTo.split("?")[0]);
  redirect(`${returnTo}${sep}vouch=${groupId ? "group" : "saved"}`);
}

/* ------------------------------------------------------------ share links */

function makeToken() {
  return randomBytes(9).toString("base64url");
}

/**
 * Mints a public link for one recommendation or for the caller's whole list.
 * Viewing needs no account - that is how this spreads.
 */
export async function createShareLinkAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const kind = String(formData.get("kind") ?? "");
  if (kind !== "recommendation" && kind !== "list") return;

  const recommendationId = String(formData.get("recommendationId") ?? "") || null;

  if (kind === "recommendation") {
    if (!recommendationId) return;
    const [owned] = await db
      .select({ id: recommendations.id })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.id, recommendationId),
          eq(recommendations.recommenderUserId, user.id),
        ),
      )
      .limit(1);
    if (!owned) return;

    // Reuse a live link rather than minting a new one on every click.
    const [existing] = await db
      .select({ token: shareLinks.token })
      .from(shareLinks)
      .where(
        and(
          eq(shareLinks.userId, user.id),
          eq(shareLinks.kind, "recommendation"),
          eq(shareLinks.recommendationId, recommendationId),
        ),
      )
      .limit(1);

    if (existing) redirect(`/s/${existing.token}`);

    const token = makeToken();
    await db
      .insert(shareLinks)
      .values({ token, kind: "recommendation", userId: user.id, recommendationId });
    redirect(`/s/${token}`);
  }

  const [existingList] = await db
    .select({ token: shareLinks.token })
    .from(shareLinks)
    .where(and(eq(shareLinks.userId, user.id), eq(shareLinks.kind, "list")))
    .limit(1);

  if (existingList) redirect(`/s/${existingList.token}`);

  const token = makeToken();
  await db.insert(shareLinks).values({ token, kind: "list", userId: user.id });
  redirect(`/s/${token}`);
}

export async function revokeShareLinkAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const id = String(formData.get("shareLinkId") ?? "");
  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareLinks.id, id), eq(shareLinks.userId, user.id)));

  revalidatePath("/list");
}
