import Link from "next/link";

const columns = [
  {
    title: "Your list",
    links: [
      { href: "/list", label: "My recommendations" },
      { href: "/recommendations/new", label: "Add a recommendation" },
    ],
  },
  {
    title: "For businesses",
    links: [
      { href: "/business/claim", label: "List your business" },
      { href: "/legal/privacy", label: "How we handle your details" },
      { href: "/legal/content-policy", label: "Content policy" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of use" },
      { href: "/legal/privacy", label: "Privacy & your data" },
      { href: "/legal/accessibility", label: "Accessibility" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="font-semibold text-ink">Trusted By</p>
          <p className="mt-2 text-sm text-ink-muted">
            The people you trust, recommending the people you need. Every
            recommendation has a name on it.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-semibold text-ink">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={`${col.title}-${link.href}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-muted hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink-muted">
          <p>© {new Date().getFullYear()} Trusted By.</p>
          <p>
            Recommendations are written by the people named on them, not by this site.
          </p>
        </div>
      </div>
    </footer>
  );
}
