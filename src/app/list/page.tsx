import Link from "next/link";
import type { Metadata } from "next";
import { Alert, Button, Card, EmptyState, LinkButton } from "@/components/ui";
import { RecommendationCard } from "@/components/recommendation-card";
import { createShareLinkAction } from "@/app/actions/recommendations";
import { categoryColor, categoryTint } from "@/lib/category-colors";
import {
  countShareable,
  getMyCategoryCounts,
  getMyRecommendations,
} from "@/lib/recommendations";
import { requireUser } from "@/lib/guards";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "My recommendations" };

type Props = {
  searchParams: Promise<{
    category?: string;
    saved?: string;
    matched?: string;
    q?: string;
    imported?: string;
    skipped?: string;
  }>;
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function MyListPage({ searchParams }: Props) {
  const { category, saved, matched, q, imported, skipped } = await searchParams;
  const user = await requireUser("/list");

  const [items, counts, shareable] = await Promise.all([
    getMyRecommendations(user.id, category, q),
    getMyCategoryCounts(user.id),
    countShareable(user.id),
  ]);

  const total = counts.reduce((sum, c) => sum + c.total, 0);
  const goTos = items.filter((i) => i.strength === "go_to").length;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------- greeting */}
      <section className="warm-wash rounded-3xl border border-line bg-surface px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-coral-600">
              {greeting()}, {firstName} 👋
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
              {total > 0 ? "Your people" : "Let's build your list"}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-ink-muted">
              {total > 0
                ? "Everyone here got on this list because you would actually send a friend to them."
                : "Start with the ones you already recommend out loud — your plumber, your mechanic, your hairdresser."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <LinkButton href="/recommendations/new" size="lg">
              <span aria-hidden="true">＋</span> Add someone
            </LinkButton>
            <LinkButton href="/import" variant="secondary" size="lg">
              Import contacts
            </LinkButton>
          </div>
        </div>

        {total > 0 && (
          <dl className="mt-7 flex flex-wrap gap-3">
            {[
              { label: pluralize(total, "contact"), value: total, tone: "brand" },
              {
                label: pluralize(counts.length, "category", "categories"),
                value: counts.length,
                tone: "coral",
              },
              { label: "go-to picks", value: goTos, tone: "gold" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={[
                  "rounded-2xl px-4 py-3",
                  stat.tone === "brand" && "bg-brand-50 text-brand-800",
                  stat.tone === "coral" && "bg-coral-100 text-coral-700",
                  stat.tone === "gold" && "bg-gold-100 text-gold-700",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <dd className="text-2xl font-semibold leading-none">{stat.value}</dd>
                <dt className="mt-1 text-xs font-medium opacity-80">{stat.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </section>

      {saved && !matched && (
        <Alert tone="success">Saved. One more good name on the list.</Alert>
      )}

      {imported && (
        <Alert tone="success">
          Imported {imported} {pluralize(Number(imported), "contact")}
          {Number(skipped) > 0 && `, skipped ${skipped}`}. They came in private — edit
          the ones you want to share.
        </Alert>
      )}

      {total > 0 && (
        <form action="/list" method="get" role="search" className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            Search your list
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Search names, notes, categories…"
            className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-5 text-sm text-ink placeholder:text-ink-muted"
          />
          {category && <input type="hidden" name="category" value={category} />}
          <button
            type="submit"
            className="h-11 rounded-full bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Search
          </button>
          {q && (
            <Link
              href={category ? `/list?category=${category}` : "/list"}
              className="inline-flex h-11 items-center px-3 text-sm text-ink-muted hover:text-ink"
            >
              Clear
            </Link>
          )}
        </form>
      )}

      {matched && (
        <Alert tone="info">
          That phone number was already on the site as <strong>{matched}</strong>, so
          your recommendation was added to them rather than creating a second entry. If
          that is not who you meant, check the number and edit it.
        </Alert>
      )}

      {counts.length > 0 && (
        <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
          <Link
            href="/list"
            className={[
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              !category
                ? "border-transparent bg-ink text-surface"
                : "border-line-strong text-ink-muted hover:bg-surface-sunken",
            ].join(" ")}
          >
            Everything ({total})
          </Link>
          {counts.map((c) => {
            const active = category === c.slug;
            const hue = categoryColor(c.slug);
            return (
              <Link
                key={c.slug}
                href={`/list?category=${c.slug}`}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: hue, borderColor: hue, color: "#fff" }
                    : { backgroundColor: categoryTint(c.slug, 0.1), borderColor: "transparent", color: hue }
                }
              >
                {c.name}
                <span className="opacity-70">{c.total}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {items.length === 0 ? (
        <EmptyState
          emoji={category ? "🔍" : "🌱"}
          title={category ? "Nothing here yet" : "Your list is empty"}
          description={
            category
              ? "Nobody in this category so far. Add someone, or clear the filter."
              : "One good contact is enough to start. Add the person you always end up texting to friends."
          }
          action={
            <LinkButton href="/recommendations/new" size="lg">
              Add your first one
            </LinkButton>
          }
        />
      ) : (
        <div className="stagger space-y-4">
          {items.map((item) => (
            <RecommendationCard key={item.id} item={item} showOwnerActions />
          ))}
        </div>
      )}

      {shareable > 0 && (
        <Card className="warm-wash">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                <span aria-hidden="true">🔗</span> Share your whole list
              </h2>
              <p className="mt-1 max-w-md text-sm text-ink-muted">
                One link to the {shareable}{" "}
                {pluralize(shareable, "entry", "entries")} you marked{" "}
                <strong>anyone with the link</strong>. Entries scoped to your
                connections or a group stay out of it.
              </p>
            </div>
            <form action={createShareLinkAction}>
              <input type="hidden" name="kind" value="list" />
              <Button type="submit" variant="coral" size="lg">
                Get my link
              </Button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
