import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { Card, PageHeader } from "@/components/ui";
import { ClaimForm } from "@/components/claim-form";

export const metadata: Metadata = { title: "Claim or remove a profile" };

type Props = { params: Promise<{ slug: string }> };

/**
 * Deliberately reachable without an account. Someone added by a neighbour never
 * chose to be here, so requiring them to sign up before they can leave would be
 * the wrong way round.
 */
export default async function ClaimPage({ params }: Props) {
  const { slug } = await params;

  const rows = await db
    .select({
      id: providers.id,
      displayName: providers.displayName,
      kind: providers.kind,
    })
    .from(providers)
    .where(eq(providers.slug, slug))
    .limit(1);

  if (!rows.length) notFound();
  const provider = rows[0];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={provider.displayName}
        description="Someone added this profile because they wanted to recommend you. You control whether it stays."
      />

      <Card>
        <ClaimForm providerId={provider.id} name={provider.displayName} />
      </Card>

      <p className="text-xs text-ink-muted">
        No account needed. We only use the contact details you leave here to confirm the
        request.
      </p>
    </div>
  );
}
