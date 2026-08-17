import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, listings } from "@/db/schema";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { setListingStatusAction } from "@/app/actions/listings";
import { requireProvider } from "@/lib/guards";
import { formatPrice, locationLabel, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Your listings" };

const statusTone = {
  active: "success",
  pending: "warning",
  paused: "neutral",
  draft: "neutral",
  rejected: "danger",
  suspended: "danger",
} as const;

export default async function DashboardListingsPage() {
  const { provider } = await requireProvider("/dashboard/listings");

  const rows = await db
    .select({ listing: listings, categoryName: categories.name })
    .from(listings)
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(eq(listings.providerId, provider.id))
    .orderBy(desc(listings.createdAt));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your listings"
        description="Each listing is one service in one category. Separate services get separate listings."
        action={<LinkButton href="/dashboard/listings/new">New listing</LinkButton>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No listings yet"
          description="Post your first service to start showing up in search."
          action={<LinkButton href="/dashboard/listings/new">Create a listing</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {rows.map(({ listing, categoryName }) => {
            const featured =
              listing.featuredUntil != null &&
              new Date(listing.featuredUntil) > new Date();
            const lockedByAdmin =
              listing.status === "suspended" || listing.status === "pending";

            return (
              <Card key={listing.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone[listing.status]}>{listing.status}</Badge>
                      {featured && <Badge tone="featured">Featured</Badge>}
                      <Badge tone="neutral">{categoryName}</Badge>
                    </div>
                    <h2 className="mt-2 font-semibold text-ink">
                      <Link
                        href={`/dashboard/listings/${listing.id}/edit`}
                        className="hover:underline"
                      >
                        {listing.title}
                      </Link>
                    </h2>
                    <p className="text-sm text-ink-muted">
                      {locationLabel(listing, listing.remoteOk)} ·{" "}
                      {formatPrice(listing)} · {listing.viewCount} views ·{" "}
                      {listing.inquiryCount} inquiries · updated{" "}
                      {timeAgo(listing.updatedAt)}
                    </p>
                    {listing.status === "pending" && (
                      <p className="mt-1 text-sm text-amber-700">
                        Waiting on licence verification before it goes live.
                      </p>
                    )}
                    {listing.rejectionReason && (
                      <p className="mt-1 text-sm text-red-700">
                        {listing.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <LinkButton
                      href={`/listings/${listing.slug}`}
                      variant="ghost"
                      size="sm"
                    >
                      View
                    </LinkButton>
                    <LinkButton
                      href={`/dashboard/listings/${listing.id}/edit`}
                      variant="secondary"
                      size="sm"
                    >
                      Edit
                    </LinkButton>
                    {!lockedByAdmin && (
                      <form action={setListingStatusAction}>
                        <input type="hidden" name="listingId" value={listing.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={listing.status === "active" ? "paused" : "active"}
                        />
                        <Button type="submit" variant="ghost" size="sm">
                          {listing.status === "active" ? "Pause" : "Publish"}
                        </Button>
                      </form>
                    )}
                    {!featured && listing.status === "active" && (
                      <LinkButton
                        href={`/dashboard/listings/${listing.id}/feature`}
                        size="sm"
                      >
                        Feature
                      </LinkButton>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
