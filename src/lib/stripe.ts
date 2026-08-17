import "server-only";

import Stripe from "stripe";

/**
 * Stripe is optional. With no secret key configured the checkout path stays
 * disabled and the UI says so, rather than crashing at request time. That keeps
 * the app runnable before anyone has signed up for a payments account.
 */
export function isStripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export function featuredPriceCents() {
  return Number(process.env.FEATURED_LISTING_PRICE_CENTS ?? 2900);
}

export function featuredDays() {
  return Number(process.env.FEATURED_LISTING_DAYS ?? 30);
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
