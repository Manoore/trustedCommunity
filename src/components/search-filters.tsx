"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RADIUS_LADDER } from "@/lib/geo-constants";

type Group = { label: string; options: { id: string; name: string }[] };

export function SearchFilters({
  categoryGroups,
}: {
  categoryGroups: { slug: string; name: string; children: { slug: string; name: string }[] }[];
}) {
  const params = useSearchParams();
  const router = useRouter();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/search?${next.toString()}`);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label htmlFor="f-category" className="mb-1 block text-xs font-medium text-ink-muted">
          Category
        </label>
        <select
          id="f-category"
          value={params.get("category") ?? ""}
          onChange={(e) => update("category", e.target.value)}
          className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink"
        >
          <option value="">All categories</option>
          {categoryGroups.map((group) => (
            <optgroup key={group.slug} label={group.name}>
              <option value={group.slug}>All {group.name}</option>
              {group.children.map((child) => (
                <option key={child.slug} value={child.slug}>
                  {child.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-radius" className="mb-1 block text-xs font-medium text-ink-muted">
          Distance
        </label>
        <select
          id="f-radius"
          value={params.get("radius") ?? "25"}
          onChange={(e) => update("radius", e.target.value)}
          className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink"
        >
          {RADIUS_LADDER.map((r) => (
            <option key={r} value={r}>
              Within {r} miles
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-sort" className="mb-1 block text-xs font-medium text-ink-muted">
          Sort by
        </label>
        <select
          id="f-sort"
          value={params.get("sort") ?? "relevance"}
          onChange={(e) => update("sort", e.target.value)}
          className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink"
        >
          <option value="relevance">Best match</option>
          <option value="distance">Closest</option>
          <option value="rating">Highest rated</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <div className="flex items-end">
        <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={params.get("remote") === "1"}
            onChange={(e) => update("remote", e.target.checked ? "1" : "")}
            className="h-4 w-4"
          />
          Remote only
        </label>
      </div>
    </div>
  );
}

export type { Group };
