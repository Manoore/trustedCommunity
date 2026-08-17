"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { featuredOrders, listings } from "@/db/schema";
import { assertProviderAccess, getCurrentUser } from "@/lib/auth";
import {
  featuredDays,
  featuredPriceCents,
  getStripe,
  isStripeEnabled,
  siteUrl,
} from "@/lib/stripe";
import type { ActionState } from "@/lib/validation";

/** Extends (or starts) a listing's featured window. */
export async function applyFeaturedWindow(listingId: string, days: number) {
  const [listing] = await db
    .select({ featuredUntil: listings.featuredUntil })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!listing) return null;

  const now = new Date();
  const base =
    listing.featuredUntil && new Date(listing.featuredUntil) > now
      ? new Date(listing.featuredUntil)
      : now;
  const endsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await db
    .update(listings)
    .set({ featuredUntil: endsAt, updatedAt: now })
    .where(eq(listings.id, listingId));

  return { startsAt: now, endsAt };
}

export async function startFeatureCheckoutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const listingId = String(formData.get("listingId") ?? "");
  const [listing] = await db
    .select({
      id: listings.id,
      title: listings.title,
      providerId: listings.providerId,
      status: listings.status,
    })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!listing) return { ok: false, message: "That listing no longer exists." };

  try {
    await assertProviderAccess(user.id, listing.providerId, ["owner", "manager"]);
  } catch {
    return { ok: false, message: "You cannot buy placement for this listing." };
  }

  if (listing.status !== "active") {
    return { ok: false, message: "Only live listings can be featured." };
  }

  if (!isStripeEnabled()) {
    return {
      ok: false,
      message:
        "Payments are not configured on this deployment. Set STRIPE_SECRET_KEY to enable checkout.",
    };
  }

  const amountCents = featuredPriceCents();
  const days = featuredDays();

  const [order] = await db
    .insert(featuredOrders)
    .values({ listingId: listing.id, userId: user.id, amountCents, days })
    .returning({ id: featuredOrders.id });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `Featured placement — ${listing.title}`,
            description: `${days} days of featured placement in search results.`,
          },
        },
      },
    ],
    // The order id is the join back to our row when the webhook fires.
    client_reference_id: order.id,
    metadata: { orderId: order.id, listingId: listing.id },
    success_url: `${siteUrl()}/dashboard/listings?featured=1`,
    cancel_url: `${siteUrl()}/dashboard/listings/${listing.id}/feature?canceled=1`,
  });

  await db
    .update(featuredOrders)
    .set({ stripeSessionId: session.id })
    .where(eq(featuredOrders.id, order.id));

  if (!session.url) return { ok: false, message: "Stripe did not return a checkout URL." };
  redirect(session.url);
}

/**
 * Development-only shortcut so the featured flow can be exercised without a
 * Stripe account. Refuses to run in production, and refuses whenever real
 * Stripe keys are present.
 */
export async function grantFeaturedForDevAction(formData: FormData) {
  if (process.env.NODE_ENV === "production" || isStripeEnabled()) return;

  const user = await getCurrentUser();
  if (!user) return;

  const listingId = String(formData.get("listingId") ?? "");
  const [listing] = await db
    .select({ providerId: listings.providerId })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!listing) return;

  try {
    await assertProviderAccess(user.id, listing.providerId, ["owner", "manager"]);
  } catch {
    return;
  }

  const days = featuredDays();
  const window = await applyFeaturedWindow(listingId, days);

  await db.insert(featuredOrders).values({
    listingId,
    userId: user.id,
    amountCents: 0,
    days,
    status: "paid",
    startsAt: window?.startsAt,
    endsAt: window?.endsAt,
  });

  revalidatePath("/dashboard/listings");
  redirect("/dashboard/listings?featured=1");
}
