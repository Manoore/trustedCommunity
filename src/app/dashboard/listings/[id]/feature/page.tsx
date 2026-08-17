import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Alert, Button, Card, PageHeader } from "@/components/ui";
import { FeatureCheckoutButton } from "@/components/feature-checkout-button";
import { grantFeaturedForDevAction } from "@/app/actions/billing";
import { getListingById } from "@/lib/queries";
import { requireProvider } from "@/lib/guards";
import { featuredDays, featuredPriceCents, isStripeEnabled } from "@/lib/stripe";
import { formatCents } from "@/lib/format";

export const metadata: Metadata = { title: "Feature this listing" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ canceled?: string }>;
};

export default async function FeatureListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { canceled } = await searchParams;
  const { provider } = await requireProvider(`/dashboard/listings/${id}/feature`);

  const data = await getListingById(id);
  if (!data || data.listing.providerId !== provider.id) notFound();

  const price = featuredPriceCents();
  const days = featuredDays();
  const stripeOn = isStripeEnabled();
  const devMode = process.env.NODE_ENV !== "production" && !stripeOn;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Feature this listing"
        description={data.listing.title}
      />

      {canceled && <Alert tone="info">Checkout canceled. Nothing was charged.</Alert>}

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink">Featured placement</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {days} days at the top of search results in your categories, with a
              Featured badge.
            </p>
          </div>
          <p className="text-2xl font-semibold text-ink">{formatCents(price)}</p>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-ink-muted">
          <li>Sorted above non-featured listings for every matching search.</li>
          <li>Badge shown on the listing card and detail page.</li>
          <li>One-time charge. It does not renew on its own.</li>
          <li>Buying again while active extends the window rather than replacing it.</li>
        </ul>

        <div className="mt-6">
          {stripeOn ? (
            <FeatureCheckoutButton listingId={data.listing.id} />
          ) : devMode ? (
            <div className="space-y-3">
              <Alert tone="info">
                No Stripe key is set, so checkout is disabled. In development you can
                grant the window directly to test the flow.
              </Alert>
              <form action={grantFeaturedForDevAction}>
                <input type="hidden" name="listingId" value={data.listing.id} />
                <Button type="submit" variant="secondary">
                  Grant {days} days (development only)
                </Button>
              </form>
            </div>
          ) : (
            <Alert tone="error">
              Payments are not configured on this deployment. Set STRIPE_SECRET_KEY and
              STRIPE_WEBHOOK_SECRET to enable checkout.
            </Alert>
          )}
        </div>
      </Card>

      <p className="text-xs text-ink-muted">
        Featured placement changes ordering only. It does not change how buyers rate you,
        and it is labelled as paid placement wherever it appears.
      </p>
    </div>
  );
}
