import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups, users } from "@/db/schema";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { RecommendationCard } from "@/components/recommendation-card";
import { leaveGroupAction, rotateInviteTokenAction } from "@/app/actions/groups";
import { requireUser } from "@/lib/guards";
import { getGroupRecommendations } from "@/lib/discover";
import { avatarColor, initials } from "@/lib/category-colors";
import { pluralize } from "@/lib/format";
import { siteUrl } from "@/lib/email";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [group] = await db
    .select({ name: groups.name })
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);
  return { title: group?.name ?? "Group" };
}

export default async function GroupPage({ params }: Props) {
  const { slug } = await params;
  const user = await requireUser(`/groups/${slug}`);

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);
  if (!group) notFound();

  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)),
    )
    .limit(1);

  // A group's contents are for its members. Non-members get nothing, not even
  // the member list.
  if (!membership) notFound();

  const [members, shared] = await Promise.all([
    db
      .select({ name: users.name, role: groupMembers.role, id: users.id })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, group.id)),
    getGroupRecommendations(group.id, user.id),
  ]);

  const canManage = membership.role === "owner" || membership.role === "admin";
  const inviteUrl = group.inviteToken
    ? `${siteUrl()}/join/${group.inviteToken}`
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={group.name}
        description={
          [
            group.description,
            `${members.length} ${pluralize(members.length, "member")}`,
            group.city ? `${group.city}, ${group.state}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />

      {inviteUrl && (
        <Card className="warm-wash">
          <h2 className="font-semibold text-ink">
            <span aria-hidden="true">✉️</span> Invite link
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Anyone with this link can join. Send it round the group chat.
          </p>
          <p className="mt-3 break-all rounded-xl bg-surface-sunken px-4 py-3 font-mono text-sm text-ink">
            {inviteUrl}
          </p>
          {canManage && (
            <form action={rotateInviteTokenAction} className="mt-3">
              <input type="hidden" name="groupId" value={group.id} />
              <Button type="submit" variant="ghost" size="sm">
                Generate a new link
              </Button>
            </form>
          )}
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">
          Shared with this group
        </h2>
        {shared.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="Nothing shared here yet"
            description="When a member sets a recommendation's audience to this group, it shows up here."
          />
        ) : (
          <div className="stagger space-y-4">
            {shared.map((item) => (
              <RecommendationCard key={item.id} item={item} showRecommender />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Members</h2>
        <div className="flex flex-wrap gap-3">
          {members.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 text-sm"
            >
              <Avatar name={initials(m.name)} color={avatarColor(m.name)} size="sm" />
              {m.name}
              {m.role !== "member" && <Badge tone="brand">{m.role}</Badge>}
            </span>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/groups"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          ← All groups
        </Link>
        <form action={leaveGroupAction}>
          <input type="hidden" name="groupId" value={group.id} />
          <Button type="submit" variant="ghost" size="sm">
            Leave this group
          </Button>
        </form>
      </div>
    </div>
  );
}
