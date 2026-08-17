"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inquiries, inquiryMessages, listings, providerMembers } from "@/db/schema";
import { getCurrentUser, getMemberships } from "@/lib/auth";
import {
  inquirySchema,
  messageSchema,
  zodToState,
  type ActionState,
} from "@/lib/validation";

export async function createInquiryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  const listingId = String(formData.get("listingId") ?? "");

  if (!user) {
    // Preserve what they were doing; the login form sends them back.
    const slug = String(formData.get("listingSlug") ?? "");
    redirect(`/login?next=${encodeURIComponent(`/listings/${slug}#contact`)}`);
  }

  const parsed = inquirySchema.safeParse({
    listingId,
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    zip: formData.get("zip") ?? "",
    message: formData.get("message"),
  });
  if (!parsed.success) return zodToState(parsed.error);

  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      providerId: listings.providerId,
      status: listings.status,
    })
    .from(listings)
    .where(eq(listings.id, parsed.data.listingId))
    .limit(1);

  if (!rows.length || rows[0].status !== "active") {
    return { ok: false, message: "That listing is no longer available." };
  }

  const listing = rows[0];

  // A provider inquiring on their own listing would pollute their review gate.
  const memberships = await getMemberships(user.id);
  if (memberships.some((m) => m.providerId === listing.providerId)) {
    return { ok: false, message: "This is your own listing." };
  }

  const existing = await db
    .select({ id: inquiries.id })
    .from(inquiries)
    .where(
      and(
        eq(inquiries.listingId, listing.id),
        eq(inquiries.buyerUserId, user.id),
        eq(inquiries.status, "new"),
      ),
    )
    .limit(1);

  if (existing.length) {
    return {
      ok: false,
      message: "You already have an open inquiry on this listing. Check your inbox.",
    };
  }

  const [inquiry] = await db
    .insert(inquiries)
    .values({
      listingId: listing.id,
      providerId: listing.providerId,
      buyerUserId: user.id,
      buyerName: parsed.data.name,
      buyerEmail: parsed.data.email,
      buyerPhone: parsed.data.phone || null,
      buyerZip: parsed.data.zip || null,
    })
    .returning({ id: inquiries.id });

  await db.insert(inquiryMessages).values({
    inquiryId: inquiry.id,
    senderUserId: user.id,
    body: parsed.data.message,
  });

  await db
    .update(listings)
    .set({ inquiryCount: sql`${listings.inquiryCount} + 1` })
    .where(eq(listings.id, listing.id));

  revalidatePath(`/listings/${listing.slug}`);
  redirect(`/inbox/${inquiry.id}`);
}

/**
 * Posting a reply is what unlocks the provider's contact details for the buyer.
 * Until a provider engages, their phone and email stay masked - otherwise every
 * listing page is a free contact scrape and nothing stays on-platform.
 */
export async function sendMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to reply." };

  const parsed = messageSchema.safeParse({
    inquiryId: formData.get("inquiryId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return zodToState(parsed.error);

  const rows = await db
    .select({
      id: inquiries.id,
      buyerUserId: inquiries.buyerUserId,
      providerId: inquiries.providerId,
      contactUnlockedAt: inquiries.contactUnlockedAt,
    })
    .from(inquiries)
    .where(eq(inquiries.id, parsed.data.inquiryId))
    .limit(1);

  if (!rows.length) return { ok: false, message: "That conversation no longer exists." };
  const inquiry = rows[0];

  const isBuyer = inquiry.buyerUserId === user.id;
  const memberships = await getMemberships(user.id);
  const isProvider = memberships.some((m) => m.providerId === inquiry.providerId);

  if (!isBuyer && !isProvider) {
    return { ok: false, message: "You are not part of this conversation." };
  }

  await db.insert(inquiryMessages).values({
    inquiryId: inquiry.id,
    senderUserId: user.id,
    body: parsed.data.body,
  });

  if (isProvider) {
    await db
      .update(inquiries)
      .set({
        status: "replied",
        contactUnlockedAt: inquiry.contactUnlockedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inquiries.id, inquiry.id));
  } else {
    await db
      .update(inquiries)
      .set({ updatedAt: new Date() })
      .where(eq(inquiries.id, inquiry.id));
  }

  revalidatePath(`/inbox/${inquiry.id}`);
  revalidatePath(`/dashboard/inquiries/${inquiry.id}`);
  return { ok: true };
}

export async function setInquiryStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const inquiryId = String(formData.get("inquiryId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["closed", "spam", "replied"].includes(status)) return;

  const rows = await db
    .select({ providerId: inquiries.providerId, buyerUserId: inquiries.buyerUserId })
    .from(inquiries)
    .where(eq(inquiries.id, inquiryId))
    .limit(1);
  if (!rows.length) return;

  const memberships = await db
    .select({ providerId: providerMembers.providerId })
    .from(providerMembers)
    .where(eq(providerMembers.userId, user.id));

  const allowed =
    rows[0].buyerUserId === user.id ||
    memberships.some((m) => m.providerId === rows[0].providerId);
  if (!allowed) return;

  await db
    .update(inquiries)
    .set({ status: status as "closed" | "spam" | "replied", updatedAt: new Date() })
    .where(eq(inquiries.id, inquiryId));

  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
  revalidatePath(`/inbox/${inquiryId}`);
}
