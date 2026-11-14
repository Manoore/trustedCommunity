import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups, users } from "@/db/schema";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { GroupTopList } from "@/components/group-top-list";
import { RecommendationCard } from "@/components/recommendation-card";
import { ShareBar } from "@/components/share-bar";
import { GroupSettingsForm } from "@/components/group-settings-form";
import {
  leaveGroupAction,
  removeEntryAction,
  removeMemberAction,
  rotateInviteTokenAction,
  unpinContactAction,
} from "@/app/actions/groups";
import { requireUser } from "@/lib/guards";
import { getGroupPins, getGroupRecommendations, getGroupTopContacts } from "@/lib/discover";
import { avatarColor, initials } from "@/lib/category-colors";
import { pluralize } from "@/lib/format";
import { getOrigin } from "@/lib/site";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vouch?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const [group] = await db
    .select({ name: groups.name })
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);
  return { title: group?.name ?? "Group" };
}

const VOUCH_NOTICES: Record<string, { tone: "success" | "info" | "error"; text: string }> = {
  group: {
    tone: "success",
    text: "Added. You now recommend them to this group — edit it from your list to say how you know them.",
  },
  exists: {
    tone: "info",
    text: "They are already on your list with a different audience, so nothing changed. Edit that entry if you want this group to see it.",
  },
  limited: { tone: "error", text: "Slow down a little — try again in a few minutes." },
  missing: { tone: "error", text: "That contact is no longer available." },
};

export default async function GroupPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { vouch } = await searchParams;
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

  const [members, shared, top, origin, pins] = await Promise.all([
    db
      .select({ name: users.name, role: groupMembers.role, id: users.id })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, group.id)),
    getGroupRecommendations(group.id, user.id),
    getGroupTopContacts(group.id, user.id),
    getOrigin(),
    getGroupPins(group.id),
  ]);

  const canManage = membership.role === "owner" || membership.role === "admin";
  const inviteUrl = group.inviteToken ? `${origin}/join/${group.inviteToken}` : null;
  const notice = vouch ? VOUCH_NOTICES[vouch === "saved" ? "group" : vouch] : null;

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

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {group.welcomeMessage && (
        <Card className="warm-wash">
          <p className="text-sm italic text-ink">“{group.welcomeMessage}”</p>
        </Card>
      )}

      {pins.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-ink">
              <span aria-hidden="true">📌</span> Start here
            </h2>
            <p className="text-sm text-ink-muted">Hand-picked by the people who run this group.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pins.map((pin) => (
              <li
                key={pin.providerId}
                className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
              >
                <span className="min-w-0">
                  <Link href={`/p/${pin.slug}`} className="font-medium text-ink hover:underline">
                    {pin.name}
                  </Link>
                  {pin.note && <span className="block truncate text-sm text-ink-muted">{pin.note}</span>}
                </span>
                {canManage && (
                  <form action={unpinContactAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="providerId" value={pin.providerId} />
                    <button type="submit" className="text-xs text-ink-muted underline hover:text-ink">
                      Unpin
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {inviteUrl && (
        <Card className="warm-wash">
          <h2 className="font-semibold text-ink">
            <span aria-hidden="true">✉️</span> Invite people to {group.name}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Anyone with this link can join. Drop it in the group chat.
          </p>
          <div className="mt-4">
            <ShareBar
              url={inviteUrl}
              text={`Join "${group.name}" on Trusted By — the plumbers, tutors and caterers our community actually trusts:`}
              label="Share the invite"
            />
          </div>
          {canManage && (
            <form action={rotateInviteTokenAction} className="mt-4">
              <input type="hidden" name="groupId" value={group.id} />
              <Button type="submit" variant="ghost" size="sm">
                Generate a new link (the old one stops working)
              </Button>
            </form>
          )}
        </Card>
      )}

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-ink">Most recommended here</h2>
          <p className="text-sm text-ink-muted">
            Ranked by how many members of {group.name} vouch for them.
          </p>
        </div>
        {top.length === 0 ? (
          <EmptyState
            emoji="🌱"
            title="Nobody has been recommended here yet"
            description="Add someone you trust and set who can see it to this group. As members add the same people, the most trusted names rise to the top."
          />
        ) : (
          <GroupTopList
            items={top}
            groupId={group.id}
            returnTo={`/groups/${group.slug}`}
            canManage={canManage}
            pinnedIds={pins.map((p) => p.providerId)}
          />
        )}
      </section>

      {shared.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">
            Every recommendation shared with this group
          </h2>
          <div className="stagger space-y-4">
            {shared.map((item) => (
              <div key={item.id}>
                <RecommendationCard item={item} showRecommender />
                {canManage && (
                  <form action={removeEntryAction} className="mt-1 text-right">
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="recommendationId" value={item.id} />
                    <button type="submit" className="text-xs text-ink-muted underline hover:text-red-600">
                      Remove from this group
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

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
              {canManage && m.role !== "owner" && m.id !== user.id && (
                <form action={removeMemberAction}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="userId" value={m.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${m.name} from the group`}
                    className="ml-1 text-xs text-ink-muted hover:text-red-600"
                  >
                    ✕
                  </button>
                </form>
              )}
            </span>
          ))}
        </div>
      </section>

      {canManage && (
        <Card>
          <h2 className="font-semibold text-ink">Group settings</h2>
          <div className="mt-4 max-w-lg">
            <GroupSettingsForm
              groupId={group.id}
              welcomeMessage={group.welcomeMessage}
              memberLimit={group.memberLimit}
              memberCount={members.length}
            />
          </div>
        </Card>
      )}

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
