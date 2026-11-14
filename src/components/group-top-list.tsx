import Link from "next/link";
import { Avatar, Button } from "@/components/ui";
import { pinContactAction } from "@/app/actions/groups";
import { quickVouchAction } from "@/app/actions/recommendations";
import {
  avatarColor,
  categoryColor,
  categoryTint,
  initials,
} from "@/lib/category-colors";
import type { GroupTopContact } from "@/lib/discover";

/**
 * The group's shared rolodex: one row per contact, ranked by how many members
 * vouch for them. Collapses seven separate cards for the same plumber into the
 * one fact that matters.
 */
export function GroupTopList({
  items,
  groupId,
  returnTo,
  canManage = false,
  pinnedIds = [],
}: {
  items: GroupTopContact[];
  groupId: string;
  returnTo: string;
  canManage?: boolean;
  pinnedIds?: string[];
}) {
  const max = Math.max(...items.map((i) => i.members), 1);

  return (
    <ol className="stagger space-y-3">
      {items.map((item, index) => {
        const hue = categoryColor(item.groupSlug);
        const share = Math.round((item.members / max) * 100);

        return (
          <li
            key={item.providerId}
            className="lift rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
            style={{ borderLeft: `4px solid ${hue}` }}
          >
            <div className="flex flex-wrap items-start gap-4">
              <span
                aria-hidden="true"
                className="mt-1 w-6 shrink-0 text-center text-sm font-semibold text-ink-muted"
              >
                {index + 1}
              </span>
              <Avatar name={initials(item.name)} color={avatarColor(item.name)} size="sm" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold text-ink">
                    <Link href={`/p/${item.slug}`} className="hover:underline">
                      {item.name}
                    </Link>
                  </h3>
                  {item.categoryName && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: categoryTint(item.groupSlug), color: hue }}
                    >
                      {item.categoryName}
                    </span>
                  )}
                  {item.kind === "individual" && (
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-muted">
                      Person
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div
                    className="h-2 w-28 overflow-hidden rounded-full bg-surface-sunken"
                    role="img"
                    aria-label={`${item.members} of this group's members recommend them`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${share}%`, backgroundColor: hue }}
                    />
                  </div>
                  <p className="text-sm font-medium text-ink">
                    {item.members} {item.members === 1 ? "member" : "members"}
                    {item.usedPersonally > 0 && (
                      <span className="font-normal text-ink-muted">
                        {" "}
                        · {item.usedPersonally} used them
                      </span>
                    )}
                  </p>
                </div>

                {item.topNote && (
                  <blockquote className="mt-3 rounded-xl bg-surface-sunken px-3 py-2 text-sm italic text-ink">
                    “{item.topNote}”
                    {item.topNoteAuthor && (
                      <span className="not-italic text-ink-muted"> — {item.topNoteAuthor}</span>
                    )}
                  </blockquote>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {canManage && !pinnedIds.includes(item.providerId) && (
                  <form action={pinContactAction}>
                    <input type="hidden" name="groupId" value={groupId} />
                    <input type="hidden" name="providerId" value={item.providerId} />
                    <button
                      type="submit"
                      className="rounded-full border border-line-strong px-3 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken"
                    >
                      📌 Pin to start list
                    </button>
                  </form>
                )}
                {item.mine ? (
                  <span className="inline-flex h-9 items-center rounded-full bg-brand-50 px-4 text-sm font-medium text-brand-700">
                    ✓ You recommend
                  </span>
                ) : (
                  <form action={quickVouchAction}>
                    <input type="hidden" name="providerId" value={item.providerId} />
                    <input type="hidden" name="groupId" value={groupId} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <Button type="submit" variant="coral" size="sm">
                      <span aria-hidden="true">＋1</span> I recommend them too
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
