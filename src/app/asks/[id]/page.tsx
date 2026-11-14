import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { categories, providers, recommendations } from "@/db/schema";
import { Avatar, Badge, Button, Card, PageHeader } from "@/components/ui";
import { AnswerAskForm } from "@/components/answer-ask-form";
import { ShareBar } from "@/components/share-bar";
import { getOrigin } from "@/lib/site";
import { closeAskAction } from "@/app/actions/asks";
import { requireUser } from "@/lib/guards";
import { getAsk } from "@/lib/asks";
import { avatarColor, initials } from "@/lib/category-colors";
import { formatDate, pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Ask" };

type Props = { params: Promise<{ id: string }> };

export default async function AskPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/asks/${id}`);

  const data = await getAsk(id, user.id);
  if (!data) notFound();

  const { ask, authorName, categoryName, responses, isAuthor } = data;
  const askUrl = `${await getOrigin()}/asks/${ask.id}`;

  // Answer options come from the responder's own list, so an answer is always a
  // recommendation they already stand behind.
  const myOptions = isAuthor
    ? []
    : await db
        .select({
          id: recommendations.id,
          name: providers.displayName,
          categoryName: categories.name,
        })
        .from(recommendations)
        .innerJoin(providers, eq(providers.id, recommendations.providerId))
        .leftJoin(categories, eq(categories.id, recommendations.categoryId))
        .where(
          and(
            eq(recommendations.recommenderUserId, user.id),
            isNull(providers.hiddenAt),
          ),
        );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={ask.title}
        description={
          [
            isAuthor ? "You asked" : `${authorName} asked`,
            categoryName,
            ask.city ? `${ask.city}, ${ask.state}` : null,
            formatDate(ask.createdAt),
          ]
            .filter(Boolean)
            .join(" · ")
        }
      />

      {ask.body && (
        <Card className="warm-wash">
          <p className="text-sm text-ink">{ask.body}</p>
        </Card>
      )}

      {isAuthor && ask.status === "open" && (
        <Card>
          <h2 className="font-semibold text-ink">Nudge your circle</h2>
          <p className="mt-1 text-sm text-ink-muted">
            People you asked get an email, but a message in the group chat gets answered
            faster. Only the connections and groups you picked can open the link.
          </p>
          <div className="mt-3">
            <ShareBar
              url={askUrl}
              text={`Anyone know someone good? "${ask.title}" — answer here:`}
              label="Share this ask"
            />
          </div>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">
          {responses.length} {pluralize(responses.length, "answer")}
        </h2>

        {responses.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">
              No answers yet. People in your network get a note when you ask.
            </p>
          </Card>
        ) : (
          <div className="stagger space-y-3">
            {responses.map((r) => (
              <Card key={r.id} className="lift">
                <div className="flex items-start gap-3">
                  <Avatar
                    name={initials(r.responderName)}
                    color={avatarColor(r.responderName)}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {r.responderName} recommends{" "}
                      {r.providerSlug ? (
                        <Link
                          href={`/p/${r.providerSlug}`}
                          className="text-brand-600 hover:underline"
                        >
                          {r.providerName}
                        </Link>
                      ) : (
                        r.providerName
                      )}
                    </p>
                    {(r.providerCity || r.providerPhone) && (
                      <p className="text-sm text-ink-muted">
                        {[
                          r.providerCity && `${r.providerCity}, ${r.providerState}`,
                          r.providerPhone,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {r.note && (
                      <blockquote className="mt-2 border-l-2 border-brand-200 pl-3 text-sm italic text-ink">
                        “{r.note}”
                      </blockquote>
                    )}
                  </div>
                  {r.providerPhone && (
                    <a
                      href={`tel:${r.providerPhone}`}
                      className="hidden shrink-0 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 sm:block"
                    >
                      Call
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {!isAuthor && ask.status === "open" && (
        <Card>
          <h2 className="font-semibold text-ink">Know someone?</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Answer with someone from your own list.
          </p>
          <div className="mt-4">
            <AnswerAskForm askId={ask.id} options={myOptions} />
          </div>
        </Card>
      )}

      {isAuthor && ask.status === "open" && (
        <form action={closeAskAction}>
          <input type="hidden" name="askId" value={ask.id} />
          <Button type="submit" variant="secondary" size="sm">
            Close this ask
          </Button>
        </form>
      )}

      {ask.status !== "open" && <Badge tone="neutral">This ask is closed</Badge>}
    </div>
  );
}
