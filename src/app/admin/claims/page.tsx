import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { claimRequests, providers } from "@/db/schema";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { resolveClaimAction } from "@/app/actions/claims";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Claims & removals" };

export default async function AdminClaimsPage() {
  const rows = await db
    .select({
      claim: claimRequests,
      providerName: providers.displayName,
      providerSlug: providers.slug,
      hiddenAt: providers.hiddenAt,
    })
    .from(claimRequests)
    .innerJoin(providers, eq(providers.id, claimRequests.providerId))
    .orderBy(desc(claimRequests.createdAt))
    .limit(100);

  const open = rows.filter((r) => r.claim.status === "open");
  const closed = rows.filter((r) => r.claim.status !== "open");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claims & removals"
        description="Removal requests hide the profile immediately. Confirming one deletes every recommendation attached to it."
      />

      {open.length === 0 ? (
        <EmptyState title="Nothing waiting" />
      ) : (
        <div className="space-y-3">
          {open.map(({ claim, providerName, providerSlug, hiddenAt }) => (
            <Card key={claim.id} className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={claim.kind === "removal" ? "danger" : "brand"}>
                    {claim.kind}
                  </Badge>
                  {hiddenAt && <Badge tone="warning">Hidden</Badge>}
                </div>
                <h2 className="mt-2 font-semibold text-ink">
                  <Link href={`/p/${providerSlug}`} className="hover:underline">
                    {providerName}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {claim.contactEmail ?? "no email"} · {claim.contactPhone ?? "no phone"}{" "}
                  · {formatDate(claim.createdAt)}
                </p>
                {claim.message && (
                  <p className="mt-2 text-sm text-ink">{claim.message}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <form action={resolveClaimAction}>
                  <input type="hidden" name="claimId" value={claim.id} />
                  <input type="hidden" name="decision" value="resolved" />
                  <Button type="submit" size="sm">
                    {claim.kind === "removal"
                      ? "Confirm removal"
                      : "Approve claim"}
                  </Button>
                </form>
                <form action={resolveClaimAction}>
                  <input type="hidden" name="claimId" value={claim.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <Button type="submit" variant="ghost" size="sm">
                    Reject{claim.kind === "removal" ? " and restore" : ""}
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Resolved
          </h2>
          {closed.slice(0, 20).map(({ claim, providerName }) => (
            <Card key={claim.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink">
                  {providerName} — {claim.kind}
                </span>
                <Badge tone={claim.status === "resolved" ? "success" : "neutral"}>
                  {claim.status}
                </Badge>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
