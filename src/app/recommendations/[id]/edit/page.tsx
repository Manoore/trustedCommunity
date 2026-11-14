import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Button, Card, PageHeader } from "@/components/ui";
import { RecommendationForm } from "@/components/recommendation-form";
import {
  deleteRecommendationAction,
  saveRecommendationAction,
} from "@/app/actions/recommendations";
import { getCategoryOptions } from "@/lib/queries";
import { getRecommendationForEdit } from "@/lib/recommendations";
import { requireUser } from "@/lib/guards";
import { getMyGroups } from "@/lib/social";
import { db } from "@/db";
import { recommendationGroups } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Edit recommendation" };

type Props = { params: Promise<{ id: string }> };

export default async function EditRecommendationPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/recommendations/${id}/edit`);

  const [data, groups, myGroups] = await Promise.all([
    getRecommendationForEdit(id, user.id),
    getCategoryOptions(),
    getMyGroups(user.id),
  ]);
  if (!data) notFound();

  const scopedGroups = await db
    .select({ groupId: recommendationGroups.groupId })
    .from(recommendationGroups)
    .where(eq(recommendationGroups.recommendationId, id));

  const { recommendation, provider } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Edit recommendation"
        description={`Your recommendation for ${provider.displayName}.`}
      />

      <RecommendationForm
        action={saveRecommendationAction}
        groups={groups}
        myGroups={myGroups.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
        }))}
        submitLabel="Save changes"
        defaults={{
          groupIds: scopedGroups.map((g) => g.groupId),
          id: recommendation.id,
          name: provider.displayName,
          phone: provider.contactPhone,
          kind: provider.kind,
          categoryId: recommendation.categoryId,
          zip: provider.zip,
          country: provider.country,
          city: provider.country !== "US" ? provider.city : null,
          websiteUrl: provider.websiteUrl,
          relationship: recommendation.relationship,
          strength: recommendation.strength,
          note: recommendation.note,
          visibility: recommendation.visibility,
        }}
      />

      <Card className="border-red-200">
        <h2 className="font-semibold text-ink">Remove this recommendation</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Takes it off your list. The contact stays if other people have vouched for
          them.
        </p>
        <form action={deleteRecommendationAction} className="mt-3">
          <input type="hidden" name="recommendationId" value={recommendation.id} />
          <Button type="submit" variant="danger" size="sm">
            Remove from my list
          </Button>
        </form>
      </Card>
    </div>
  );
}
