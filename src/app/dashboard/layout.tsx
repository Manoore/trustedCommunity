import Link from "next/link";
import { getCurrentUser, getMemberships } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/listings", label: "Listings" },
  { href: "/dashboard/inquiries", label: "Inquiries" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/team", label: "Team" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const memberships = user ? await getMemberships(user.id) : [];
  const hasProvider = memberships.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
      {hasProvider && (
        <nav aria-label="Dashboard" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {memberships[0].providerName}
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
      )}
      <div className={hasProvider ? "" : "lg:col-span-2"}>{children}</div>
    </div>
  );
}
