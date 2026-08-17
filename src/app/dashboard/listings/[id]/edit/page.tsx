import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { listingMedia } from "@/db/schema";
import { Alert, Button, Card, PageHeader } from "@/components/ui";
import { ListingForm } from "@/components/listing-form";
import { deleteListingAction, updateListingAction } from "@/app/actions/listings";
import { getCategoryOptions, getListingById } from "@/lib/queries";
import { requireProvider } from "@/lib/guards";

export const metadata: Metadata = { title: "Edit listing" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function EditListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  const { provider } = await requireProvider(`/dashboard/listings/${id}/edit`);

  const data = await getListingById(id);
  if (!data || data.listing.providerId !== provider.id) notFound();

  const [groups, media] = await Promise.all([
    getCategoryOptions(),
    db.select().from(listingMedia).where(eq(listingMedia.listingId, id)),
  ]);

  const { listing } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Edit listing"
        description={
          <Link
            href={`/listings/${listing.slug}`}
            className="font-medium text-brand-600 hover:underline"
          >
            View public page
          </Link>
        }
      />

      {created && (
        <Alert tone="success">
          Listing created.
          {listing.status === "pending"
            ? " It stays in review until an admin verifies your licence number."
            : " It is live in search now."}
        </Alert>
      )}

      <ListingForm
        action={updateListingAction}
        groups={groups}
        providerId={provider.id}
        submitLabel="Save changes"
        defaults={{
          id: listing.id,
          categoryId: listing.categoryId,
          title: listing.title,
          description: listing.description,
          priceType: listing.priceType,
          priceMinCents: listing.priceMinCents,
          priceMaxCents: listing.priceMaxCents,
          remoteOk: listing.remoteOk,
          zip: listing.zip,
          serviceRadiusMiles: listing.serviceRadiusMiles,
          licenseNumber: listing.licenseNumber,
          licenseState: listing.licenseState,
          media: media.map((m) => ({ id: m.id, url: m.url, alt: m.alt })),
        }}
      />

      <Card className="border-red-200">
        <h2 className="font-semibold text-ink">Delete this listing</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Permanent. Its inquiries and reviews go with it.
        </p>
        <form action={deleteListingAction} className="mt-3">
          <input type="hidden" name="listingId" value={listing.id} />
          <Button type="submit" variant="danger" size="sm">
            Delete listing
          </Button>
        </form>
      </Card>
    </div>
  );
}
