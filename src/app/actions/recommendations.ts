"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  providers,
  recommendationGroups,
  recommendations,
  shareLinks,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getGroupIds } from "@/lib/social";
import { lookupZip } from "@/lib/geo";
import { normalizePhone } from "@/lib/phone";
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

  const limit = await rateLimit("recommendation", user.id);
  if (!limit.ok) return { ok: false, message: rateLimitMessage(limit) };

  const parsed = recommendationSchema.safeParse(readForm(formData));
  if (!parsed.success) return zodToState(parsed.error);

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return {
      ok: false,
      fieldErrors: {
        phone: ["That does not look like a valid US phone number."],
      },
    };
  }

  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, parsed.data.categoryId))
    .limit(1);

  if (!category) return { ok: false, fieldErrors: { categoryId: ["Pick a category."] } };
  if (category.restricted) {
    return {
      ok: false,
      message: `${category.name} is not accepted here — see the content policy.`,
    };
  }

  const geo = parsed.data.zip ? lookupZip(parsed.data.zip) : null;
  if (parsed.data.zip && !geo) {
    return { ok: false, fieldErrors: { zip: ["We do not recognise that ZIP code."] } };
  }

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
        websiteUrl: parsed.data.websiteUrl || null,
        city: geo?.city ?? null,
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
