import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ListingCard } from "@/components/listing-card";
import { SearchFilters } from "@/components/search-filters";
import { Alert, Card, EmptyState, LinkButton } from "@/components/ui";
import { getCategoryTree } from "@/lib/queries";
import { searchListings, type SortKey } from "@/lib/search";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Search" };

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim() ?? "";
  const loc = first(sp.loc)?.trim() ?? "";
  const categorySlug = first(sp.category) ?? "";
  const radius = Number(first(sp.radius) ?? 25);
  const sort = (first(sp.sort) ?? "relevance") as SortKey;
  const remoteOnly = first(sp.remote) === "1";
  const page = Math.max(Number(first(sp.page) ?? 1), 1);

  const [tree, results] = await Promise.all([
    getCategoryTree(),
    searchListings({
      q: q || undefined,
      loc: loc || undefined,
      categorySlug: categorySlug || undefined,
      radius: Number.isFinite(radius) ? radius : 25,
      sort,
      remoteOnly,
      page,
    }),
  ]);

  const groups = tree
    .filter((g) => !g.restricted)
    .map((g) => ({
      slug: g.slug,
      name: g.name,
      children: g.children
        .filter((c) => !c.restricted)
        .map((c) => ({ slug: c.slug, name: c.name })),
    }));

  const totalPages = Math.max(Math.ceil(results.total / results.perPage), 1);
  const activeCategory = tree
    .flatMap((g) => [g, ...g.children])
    .find((c) => c.slug === categorySlug);

  function pageHref(target: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (loc) next.set("loc", loc);
    if (categorySlug) next.set("category", categorySlug);
    if (radius !== 25) next.set("radius", String(radius));
    if (sort !== "relevance") next.set("sort", sort);
    if (remoteOnly) next.set("remote", "1");
    if (target > 1) next.set("page", String(target));
    return `/search?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {q ? `“${q}”` : activeCategory ? activeCategory.name : "All listings"}
          {results.origin && (
            <span className="text-ink-muted">
              {" "}
              near {results.origin.city}, {results.origin.state}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {results.total} {pluralize(results.total, "result")}
          {results.origin && !remoteOnly && <> within {results.appliedRadius} miles</>}
        </p>
      </div>

      <Card className="p-4">
        <Suspense fallback={<div className="h-10" />}>
          <SearchFilters categoryGroups={groups} />
        </Suspense>
      </Card>

      {results.expanded && results.items.length > 0 && (
        <Alert tone="info">
          Not much within {results.requestedRadius} miles of {results.origin?.city}, so
          this is widened to {results.appliedRadius} miles. Providers who travel further
          are included.
        </Alert>
      )}

      {activeCategory?.licenseRequired && (
        <Alert tone="info">
          {activeCategory.name} is a licensed trade in most states. Check the licence
          number on a listing against your state board before hiring.
        </Alert>
      )}

      {results.items.length === 0 ? (
        <EmptyState
          title="No listings here yet"
          description={
            <>
              <p>
                Nothing matches{q && <> “{q}”</>}
                {results.origin && (
                  <>
                    {" "}
                    near {results.origin.city}, {results.origin.state}
                  </>
                )}
                {" "}yet. This marketplace is still filling in category by category.
              </p>
              <p className="mt-3">
                If you do this work, the spot is open — a listing posted now is the first
                thing buyers here will see.
              </p>
            </>
          }
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <LinkButton href="/dashboard/onboarding">
                List your service here
              </LinkButton>
              <LinkButton href="/search" variant="secondary">
                Clear filters
              </LinkButton>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          {results.items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {results.items.length > 0 && (
        <p className="text-center text-xs text-ink-muted">
          Providers are independent businesses. Confirm licence and insurance before work
          begins.
        </p>
      )}
    </div>
  );
}
