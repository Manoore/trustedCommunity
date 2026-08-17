"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inquiries, listings, providers, reviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { reviewSchema, zodToState, type ActionState } from "@/lib/validation";

/** Recomputes the denormalised rating on the provider from published reviews. */
async function refreshProviderRating(providerId: string) {
  await db.execute(sql`
    UPDATE providers SET
      rating_avg = COALESCE((
        SELECT avg(rating)::real FROM reviews
        WHERE provider_id = ${providerId} AND status = 'published'
      ), 0),
      rating_count = (
        SELECT count(*)::int FROM reviews
        WHERE provider_id = ${providerId} AND status = 'published'
      )
    WHERE id = ${providerId}
  `);
}

export async function createReviewAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to leave a review." };

  const parsed = reviewSchema.safeParse({
    inquiryId: formData.get("inquiryId"),
    rating: formData.get("rating"),
    title: formData.get("title") ?? "",
    body: formData.get("body"),
  });
  if (!parsed.success) return zodToState(parsed.error);

  const rows = await db
    .select({
      id: inquiries.id,
      buyerUserId: inquiries.buyerUserId,
      providerId: inquiries.providerId,
      listingId: inquiries.listingId,
      contactUnlockedAt: inquiries.contactUnlockedAt,
      listingSlug: listings.slug,
      providerSlug: providers.slug,
    })
    .from(inquiries)
    .innerJoin(listings, eq(listings.id, inquiries.listingId))
    .innerJoin(providers, eq(providers.id, inquiries.providerId))
    .where(eq(inquiries.id, parsed.data.inquiryId))
    .limit(1);

  if (!rows.length) return { ok: false, message: "That inquiry no longer exists." };
  const inquiry = rows[0];

  if (inquiry.buyerUserId !== user.id) {
    return { ok: false, message: "You can only review your own inquiries." };
  }

  // The review gate: a provider must have actually engaged. No contact, no review.
  if (!inquiry.contactUnlockedAt) {
    return {
      ok: false,
      message:
        "You can review once the provider has replied to your inquiry. That keeps reviews tied to real contact.",
    };
  }

  const existing = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.inquiryId, inquiry.id))
    .limit(1);
  if (existing.length) {
    return { ok: false, message: "You already reviewed this job." };
  }

  await db.insert(reviews).values({
    inquiryId: inquiry.id,
    listingId: inquiry.listingId,
    providerId: inquiry.providerId,
    authorUserId: user.id,
    rating: parsed.data.rating,
    title: parsed.data.title || null,
    body: parsed.data.body,
  });

  await refreshProviderRating(inquiry.providerId);

  revalidatePath(`/listings/${inquiry.listingSlug}`);
  revalidatePath(`/providers/${inquiry.providerSlug}`);
  revalidatePath(`/inbox/${inquiry.id}`);
  return { ok: true, message: "Review posted." };
}

/** Admin-only: hide a review and re-run the provider's aggregate. */
export async function setReviewStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return;

  const reviewId = String(formData.get("reviewId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["published", "removed", "pending"].includes(status)) return;

  const [row] = await db
    .update(reviews)
    .set({ status: status as "published" | "removed" | "pending" })
    .where(eq(reviews.id, reviewId))
    .returning({ providerId: reviews.providerId });

  if (row) await refreshProviderRating(row.providerId);
  revalidatePath("/admin/reports");
}
