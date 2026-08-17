import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Alert, Badge, Card, PageHeader, Stars } from "@/components/ui";
import { MessageThread } from "@/components/message-thread";
import { ReviewForm } from "@/components/review-form";
import { getCurrentUser } from "@/lib/auth";
import { getInquiryThread } from "@/lib/inbox";
import { getProviderContact } from "@/lib/queries";
import {
  formatDate,
  maskEmailFromParts,
  maskPhoneFromTail,
} from "@/lib/format";

export const metadata: Metadata = { title: "Conversation" };

type Props = { params: Promise<{ id: string }> };

export default async function InboxThreadPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/inbox/${id}`);

  const thread = await getInquiryThread(id);
  if (!thread) notFound();
  if (thread.inquiry.buyerUserId !== user.id) notFound();

  const { inquiry, listing, provider, messages, review } = thread;
  const unlocked = Boolean(inquiry.contactUnlockedAt);
  const contact = unlocked ? await getProviderContact(provider.id) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <PageHeader
          title={listing.title}
          description={
            <>
              With{" "}
              <Link
                href={`/providers/${provider.slug}`}
                className="font-medium text-brand-600 hover:underline"
              >
                {provider.displayName}
              </Link>{" "}
              · started {formatDate(inquiry.createdAt)}
            </>
          }
        />

        <Card>
          <MessageThread
            inquiryId={inquiry.id}
            currentUserId={user.id}
            canReply={inquiry.status !== "closed" && inquiry.status !== "spam"}
            messages={messages.map((m) => ({
              id: m.message.id,
              body: m.message.body,
              createdAt: m.message.createdAt,
              senderName: m.senderName,
              senderId: m.senderId,
            }))}
          />
        </Card>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Leave a review</h2>
          {review ? (
            <Card>
              <Stars value={review.rating} />
              {review.title && <p className="mt-2 font-medium text-ink">{review.title}</p>}
              <p className="mt-1 text-sm text-ink-muted">{review.body}</p>
              <p className="mt-2 text-xs text-ink-muted">
                Posted {formatDate(review.createdAt)}
              </p>
            </Card>
          ) : unlocked ? (
            <Card>
              <ReviewForm inquiryId={inquiry.id} />
            </Card>
          ) : (
            <Alert tone="info">
              You can review {provider.displayName} once they reply here. Tying reviews to
              a real reply is what keeps the ratings on this site worth reading.
            </Alert>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-semibold text-ink">Provider contact</h2>
          {unlocked && contact ? (
            <ul className="mt-2 space-y-1 text-sm">
              {contact.contactPhone && (
                <li>
                  <a
                    href={`tel:${contact.contactPhone}`}
                    className="text-brand-600 hover:underline"
                  >
                    {contact.contactPhone}
                  </a>
                </li>
              )}
              {contact.contactEmail && (
                <li>
                  <a
                    href={`mailto:${contact.contactEmail}`}
                    className="text-brand-600 hover:underline"
                  >
                    {contact.contactEmail}
                  </a>
                </li>
              )}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-ink-muted">
              <p>{maskPhoneFromTail(provider.phoneTail) ?? "Phone on file"}</p>
              <p>
                {maskEmailFromParts(provider.emailHead, provider.emailDomain) ??
                  "Email on file"}
              </p>
              <p className="mt-2 text-xs">Unlocks when they reply.</p>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-ink">Status</h2>
          <div className="mt-2">
            <Badge tone={inquiry.status === "new" ? "warning" : "success"}>
              {inquiry.status === "new" ? "Awaiting reply" : inquiry.status}
            </Badge>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Keep quotes and scheduling in this thread. If a provider asks you to move to
            a wire transfer or gift cards, report it.
          </p>
        </Card>
      </aside>
    </div>
  );
}
