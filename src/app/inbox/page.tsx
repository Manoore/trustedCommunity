import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getBuyerInquiries } from "@/lib/inbox";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Your inbox" };

const statusTone = {
  new: "warning",
  replied: "success",
  closed: "neutral",
  spam: "danger",
} as const;

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/inbox");

  const rows = await getBuyerInquiries(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your inbox"
        description="Inquiries you sent. Provider contact details unlock here once they reply."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No inquiries yet"
          description="When you contact a provider, the conversation shows up here."
          action={<LinkButton href="/search">Find a provider</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {rows.map(({ inquiry, listingTitle, providerName, providerSlug }) => (
            <Card key={inquiry.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[inquiry.status]}>
                      {inquiry.status === "new" ? "Awaiting reply" : inquiry.status}
                    </Badge>
                    {inquiry.contactUnlockedAt && (
                      <Badge tone="brand">Contact unlocked</Badge>
                    )}
                  </div>
                  <h2 className="mt-2 font-semibold text-ink">
                    <Link href={`/inbox/${inquiry.id}`} className="hover:underline">
                      {listingTitle}
                    </Link>
                  </h2>
                  <p className="text-sm text-ink-muted">
                    <Link href={`/providers/${providerSlug}`} className="hover:underline">
                      {providerName}
                    </Link>{" "}
                    · updated {timeAgo(inquiry.updatedAt)}
                  </p>
                </div>
                <Link
                  href={`/inbox/${inquiry.id}`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  Open →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
