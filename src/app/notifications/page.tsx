import Link from "next/link";
import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getNotifications, markAllRead } from "@/lib/notifications";
import { requireUser } from "@/lib/guards";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

const EMOJI: Record<string, string> = {
  help_response: "🙋",
  help_accepted: "✅",
  help_declined: "🙁",
  help_completed: "⭐",
  help_match: "🔔",
  help_cancelled: "↩️",
  help_suspended: "⚠️",
  verified: "🎓",
  connection_request: "🤝",
  connection_accepted: "🤝",
  ask: "🙋",
  ask_answer: "💬",
  ask_hired: "🎉",
};

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");

  // Read them first so the page can show what was new, then mark them seen.
  const items = await getNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;
  if (unread > 0) await markAllRead(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} new.` : "You are all caught up."}
      />

      {items.length === 0 ? (
        <EmptyState
          emoji="🔔"
          title="Nothing yet"
          description="Requests, answers and replies from your network show up here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const body = (
              <Card
                className={["flex gap-3 p-4", !n.readAt ? "border-brand-300 bg-brand-50/50" : ""].join(" ")}
              >
                <span aria-hidden="true" className="text-xl">
                  {EMOJI[n.kind] ?? "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-ink-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-ink-muted">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.readAt && (
                  <span
                    aria-label="New"
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-coral-500"
                  />
                )}
              </Card>
            );
            return n.href ? (
              <Link key={n.id} href={n.href} className="block">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
