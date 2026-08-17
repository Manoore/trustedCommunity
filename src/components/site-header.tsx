import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Button, LinkButton } from "@/components/ui";

const NAV = [
  { href: "/list", label: "My list" },
  { href: "/discover", label: "Discover" },
  { href: "/asks", label: "Asks" },
  { href: "/people", label: "People" },
  { href: "/groups", label: "Groups" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link
          href={user ? "/list" : "/"}
          className="flex items-center gap-2 font-semibold text-ink"
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white shadow-sm"
          >
            ♥
          </span>
          <span className="text-lg tracking-tight">Trusted By</span>
        </Link>

        <nav className="ml-auto flex flex-wrap items-center gap-1" aria-label="Main">
          {user ? (
            <>
              <div className="order-last w-full overflow-x-auto sm:order-none sm:w-auto">
                <ul className="flex items-center gap-1">
                  {NAV.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block whitespace-nowrap rounded-full px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  {user.role === "admin" && (
                    <li>
                      <Link
                        href="/admin"
                        className="block whitespace-nowrap rounded-full px-3 py-2 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      >
                        Admin
                      </Link>
                    </li>
                  )}
                </ul>
              </div>

              <LinkButton href="/recommendations/new" size="sm" variant="coral">
                <span aria-hidden="true">＋</span> Add
              </LinkButton>
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/signup" size="sm">
                Start my list
              </LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
