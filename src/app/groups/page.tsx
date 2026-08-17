import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { GroupForm } from "@/components/group-form";
import { requireUser } from "@/lib/guards";
import { getMyGroups } from "@/lib/social";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Groups" };

const KIND_EMOJI: Record<string, string> = {
  temple: "🛕",
  church: "⛪",
  neighborhood: "🏘️",
  social: "🎉",
  school: "🎒",
  workplace: "🏢",
  other: "👥",
};

export default async function GroupsPage() {
  const user = await requireUser("/groups");
  const groups = await getMyGroups(user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Groups"
        description="A temple, a street, a school circle. Share recommendations with a community without making them public."
      />

      {groups.length === 0 ? (
        <EmptyState
          emoji="🏘️"
          title="You are not in any groups yet"
          description="Create one and send the invite link to the people in it, or open an invite link someone sent you."
        />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.id} className="lift">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span aria-hidden="true" className="text-2xl">
                    {KIND_EMOJI[g.kind] ?? "👥"}
                  </span>
                  <h2 className="mt-2 font-semibold text-ink">
                    <Link href={`/groups/${g.slug}`} className="hover:underline">
                      {g.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-ink-muted">
                    {g.memberCount} {pluralize(g.memberCount, "member")}
                    {g.city && ` · ${g.city}, ${g.state}`}
                  </p>
                </div>
                {g.role === "owner" && <Badge tone="brand">Owner</Badge>}
              </div>
              {g.description && (
                <p className="mt-3 text-sm text-ink-muted">{g.description}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="warm-wash">
        <h2 className="text-lg font-semibold text-ink">Start a group</h2>
        <p className="mt-1 text-sm text-ink-muted">
          You get an invite link to pass around. No admin approval, no cost.
        </p>
        <div className="mt-4 max-w-md">
          <GroupForm />
        </div>
      </Card>
    </div>
  );
}
