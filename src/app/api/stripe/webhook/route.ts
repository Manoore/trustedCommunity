import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { featuredOrders } from "@/db/schema";
import { applyFeaturedWindow } from "@/app/actions/billing";
import { getStripe, isStripeEnabled } from "@/lib/stripe";

/**
 * Stripe webhook. The signature check is the whole security model here: anyone
 * can POST to this URL, so an unverified body must never move money-adjacent
 * state. Featured placement is granted here and nowhere else in the paid path,
 * so a cancelled or failed payment cannot leave a listing promoted.
 */
export async function POST(request: Request) {
  if (!isStripeEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = session.client_reference_id ?? session.metadata?.orderId;
      if (!orderId) break;

      const [order] = await db
        .select()
        .from(featuredOrders)
        .where(eq(featuredOrders.id, orderId))
        .limit(1);

      // Stripe retries on failure, so this has to be safe to run twice.
      if (!order || order.status === "paid") break;

      const window = await applyFeaturedWindow(order.listingId, order.days);

      await db
        .update(featuredOrders)
        .set({
          status: "paid",
          startsAt: window?.startsAt,
          endsAt: window?.endsAt,
        })
        .where(eq(featuredOrders.id, order.id));
      break;
    }

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      const orderId = session.client_reference_id ?? session.metadata?.orderId;
      if (!orderId) break;
      await db
        .update(featuredOrders)
        .set({ status: "failed" })
        .where(eq(featuredOrders.id, orderId));
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
