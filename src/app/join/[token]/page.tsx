import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { Button, Card, PageHeader } from "@/components/ui";
import { joinGroupAction } from "@/app/actions/groups";
import { getCurrentUser } from "@/lib/auth";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Join a group" };

type Props = { params: Promise<{ token: string }> };

export default async function JoinGroupPage({ params }: Props) {
  const { token } = await params;

  const [group] = await db
    .select({
      id: groups.id,
      slug: groups.slug,
      name: groups.name,
      description: groups.description,
      city: groups.city,
      state: groups.state,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM group_members gm WHERE gm.group_id = ${groups.id}
      )`,
    })
    .from(groups)
    .where(eq(groups.inviteToken, token))
    .limit(1);

  if (!group) notFound();

  const user = await getCurrentUser();

  // Already a member? Just take them there.
  if (user) {
    const [existing] = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)),
      )
      .limit(1);
    if (existing) redirect(`/groups/${group.slug}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={`Join ${group.name}`}
        description="Someone shared this invite link with you."
      />

      <Card className="warm-wash">
        <p className="text-sm text-ink-muted">
          {group.memberCount} {pluralize(group.memberCount, "member")}
          {group.city && ` · ${group.city}, ${group.state}`}
        </p>
        {group.description && (
          <p className="mt-3 text-sm text-ink">{group.description}</p>
        )}

        <p className="mt-4 text-sm text-ink-muted">
          Joining lets you see recommendations members have chosen to share with this
          group, and share your own the same way. Your private entries stay private.
        </p>

        <form action={joinGroupAction} className="mt-5">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" size="lg">
            {user ? "Join this group" : "Sign in and join"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
