import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";
import { MessageThread } from "@/components/message-thread";
import { setInquiryStatusAction } from "@/app/actions/inquiries";
import { requireProvider } from "@/lib/guards";
import { getInquiryThread } from "@/lib/inbox";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Inquiry" };

type Props = { params: Promise<{ id: string }> };

export default async function ProviderInquiryPage({ params }: Props) {
  const { id } = await params;
  const { user, provider } = await requireProvider(`/dashboard/inquiries/${id}`);

  const thread = await getInquiryThread(id);
  if (!thread || thread.inquiry.providerId !== provider.id) notFound();

  const { inquiry, listing, messages } = thread;
  const closed = inquiry.status === "closed" || inquiry.status === "spam";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <PageHeader
          title={inquiry.buyerName}
          description={
            <>
              About{" "}
              <Link
                href={`/listings/${listing.slug}`}
                className="font-medium text-brand-600 hover:underline"
              >
                {listing.title}
              </Link>{" "}
              · {formatDate(inquiry.createdAt)}
            </>
          }
        />

        {!inquiry.contactUnlockedAt && (
          <Alert tone="info">
            Your phone and email are still masked to this buyer. They unlock the moment
            you send a reply.
          </Alert>
        )}

        <Card>
          <MessageThread
            inquiryId={inquiry.id}
            currentUserId={user.id}
            canReply={!closed}
            replyHint={
              inquiry.contactUnlockedAt
                ? undefined
                : "Sending this reply also releases your contact details to this buyer."
            }
            messages={messages.map((m) => ({
              id: m.message.id,
              body: m.message.body,
              createdAt: m.message.createdAt,
              senderName: m.senderName,
              senderId: m.senderId,
            }))}
          />
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-semibold text-ink">Buyer details</h2>
          <dl className="mt-2 space-y-2 text-sm">
            <div>
              <dt className="text-ink-muted">Name</dt>
              <dd className="text-ink">{inquiry.buyerName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd>
                <a
                  href={`mailto:${inquiry.buyerEmail}`}
                  className="text-brand-600 hover:underline"
                >
                  {inquiry.buyerEmail}
                </a>
              </dd>
            </div>
            {inquiry.buyerPhone && (
              <div>
                <dt className="text-ink-muted">Phone</dt>
                <dd>
                  <a
                    href={`tel:${inquiry.buyerPhone}`}
                    className="text-brand-600 hover:underline"
                  >
                    {inquiry.buyerPhone}
                  </a>
                </dd>
              </div>
            )}
            {inquiry.buyerZip && (
              <div>
                <dt className="text-ink-muted">ZIP</dt>
                <dd className="text-ink">{inquiry.buyerZip}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-ink">Status</h2>
          <div className="mt-2">
            <Badge tone={inquiry.status === "new" ? "warning" : "success"}>
              {inquiry.status}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={setInquiryStatusAction}>
              <input type="hidden" name="inquiryId" value={inquiry.id} />
              <input type="hidden" name="status" value="closed" />
              <Button type="submit" variant="secondary" size="sm">
                Mark closed
              </Button>
            </form>
            <form action={setInquiryStatusAction}>
              <input type="hidden" name="inquiryId" value={inquiry.id} />
              <input type="hidden" name="status" value="spam" />
              <Button type="submit" variant="ghost" size="sm">
                Mark spam
              </Button>
            </form>
          </div>
        </Card>
      </aside>
    </div>
  );
}
