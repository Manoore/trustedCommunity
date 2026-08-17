"use client";

import { useActionState } from "react";
import { sendConnectionRequestToUserAction } from "@/app/actions/connections";
import { Avatar, Button } from "@/components/ui";
import { avatarColor, initials } from "@/lib/category-colors";
import { idleState } from "@/lib/validation";

export type SearchResult = {
  id: string;
  name: string;
  email: string;
  mutualName: string | null;
};

export function ConnectionSearchResults({ results }: { results: SearchResult[] }) {
  const [state, formAction] = useActionState(
    sendConnectionRequestToUserAction,
    idleState,
  );

  if (results.length === 0) return null;

  return (
    <div className="space-y-2">
      {state.message && (
        <p className={state.ok ? "text-sm text-brand-700" : "text-sm text-red-600"}>
          {state.message}
        </p>
      )}
      {results.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
        >
          <Avatar name={initials(r.name)} color={avatarColor(r.name)} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{r.name}</p>
            <p className="text-xs text-ink-muted">
              {r.mutualName ? `Connected through ${r.mutualName}` : "In your extended network"}
            </p>
          </div>
          <form action={formAction}>
            <input type="hidden" name="userId" value={r.id} />
            <Button type="submit" size="sm">
              Connect
            </Button>
          </form>
        </div>
      ))}
    </div>
  );
}
