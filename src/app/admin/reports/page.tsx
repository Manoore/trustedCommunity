import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reports, users } from "@/db/schema";
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { resolveReportAction } from "@/app/actions/reports";
import { setReviewStatusAction } from "@/app/actions/reviews";
import { setListingModerationAction, setProviderStatusAction } from "@/app/actions/admin";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

/** Resolves each report's target to something an admin can click through to. */
async function loadReports() {
  const rows = await db
    .select({ report: reports, reporterName: users.name })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterUserId))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  const targets = (await db.execute(sql`
    SELECT l.id, l.title AS label, l.slug, 'listing' AS kind, l.provider_id
    FROM listings l
    UNION ALL
    SELECT p.id, p.display_name AS label, p.slug, 'provider' AS kind, p.id AS provider_id
    FROM providers p
    UNION ALL
    SELECT r.id, left(r.body, 60) AS label, NULL AS slug, 'review' AS kind, r.provider_id
    FROM reviews r
  `)) as unknown as Array<Record<string, string>>;

  const byId = new Map(targets.map((t) => [t.id, t]));
  return rows.map((row) => ({ ...row, target: byId.get(row.report.targetId) ?? null }));
}

export default async function AdminReportsPage() {
  const rows = await loadReports();
  const open = rows.filter((r) => r.report.status === "open");
  const closed = rows.filter((r) => r.report.status !== "open");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Every report needs a decision. Dismissing is a decision — leaving it open is not."
      />

      {open.length === 0 ? (
        <EmptyState title="Queue is clear" description="No open reports." />
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Open ({open.length})
          </h2>
          {open.map(({ report, reporterName, target }) => (
            <Card key={report.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">{report.reason}</Badge>
                    <Badge tone="neutral">{report.targetType}</Badge>
                  </div>
                  <p className="mt-2 font-medium text-ink">
                    {target?.slug && report.targetType === "listing" ? (
                      <Link href={`/listings/${target.slug}`} className="hover:underline">
                        {target.label}
                      </Link>
                    ) : target?.slug && report.targetType === "provider" ? (
                      <Link
                        href={`/providers/${target.slug}`}
                        className="hover:underline"
                      >
                        {target.label}
                      </Link>
                    ) : (
                      (target?.label ?? "Target no longer exists")
                    )}
                  </p>
                  {report.details && (
                    <p className="mt-1 text-sm text-ink-muted">{report.details}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-muted">
                    Reported by {reporterName ?? "a signed-out visitor"} ·{" "}
                    {formatDate(report.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                {report.targetType === "listing" && target && (
                  <form action={setListingModerationAction} className="flex gap-2">
                    <input type="hidden" name="listingId" value={report.targetId} />
                    <input type="hidden" name="status" value="suspended" />
                    <Input
                      name="reason"
                      placeholder="Reason shown to the provider"
                      className="w-64"
                    />
                    <Button type="submit" variant="danger" size="sm">
                      Suspend listing
                    </Button>
                  </form>
                )}

                {report.targetType === "provider" && target && (
                  <form action={setProviderStatusAction} className="flex gap-2">
                    <input type="hidden" name="providerId" value={report.targetId} />
                    <input type="hidden" name="status" value="suspended" />
                    <Input name="reason" placeholder="Reason" className="w-64" />
                    <Button type="submit" variant="danger" size="sm">
                      Suspend provider
                    </Button>
                  </form>
                )}

                {report.targetType === "review" && (
                  <form action={setReviewStatusAction}>
                    <input type="hidden" name="reviewId" value={report.targetId} />
                    <input type="hidden" name="status" value="removed" />
                    <Button type="submit" variant="danger" size="sm">
                      Remove review
                    </Button>
                  </form>
                )}

                <form action={resolveReportAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="status" value="actioned" />
                  <Button type="submit" variant="secondary" size="sm">
                    Mark actioned
                  </Button>
                </form>

                <form action={resolveReportAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="status" value="dismissed" />
                  <Button type="submit" variant="ghost" size="sm">
                    Dismiss
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </section>
      )}

      {closed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Resolved
          </h2>
          {closed.slice(0, 20).map(({ report, target }) => (
            <Card key={report.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink">
                  {target?.label ?? report.targetType} — {report.reason}
                </span>
                <Badge tone={report.status === "actioned" ? "success" : "neutral"}>
                  {report.status}
                </Badge>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
