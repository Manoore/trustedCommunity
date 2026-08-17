import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { RecommendationCard } from "@/components/recommendation-card";
import { requireUser } from "@/lib/guards";
import { discover } from "@/lib/discover";
import { getConnectionIds, getGroupIds } from "@/lib/social";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Discover" };

type Props = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

const DEGREE_TONE: Record<number, "brand" | "coral" | "gold"> = {
  1: "brand",
  2: "coral",
  3: "gold",
};

export default async function DiscoverPage({ searchParams }: Props) {
  const { q, category } = await searchParams;
  const user = await requireUser("/discover");

  const [results, connectionIds, groupIds] = await Promise.all([
    discover(user.id, { q, categorySlug: category }),
    getConnectionIds(user.id),
    getGroupIds(user.id),
  ]);

  const hasNetwork = connectionIds.length > 0 || groupIds.length > 0;

  // Group by degree so the closest recommendations lead.
  const byDegree = [1, 2, 3].map((degree) => ({
    degree,
    label:
      degree === 1
        ? "People you know"
        : degree === 2
          ? "From your groups"
          : "Friends of friends",
    items: results.filter((r) => r.degree === degree),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Discover"
        description="Recommendations from your network, closest first. Nothing here is anonymous — every one has a name on it."
      />

      <Card>
        <form action="/discover" method="get" role="search" className="flex flex-wrap gap-3">
          <label htmlFor="q" className="sr-only">
            What do you need?
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Plumber, tutor, photographer…"
            className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-5 text-sm text-ink placeholder:text-ink-muted"
          />
          {category && <input type="hidden" name="category" value={category} />}
          <button
            type="submit"
            className="h-11 rounded-full bg-brand-600 px-6 text-sm font-medium text-white hover:bg-brand-700"
          >
            Search
          </button>
        </form>
      </Card>

      {!hasNetwork ? (
        <EmptyState
          emoji="🌐"
          title="Your network is empty"
          description="Discover shows what the people you trust recommend. Connect with someone, or join a group, and their shared recommendations show up here."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <LinkButton href="/people">Connect with someone</LinkButton>
              <LinkButton href="/groups" variant="secondary">
                Join a group
              </LinkButton>
            </div>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title={q ? `Nothing for “${q}” yet` : "Nothing shared with you yet"}
          description="Your connections have not shared anything matching this. You could ask them directly."
          action={<LinkButton href="/asks/new">Ask my network</LinkButton>}
        />
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {results.length} {pluralize(results.length, "recommendation")} from your
            network.
          </p>

          {byDegree
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <section key={section.degree} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                    {section.label}
                  </h2>
                  <Badge tone={DEGREE_TONE[section.degree]}>
                    {section.items.length}
                  </Badge>
                </div>
                <div className="stagger space-y-4">
                  {section.items.map((item) => (
                    <RecommendationCard key={item.id} item={item} showRecommender />
                  ))}
                </div>
              </section>
            ))}
        </>
      )}

      <Card className="warm-wash">
        <h2 className="text-lg font-semibold text-ink">Cannot find it?</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Ask the people you trust directly. They will get a note, and their answers
          land back here.
        </p>
        <div className="mt-4">
          <LinkButton href="/asks/new" variant="coral">
            Ask my network
          </LinkButton>
        </div>
      </Card>

      <p className="text-xs text-ink-muted">
        <Link href="/people" className="underline hover:text-ink">
          Manage who is in your network
        </Link>
      </p>
    </div>
  );
}
