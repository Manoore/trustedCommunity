"use client";

import { useSearchParams } from "next/navigation";

export function HeaderSearch() {
  const params = useSearchParams();

  return (
    <form action="/search" method="get" role="search" className="flex gap-2">
      <label htmlFor="header-q" className="sr-only">
        What do you need done?
      </label>
      <input
        id="header-q"
        name="q"
        type="search"
        defaultValue={params.get("q") ?? ""}
        placeholder="Plumber, photographer, tutor…"
        className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted"
      />
      <label htmlFor="header-loc" className="sr-only">
        ZIP code
      </label>
      <input
        id="header-loc"
        name="loc"
        inputMode="numeric"
        defaultValue={params.get("loc") ?? ""}
        placeholder="ZIP"
        className="h-10 w-24 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted"
      />
      <button
        type="submit"
        className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
      >
        Search
      </button>
    </form>
  );
}
