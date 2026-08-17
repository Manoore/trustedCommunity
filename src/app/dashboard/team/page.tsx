import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { providerMembers, users } from "@/db/schema";
import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";
import { TeamInviteForm } from "@/components/team-invite-form";
import { removeTeamMemberAction } from "@/app/actions/providers";
import { requireProvider } from "@/lib/guards";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { provider, membership } = await requireProvider("/dashboard/team");

  const team = await db
    .select({
      id: providerMembers.id,
      role: providerMembers.role,
      name: users.name,
      email: users.email,
    })
    .from(providerMembers)
    .innerJoin(users, eq(users.id, providerMembers.userId))
    .where(eq(providerMembers.providerId, provider.id));

  const isEntity = provider.type === "entity";
  const isOwner = membership.role === "owner";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Team"
        description="Business accounts can give staff their own login instead of sharing one."
      />

      {!isEntity && (
        <Alert tone="info">
          Team seats are a business-account feature. Switch your account type to
          &ldquo;business&rdquo; on the profile page to add people.
        </Alert>
      )}

      <Card>
        <h2 className="font-semibold text-ink">Members</h2>
        <ul className="mt-3 divide-y divide-line">
          {team.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-ink">{member.name}</p>
                <p className="text-sm text-ink-muted">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={member.role === "owner" ? "brand" : "neutral"}>
                  {member.role}
                </Badge>
                {isOwner && member.role !== "owner" && (
                  <form action={removeTeamMemberAction}>
                    <input type="hidden" name="providerId" value={provider.id} />
                    <input type="hidden" name="memberId" value={member.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {isEntity && isOwner && (
        <Card>
          <h2 className="font-semibold text-ink">Add a team member</h2>
          <p className="mt-1 text-sm text-ink-muted">
            They need a NearSide account first. Managers can post and edit listings;
            staff can only handle inquiries.
          </p>
          <div className="mt-4">
            <TeamInviteForm providerId={provider.id} />
          </div>
        </Card>
      )}
    </div>
  );
}
