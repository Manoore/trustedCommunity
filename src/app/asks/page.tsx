import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/guards";
import { getIncomingAsks, getMyAsks } from "@/lib/asks";
import { pluralize, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Asks" };

export default async function AsksPage() {
  const user = await requireUser("/asks");
  const [mine, incoming] = await Promise.all([
    getMyAsks(user.id),
    getIncomingAsks(user.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Asks"
        description="Ask the people you trust for a name, and answer when they ask you."
        action={<LinkButton href="/asks/new">Ask my network</LinkButton>}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          People asking you ({incoming.length})
        </h2>
        {incoming.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">
              Nothing right now. When someone in your network asks for a
              recommendation, it lands here.
            </p>
          </Card>
        ) : (
          <div className="stagger space-y-3">
            {incoming.map((ask) => (
              <Card key={ask.id} className="lift">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {ask.answeredByMe ? (
                        <Badge tone="success">You answered</Badge>
                      ) : (
                        <Badge tone="coral">Needs an answer</Badge>
                      )}
                      {ask.categoryName && (
                        <Badge tone="neutral">{ask.categoryName}</Badge>
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold text-ink">
                      <Link href={`/asks/${ask.id}`} className="hover:underline">
                        {ask.title}
                      </Link>
                    </h3>
                    <p className="text-sm text-ink-muted">
                      {ask.authorName}
                      {ask.city && ` · ${ask.city}, ${ask.state}`} ·{" "}
                      {timeAgo(ask.createdAt)}
                    </p>
                  </div>
                  <Link
                    href={`/asks/${ask.id}`}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    Open →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Your asks ({mine.length})
        </h2>
        {mine.length === 0 ? (
          <EmptyState
            emoji="🙋"
            title="You have not asked anything yet"
            description="When you need a name you do not have, ask the people you trust instead of a search engine."
            action={<LinkButton href="/asks/new">Ask my network</LinkButton>}
          />
        ) : (
          <div className="space-y-3">
            {mine.map(({ ask, categoryName, responseCount }) => (
              <Card key={ask.id} className="lift">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ask.status === "open" ? "brand" : "neutral"}>
                        {ask.status}
                      </Badge>
                      {categoryName && <Badge tone="neutral">{categoryName}</Badge>}
                    </div>
                    <h3 className="mt-2 font-semibold text-ink">
                      <Link href={`/asks/${ask.id}`} className="hover:underline">
                        {ask.title}
                      </Link>
                    </h3>
                    <p className="text-sm text-ink-muted">
                      {responseCount} {pluralize(responseCount, "answer")} ·{" "}
                      {timeAgo(ask.createdAt)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
