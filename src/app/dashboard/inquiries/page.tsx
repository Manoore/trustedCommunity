import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requireProvider } from "@/lib/guards";
import { getProviderInquiries } from "@/lib/inbox";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Inquiries" };

export default async function ProviderInquiriesPage() {
  const { provider } = await requireProvider("/dashboard/inquiries");
  const rows = await getProviderInquiries(provider.id);

  const needsReply = rows.filter((r) => r.inquiry.status === "new");
  const rest = rows.filter((r) => r.inquiry.status !== "new");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inquiries"
        description="Replying releases your phone and email to that buyer, and opens them up to leave a review."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No inquiries yet"
          description="Buyers reach you through your listings. Check that your category and travel radius match the work you want."
          action={<LinkButton href="/dashboard/listings">Review your listings</LinkButton>}
        />
      ) : (
        <>
          {needsReply.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Needs a reply ({needsReply.length})
              </h2>
              <div className="space-y-2">
                {needsReply.map((row) => (
                  <InquiryRow key={row.inquiry.id} row={row} />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Everything else
              </h2>
              <div className="space-y-2">
                {rest.map((row) => (
                  <InquiryRow key={row.inquiry.id} row={row} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

type Row = Awaited<ReturnType<typeof getProviderInquiries>>[number];

function InquiryRow({ row }: { row: Row }) {
  const { inquiry, listingTitle, buyerName } = row;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={inquiry.status === "new" ? "warning" : "success"}>
              {inquiry.status === "new" ? "Needs reply" : inquiry.status}
            </Badge>
            {inquiry.buyerZip && <Badge tone="neutral">ZIP {inquiry.buyerZip}</Badge>}
          </div>
          <h3 className="mt-2 font-semibold text-ink">
            <Link
              href={`/dashboard/inquiries/${inquiry.id}`}
              className="hover:underline"
            >
              {buyerName}
            </Link>
          </h3>
          <p className="text-sm text-ink-muted">
            {listingTitle} · {timeAgo(inquiry.createdAt)}
          </p>
        </div>
        <Link
          href={`/dashboard/inquiries/${inquiry.id}`}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Open →
        </Link>
      </div>
    </Card>
  );
}
