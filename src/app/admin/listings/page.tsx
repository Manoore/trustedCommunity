import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, listings, providers } from "@/db/schema";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
} from "@/components/ui";
import { setListingModerationAction } from "@/app/actions/admin";
import { locationLabel, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Listings — admin" };

const STATUSES = ["pending", "active", "suspended", "rejected", "paused", "draft"] as const;
type Status = (typeof STATUSES)[number];

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminListingsPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const active: Status = STATUSES.includes(status as Status)
    ? (status as Status)
    : "pending";

  const rows = await db
    .select({
      listing: listings,
      providerName: providers.displayName,
      providerSlug: providers.slug,
      categoryName: categories.name,
      licenseRequired: categories.licenseRequired,
    })
    .from(listings)
    .innerJoin(providers, eq(providers.id, listings.providerId))
    .innerJoin(categories, eq(categories.id, listings.categoryId))
    .where(eq(listings.status, active))
    .orderBy(desc(listings.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader title="Listings" description="Filter by state and act on anything wrong." />

      <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/listings?status=${s}`}
            className={[
              "rounded-lg border px-3 py-1.5 text-sm",
              s === active
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-line-strong text-ink-muted hover:bg-surface-sunken",
            ].join(" ")}
          >
            {s}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title={`No ${active} listings`} />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.listing.id} className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{row.categoryName}</Badge>
                  {row.licenseRequired && <Badge tone="warning">Licensed trade</Badge>}
                </div>
                <h2 className="mt-2 font-semibold text-ink">
                  <Link
                    href={`/listings/${row.listing.slug}`}
                    className="hover:underline"
                  >
                    {row.listing.title}
                  </Link>
                </h2>
                <p className="text-sm text-ink-muted">
                  <Link
                    href={`/providers/${row.providerSlug}`}
                    className="hover:underline"
                  >
                    {row.providerName}
                  </Link>{" "}
                  · {locationLabel(row.listing, row.listing.remoteOk)} ·{" "}
                  {timeAgo(row.listing.createdAt)}
                </p>
                {row.listing.licenseNumber && (
                  <p className="mt-1 text-sm text-ink">
                    Licence <span className="font-mono">{row.listing.licenseNumber}</span>
                    {row.listing.licenseState && <> ({row.listing.licenseState})</>}
                  </p>
                )}
                {row.listing.rejectionReason && (
                  <p className="mt-1 text-sm text-red-700">
                    {row.listing.rejectionReason}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                {active !== "active" && (
                  <form action={setListingModerationAction}>
                    <input type="hidden" name="listingId" value={row.listing.id} />
                    <input type="hidden" name="status" value="active" />
                    <Button type="submit" size="sm">
                      Publish
                    </Button>
                  </form>
                )}
                <form action={setListingModerationAction} className="flex gap-2">
                  <input type="hidden" name="listingId" value={row.listing.id} />
                  <input type="hidden" name="status" value="suspended" />
                  <Input name="reason" placeholder="Reason" className="w-56" />
                  <Button type="submit" variant="danger" size="sm">
                    Suspend
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
