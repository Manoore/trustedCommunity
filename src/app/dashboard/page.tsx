import Link from "next/link";
import type { Metadata } from "next";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inquiries, listings } from "@/db/schema";
import { Alert, Badge, Card, LinkButton, PageHeader, Stars } from "@/components/ui";
import { requireProvider } from "@/lib/guards";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { provider, membership } = await requireProvider("/dashboard");

  const [listingStats] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) FILTER (WHERE status = 'active')::int`,
      pending: sql<number>`count(*) FILTER (WHERE status = 'pending')::int`,
      views: sql<number>`COALESCE(sum(view_count), 0)::int`,
    })
    .from(listings)
    .where(eq(listings.providerId, provider.id));

  const [inquiryStats] = await db
    .select({
      total: count(),
      unanswered: sql<number>`count(*) FILTER (WHERE status = 'new')::int`,
    })
    .from(inquiries)
    .where(eq(inquiries.providerId, provider.id));

  const recent = await db
    .select({
      id: inquiries.id,
      buyerName: inquiries.buyerName,
      status: inquiries.status,
      createdAt: inquiries.createdAt,
      listingTitle: listings.title,
    })
    .from(inquiries)
    .innerJoin(listings, eq(listings.id, inquiries.listingId))
    .where(eq(inquiries.providerId, provider.id))
    .orderBy(sql`${inquiries.createdAt} DESC`)
    .limit(5);

  const [pendingListings] = await db
    .select({ n: count() })
    .from(listings)
    .where(and(eq(listings.providerId, provider.id), eq(listings.status, "pending")));

  return (
    <div className="space-y-6">
      <PageHeader
        title={provider.displayName}
        description={
          <>
            {provider.type === "entity" ? "Business account" : "Individual account"} ·{" "}
            <Link
              href={`/providers/${provider.slug}`}
              className="font-medium text-brand-600 hover:underline"
            >
              View public profile
            </Link>
          </>
        }
        action={<LinkButton href="/dashboard/listings/new">New listing</LinkButton>}
      />

      {Number(pendingListings?.n ?? 0) > 0 && (
        <Alert tone="info">
          {pendingListings.n} listing(s) are waiting on licence review before they appear
          in search.
        </Alert>
      )}

      {Number(inquiryStats?.unanswered ?? 0) > 0 && (
        <Alert tone="info">
          {inquiryStats.unanswered} unanswered{" "}
          {inquiryStats.unanswered === 1 ? "inquiry" : "inquiries"}. Replying is also what
          releases your contact details to that buyer.{" "}
          <Link href="/dashboard/inquiries" className="font-medium underline">
            Open inbox
          </Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active listings", value: listingStats?.active ?? 0 },
          { label: "Total views", value: listingStats?.views ?? 0 },
          { label: "Inquiries", value: inquiryStats?.total ?? 0 },
          { label: "Unanswered", value: inquiryStats?.unanswered ?? 0 },
        ].map((stat) => (
          <Card key={stat.label}>
            <p className="text-sm text-ink-muted">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">Rating</h2>
          <Stars value={provider.ratingAvg} count={provider.ratingCount} />
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Reviews can only be left by buyers whose inquiry you replied to. Fast replies
          are the only way to build this number.
        </p>
      </Card>

      <section>
        <h2 className="mb-3 font-semibold text-ink">Recent inquiries</h2>
        {recent.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">
              No inquiries yet. New listings take time to surface — make sure your
              category and service radius are right.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      <Link
                        href={`/dashboard/inquiries/${item.id}`}
                        className="hover:underline"
                      >
                        {item.buyerName}
                      </Link>
                    </p>
                    <p className="text-sm text-ink-muted">
                      {item.listingTitle} · {timeAgo(item.createdAt)}
                    </p>
                  </div>
                  <Badge tone={item.status === "new" ? "warning" : "success"}>
                    {item.status === "new" ? "Needs reply" : item.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-ink-muted">
        Signed in as {membership.role}. NearSide does not set your prices, schedule, or
        methods — you are an independent business.
      </p>
    </div>
  );
}
