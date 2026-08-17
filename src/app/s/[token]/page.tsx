import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Card, LinkButton } from "@/components/ui";
import { RecommendationCard } from "@/components/recommendation-card";
import {
  bumpShareView,
  getShareLinkByToken,
  getSharedList,
  getSharedRecommendation,
} from "@/lib/recommendations";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) return { title: "Link not found" };

  const [owner] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, link.userId))
    .limit(1);

  if (link.kind === "recommendation" && link.recommendationId) {
    const rec = await getSharedRecommendation(link.recommendationId);
    return {
      title: rec ? `${owner?.name} recommends ${rec.name}` : "Recommendation",
      description: rec?.note ?? undefined,
    };
  }
  return { title: `${owner?.name}'s recommendations` };
}

/**
 * Public, no account required. This is the growth loop — a shared card is the
 * thing someone forwards in a group chat.
 */
export default async function SharedPage({ params }: Props) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) notFound();
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) notFound();

  const [owner] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, link.userId))
    .limit(1);

  await bumpShareView(token);

  const ownerName = owner?.name ?? "Someone";

  if (link.kind === "recommendation") {
    if (!link.recommendationId) notFound();
    const rec = await getSharedRecommendation(link.recommendationId);
    if (!rec || rec.visibility === "private") notFound();

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-sm font-medium text-brand-600">
            {ownerName} recommends
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {rec.name}
          </h1>
        </div>

        <RecommendationCard
          item={{ ...rec, recommenderName: ownerName }}
          showRecommender
        />

        <Card>
          <h2 className="font-semibold text-ink">Keep your own list</h2>
          <p className="mt-1 text-sm text-ink-muted">
            The people you trust, recommending the people you need. Free to start.
          </p>
          <div className="mt-4">
            <LinkButton href="/signup">Create your list</LinkButton>
          </div>
        </Card>
      </div>
    );
  }

  const items = await getSharedList(link.userId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-600">Shared list</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          People {ownerName} recommends
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {items.length} {items.length === 1 ? "contact" : "contacts"}, personally
          vouched for.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            {ownerName} has not shared any recommendations yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RecommendationCard
              key={item.id}
              item={{ ...item, recommenderName: ownerName }}
            />
          ))}
        </div>
      )}

      <Card>
        <h2 className="font-semibold text-ink">Start your own</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Save the people you already tell your friends about, and share the list in one
          link.
        </p>
        <div className="mt-4 flex gap-3">
          <LinkButton href="/signup">Create your list</LinkButton>
          <Link
            href="/"
            className="inline-flex h-10 items-center text-sm font-medium text-ink-muted hover:text-ink"
          >
            What is this?
          </Link>
        </div>
      </Card>
    </div>
  );
}
