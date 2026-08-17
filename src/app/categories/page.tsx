import Link from "next/link";
import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getCategoryTree } from "@/lib/queries";

export const metadata: Metadata = {
  title: "All categories",
  description: "Every service category on NearSide, nationwide.",
};

export default async function CategoriesPage() {
  const tree = await getCategoryTree();
  const open = tree.filter((g) => !g.restricted);
  const restricted = tree.find((g) => g.restricted);

  return (
    <div className="space-y-8">
      <PageHeader
        title="All categories"
        description="Nationwide coverage. Empty categories are opportunities, not dead ends — the first provider in one owns the top of the page."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {open.map((group) => (
          <Card key={group.slug}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">
                  <Link
                    href={`/search?category=${group.slug}`}
                    className="hover:underline"
                  >
                    {group.name}
                  </Link>
                </h2>
                {group.description && (
                  <p className="mt-1 text-sm text-ink-muted">{group.description}</p>
                )}
              </div>
              <Badge tone={group.listingCount > 0 ? "brand" : "neutral"}>
                {group.listingCount} live
              </Badge>
            </div>

            <ul className="mt-4 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {group.children.map((child) => (
                <li key={child.slug}>
                  <Link
                    href={`/search?category=${child.slug}`}
                    className="flex items-baseline justify-between gap-2 text-sm text-ink-muted hover:text-ink"
                  >
                    <span className="truncate">
                      {child.name}
                      {child.licenseRequired && (
                        <span
                          className="ml-1 text-amber-600"
                          title="Licensed trade in most states"
                        >
                          ◆
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-xs">
                      {child.listingCount || "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <p className="text-xs text-ink-muted">
        <span className="text-amber-600">◆</span> Licensed trade. Listings in these
        categories must carry a state licence number, which an admin verifies before the
        listing goes live.
      </p>

      {restricted && (
        <Card>
          <h2 className="font-semibold text-ink">{restricted.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">{restricted.description}</p>
          <ul className="mt-4 space-y-2">
            {restricted.children.map((child) => (
              <li key={child.slug} className="text-sm">
                <span className="font-medium text-ink">{child.name}</span>
                {child.description && (
                  <span className="text-ink-muted"> — {child.description}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
