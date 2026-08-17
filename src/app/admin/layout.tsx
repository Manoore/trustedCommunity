import Link from "next/link";
import { requireAdmin } from "@/lib/guards";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/claims", label: "Claims & removals" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/verifications", label: "Licence review" },
  { href: "/admin/listings", label: "Listings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin("/admin");

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Admin" className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Moderation
        </p>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div>{children}</div>
    </div>
  );
}
