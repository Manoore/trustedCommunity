import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/ui";
import { AskForm } from "@/components/ask-form";
import { getCategoryOptions } from "@/lib/queries";
import { requireUser } from "@/lib/guards";
import { getConnectionIds, getMyGroups } from "@/lib/social";

export const metadata: Metadata = { title: "Ask my network" };

export default async function NewAskPage() {
  const user = await requireUser("/asks/new");

  const [categoryGroups, groups, connectionIds] = await Promise.all([
    getCategoryOptions(),
    getMyGroups(user.id),
    getConnectionIds(user.id),
  ]);

  const hasAudience = connectionIds.length > 0 || groups.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Ask my network"
        description="The people you trust probably already know someone good."
      />

      {!hasAudience && (
        <Alert tone="info">
          You have nobody to ask yet. Connect with someone or join a group first, then
          come back.
        </Alert>
      )}

      <AskForm
        categoryGroups={categoryGroups}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
        }))}
        hasConnections={connectionIds.length > 0}
      />
    </div>
  );
}
