import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { RecommendationForm } from "@/components/recommendation-form";
import { saveRecommendationAction } from "@/app/actions/recommendations";
import { getCategoryOptions } from "@/lib/queries";
import { requireUser } from "@/lib/guards";
import { requireVerifiedPhonePage } from "@/lib/phone-gate";
import { getMyGroups } from "@/lib/social";

export const metadata: Metadata = { title: "Add a recommendation" };

export default async function NewRecommendationPage() {
  const user = await requireUser("/recommendations/new");
  await requireVerifiedPhonePage(user.id, "/recommendations/new");
  const [groups, myGroups] = await Promise.all([
    getCategoryOptions(),
    getMyGroups(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add a recommendation"
        description="Someone you would actually send a friend to."
      />
      <RecommendationForm
        action={saveRecommendationAction}
        groups={groups}
        myGroups={myGroups.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
        }))}
        submitLabel="Save recommendation"
      />
    </div>
  );
}
