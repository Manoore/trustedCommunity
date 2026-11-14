import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { providers, verifications } from "@/db/schema";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
} from "@/components/ui";
import { decideVerificationAction } from "@/app/actions/admin";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Licence review" };

export default async function VerificationsPage() {
  const rows = await db
    .select({
      verification: verifications,
      providerName: providers.displayName,
      providerSlug: providers.slug,
      providerState: providers.state,
    })
    .from(verifications)
    .innerJoin(providers, eq(providers.id, verifications.providerId))
    .orderBy(desc(verifications.createdAt))
    .limit(100);

  const pending = rows.filter((r) => r.verification.status === "pending");
  const decided = rows.filter((r) => r.verification.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Licence review"
        description="Listings in licensed trades stay out of search until the number here checks out against the state board."
      />

      <Card>
        <h2 className="text-sm font-semibold text-ink">Where to check a licence</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>
            Doctors, dentists and other clinicians:{" "}
            <a
              href="https://npiregistry.cms.hhs.gov/search"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 underline"
            >
              the NPI registry
            </a>{" "}
            (name or phone), then the state medical board for standing.
          </li>
          <li>Attorneys: the bar association of the state they practise in.</li>
          <li>
            Immigration help: only a licensed attorney or a DOJ-accredited representative
            qualifies. Reject anyone else.
          </li>
        </ul>
      </Card>

      {pending.length === 0 ? (
        <EmptyState title="Nothing awaiting review" />
      ) : (
        <div className="space-y-3">
          {pending.map(({ verification, providerName, providerSlug, providerState }) => (
            <Card key={verification.id} className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warning">{verification.kind}</Badge>
                  <Badge tone="neutral">
                    {verification.licenseState ?? providerState ?? "state unknown"}
                  </Badge>
                </div>
                <h2 className="mt-2 font-semibold text-ink">
                  <Link href={`/providers/${providerSlug}`} className="hover:underline">
                    {providerName}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-ink">
                  Licence:{" "}
                  <span className="font-mono">
                    {verification.licenseNumber ?? "not supplied"}
                  </span>
                </p>
                {verification.notes && (
                  <p className="mt-1 text-sm text-ink-muted">{verification.notes}</p>
                )}
                <p className="mt-1 text-xs text-ink-muted">
                  Submitted {formatDate(verification.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                <form action={decideVerificationAction} className="flex gap-2">
                  <input
                    type="hidden"
                    name="verificationId"
                    value={verification.id}
                  />
                  <input type="hidden" name="decision" value="approved" />
                  <Button type="submit" size="sm">
                    Approve — publish listings
                  </Button>
                </form>

                <form action={decideVerificationAction} className="flex gap-2">
                  <input
                    type="hidden"
                    name="verificationId"
                    value={verification.id}
                  />
                  <input type="hidden" name="decision" value="rejected" />
                  <Input
                    name="notes"
                    placeholder="Why it failed (shown to the provider)"
                    className="w-72"
                  />
                  <Button type="submit" variant="danger" size="sm">
                    Reject
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Recently decided
          </h2>
          {decided.slice(0, 20).map(({ verification, providerName }) => (
            <Card key={verification.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink">
                  {providerName} — {verification.licenseNumber ?? "no number"}
                </span>
                <Badge
                  tone={verification.status === "approved" ? "success" : "danger"}
                >
                  {verification.status}
                </Badge>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
