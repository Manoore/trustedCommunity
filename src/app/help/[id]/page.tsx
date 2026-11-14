import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { CompleteForm, RespondForm } from "@/components/help-response-forms";
import { DirectionBadge, TrustLine, formatDateRange } from "@/components/help-ui";
import { ReportForm } from "@/components/report-form";
import {
  cancelResponseAction,
  closePostAction,
  decideResponseAction,
} from "@/app/actions/help";
import { getCurrentUser } from "@/lib/auth";
import { isVerifiedMember } from "@/lib/colleges";
import {
  ACCOMMODATION_KINDS,
  KIND_EMOJI,
  KIND_LABELS,
  getEndorsements,
  getHelpPost,
  getPosterContact,
  getResponses,
  type ResponseView,
} from "@/lib/help";
import { SAFETY_RULES } from "@/lib/arrival";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Help post" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ posted?: string }>;
};

const STATUS_TONE = {
  pending: "warning",
  accepted: "success",
  completed: "brand",
  declined: "neutral",
  cancelled: "neutral",
} as const;

function ContactBox({ email, phone }: { email: string; phone: string | null }) {
  return (
    <div className="rounded-xl bg-brand-50 p-4 text-sm">
      <p className="font-semibold text-brand-800">Their contact details</p>
      <ul className="mt-1 space-y-1">
        <li>
          <a href={`mailto:${email}`} className="text-brand-700 underline">
            {email}
          </a>
        </li>
        {phone && (
          <li>
            <a href={`tel:${phone}`} className="text-brand-700 underline">
              {phone}
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}

export default async function HelpPostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { posted } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/help/${id}`);

  const post = await getHelpPost(id, user.id);
  if (!post) notFound();

  // Posts belong to a college's community. Outsiders get a 404, not a hint.
  const member = await isVerifiedMember(user.id, post.collegeId);
  if (!member && user.role !== "admin") notFound();
  if (post.status === "suspended" && !post.isMine && user.role !== "admin") notFound();

  const [responses, endorsements, posterContact] = await Promise.all([
    getResponses(post.id, user.id, post.poster.id),
    getEndorsements(post.poster.id),
    post.isMine ? Promise.resolve(null) : getPosterContact(post.id, user.id),
  ]);

  const accommodation = ACCOMMODATION_KINDS.includes(post.kind);
  const when = formatDateRange(post.startsOn, post.endsOn);
  const spotsLeft = Math.max(post.capacity - post.acceptedCount, 0);
  const myResponse: ResponseView | undefined = post.isMine
    ? undefined
    : responses.find((r) => r.responder.id === user.id);

  const canRespond =
    !post.isMine && member && post.status === "open" && !myResponse && spotsLeft > 0;

  // The newcomer is whoever is being helped: the responder on an offer, the poster on a need.
  const posterIsNewcomer = post.direction === "need";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {posted && post.isMine && (
        <Alert tone="success">
          Posted. Verified students at your college can see it now, and anyone who has asked for
          the same kind of help has been told.
        </Alert>
      )}

      <section className="warm-wash rounded-3xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center gap-2">
          <DirectionBadge direction={post.direction} />
          <Badge tone="neutral">
            <span aria-hidden="true">{KIND_EMOJI[post.kind]}</span> {KIND_LABELS[post.kind]}
          </Badge>
          {post.status !== "open" && <Badge tone="neutral">{post.status}</Badge>}
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{post.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {[post.area, when, `posted ${timeAgo(post.createdAt)}`].filter(Boolean).join(" · ")}
          {post.direction === "offer" &&
            post.capacity > 1 &&
            ` · ${spotsLeft} of ${post.capacity} spots left`}
        </p>
        <div className="mt-4">
          <TrustLine card={post.poster} size="md" />
        </div>
        {endorsements.length > 0 && (
          <ul className="mt-4 space-y-2">
            {endorsements.map((e, i) => (
              <li key={i} className="rounded-xl bg-surface-sunken px-4 py-2 text-sm italic text-ink">
                “{e.text}” <span className="not-italic text-ink-muted">— {e.from}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {post.details && (
        <Card>
          <h2 className="text-sm font-semibold text-ink">Details</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{post.details}</p>
        </Card>
      )}

      {accommodation && (
        <Card className="border-amber-300 bg-amber-50/60">
          <h2 className="font-semibold text-ink">Staying with someone? Read this first.</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
            {SAFETY_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* --------------------------------------------- the person responding */}
      {canRespond && (
        <Card>
          <h2 className="font-semibold text-ink">
            {post.direction === "need" ? "Can you help?" : "Interested?"}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {post.poster.name} will see your name and what you write. Contact details are only
            shared if they accept.
          </p>
          <div className="mt-4">
            <RespondForm postId={post.id} direction={post.direction} />
          </div>
        </Card>
      )}

      {myResponse && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-ink">Your response</h2>
            <Badge tone={STATUS_TONE[myResponse.status]}>{myResponse.status}</Badge>
          </div>
          {myResponse.message && (
            <p className="text-sm text-ink-muted">“{myResponse.message}”</p>
          )}

          {myResponse.status === "pending" && (
            <p className="text-sm text-ink-muted">
              Waiting on {post.poster.name}. You will be told as soon as they answer.
            </p>
          )}

          {(myResponse.status === "accepted" || myResponse.status === "completed") &&
            posterContact && (
              <ContactBox email={posterContact.email} phone={posterContact.phone} />
            )}

          {myResponse.status === "accepted" && !posterIsNewcomer && (
            <CompleteForm responseId={myResponse.id} />
          )}

          {myResponse.status === "completed" && myResponse.endorsement && (
            <p className="text-sm italic text-ink">“{myResponse.endorsement}”</p>
          )}

          {["pending", "accepted"].includes(myResponse.status) && (
            <form action={cancelResponseAction}>
              <input type="hidden" name="responseId" value={myResponse.id} />
              <Button type="submit" variant="ghost" size="sm">
                I can no longer do this
              </Button>
            </form>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------- the poster */}
      {post.isMine && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">
            Responses ({responses.length})
          </h2>

          {responses.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-muted">
                Nobody has responded yet. Everyone at your college who posted the matching kind
                of help has been told.
              </p>
            </Card>
          ) : (
            responses.map((r) => (
              <Card key={r.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <TrustLine card={r.responder} />
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                </div>
                {r.message && <p className="text-sm text-ink">“{r.message}”</p>}

                {r.status === "pending" && (
                  <div className="flex flex-wrap gap-2">
                    <form action={decideResponseAction}>
                      <input type="hidden" name="responseId" value={r.id} />
                      <input type="hidden" name="decision" value="accepted" />
                      <Button type="submit" size="sm" disabled={spotsLeft === 0}>
                        Accept
                      </Button>
                    </form>
                    <form action={decideResponseAction}>
                      <input type="hidden" name="responseId" value={r.id} />
                      <input type="hidden" name="decision" value="declined" />
                      <Button type="submit" size="sm" variant="ghost">
                        Decline
                      </Button>
                    </form>
                  </div>
                )}

                {(r.status === "accepted" || r.status === "completed") && r.contact && (
                  <ContactBox email={r.contact.email} phone={r.contact.phone} />
                )}

                {r.status === "accepted" && posterIsNewcomer && (
                  <CompleteForm responseId={r.id} />
                )}

                {r.status === "completed" && r.endorsement && (
                  <p className="text-sm italic text-ink">“{r.endorsement}”</p>
                )}

                {["pending", "accepted"].includes(r.status) && (
                  <form action={cancelResponseAction}>
                    <input type="hidden" name="responseId" value={r.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {r.status === "accepted" ? "Cancel this arrangement" : "Withdraw"}
                    </Button>
                  </form>
                )}
              </Card>
            ))
          )}

          {post.status === "open" && (
            <form action={closePostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <Button type="submit" variant="secondary" size="sm">
                Close this post
              </Button>
            </form>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Link href="/help" className="text-sm font-medium text-brand-600 hover:underline">
          ← Help board
        </Link>
        {!post.isMine && <ReportForm targetType="help_post" targetId={post.id} />}
      </div>
    </div>
  );
}
