import "server-only";

import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  inquiries,
  inquiryMessages,
  listings,
  providers,
  reviews,
  users,
} from "@/db/schema";
import { providerPublicColumns } from "@/lib/queries";

export async function getBuyerInquiries(userId: string) {
  return db
    .select({
      inquiry: inquiries,
      listingTitle: listings.title,
      listingSlug: listings.slug,
      providerName: providers.displayName,
      providerSlug: providers.slug,
    })
    .from(inquiries)
    .innerJoin(listings, eq(listings.id, inquiries.listingId))
    .innerJoin(providers, eq(providers.id, inquiries.providerId))
    .where(eq(inquiries.buyerUserId, userId))
    .orderBy(desc(inquiries.updatedAt));
}

export async function getProviderInquiries(providerId: string) {
  return db
    .select({
      inquiry: inquiries,
      listingTitle: listings.title,
      listingSlug: listings.slug,
      buyerName: users.name,
    })
    .from(inquiries)
    .innerJoin(listings, eq(listings.id, inquiries.listingId))
    .innerJoin(users, eq(users.id, inquiries.buyerUserId))
    .where(eq(inquiries.providerId, providerId))
    .orderBy(desc(inquiries.updatedAt));
}

export async function getInquiryThread(inquiryId: string) {
  const rows = await db
    .select({
      inquiry: inquiries,
      listing: listings,
      // Masked projection only - the thread page fetches the real details
      // separately, and only once the provider has replied.
      provider: providerPublicColumns,
      buyerName: users.name,
      buyerEmail: users.email,
    })
    .from(inquiries)
    .innerJoin(listings, eq(listings.id, inquiries.listingId))
    .innerJoin(providers, eq(providers.id, inquiries.providerId))
    .innerJoin(users, eq(users.id, inquiries.buyerUserId))
    .where(eq(inquiries.id, inquiryId))
    .limit(1);

  if (!rows.length) return null;

  const messages = await db
    .select({
      message: inquiryMessages,
      senderName: users.name,
      senderId: users.id,
    })
    .from(inquiryMessages)
    .innerJoin(users, eq(users.id, inquiryMessages.senderUserId))
    .where(eq(inquiryMessages.inquiryId, inquiryId))
    .orderBy(asc(inquiryMessages.createdAt));

  const existingReview = await db
    .select()
    .from(reviews)
    .where(eq(reviews.inquiryId, inquiryId))
    .limit(1);

  return { ...rows[0], messages, review: existingReview[0] ?? null };
}
