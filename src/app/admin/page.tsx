import Link from "next/link";
import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHomePage() {
  const [row] = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM claim_requests WHERE status = 'open') AS open_claims,
      (SELECT count(*)::int FROM recommendations) AS recommendations,
      (SELECT count(*)::int FROM reports WHERE status = 'open') AS open_reports,
      (SELECT count(*)::int FROM verifications WHERE status = 'pending') AS pending_verifications,
      (SELECT count(*)::int FROM listings WHERE status = 'pending') AS pending_listings,
      (SELECT count(*)::int FROM listings WHERE status = 'suspended') AS suspended_listings,
      (SELECT count(*)::int FROM providers WHERE status = 'suspended') AS suspended_providers,
      (SELECT count(*)::int FROM users) AS users
  `)) as unknown as Array<Record<string, unknown>>;

  const cards = [
    {
      label: "Claims & removals waiting",
      value: row?.open_claims,
      href: "/admin/claims",
    },
    { label: "Recommendations", value: row?.recommendations, href: "/admin" },
    { label: "Open reports", value: row?.open_reports, href: "/admin/reports" },
    {
      label: "Licences awaiting review",
      value: row?.pending_verifications,
      href: "/admin/verifications",
    },
    {
      label: "Listings held pending",
      value: row?.pending_listings,
      href: "/admin/listings?status=pending",
    },
    {
      label: "Suspended listings",
      value: row?.suspended_listings,
      href: "/admin/listings?status=suspended",
    },
    { label: "Suspended providers", value: row?.suspended_providers, href: "/admin" },
    { label: "Registered users", value: row?.users, href: "/admin" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderation overview"
        description="Section 230 protects user-posted content, but only if there is a real takedown process behind it. This is that process."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="h-full transition-colors hover:border-line-strong">
              <p className="text-sm text-ink-muted">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                {Number(card.value ?? 0)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
