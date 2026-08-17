import Link from "next/link";
import { Badge, Stars } from "@/components/ui";
import { formatPrice, locationLabel } from "@/lib/format";
import type { SearchResult } from "@/lib/search";

function excerpt(text: string, max = 150) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

export function ListingCard({ item }: { item: SearchResult }) {
  return (
    <article className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-strong">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.featured && <Badge tone="featured">Featured</Badge>}
            <Badge tone="neutral">{item.categoryName}</Badge>
            {item.providerType === "entity" && <Badge tone="brand">Business</Badge>}
            {item.providerVerified && <Badge tone="success">Verified</Badge>}
            {item.licenseRequired && <Badge tone="warning">Licensed trade</Badge>}
          </div>

          <h3 className="mt-2 text-base font-semibold text-ink">
            <Link href={`/listings/${item.slug}`} className="hover:underline">
              {item.title}
            </Link>
          </h3>

          <p className="mt-1 text-sm text-ink-muted">
            <Link href={`/providers/${item.providerSlug}`} className="hover:underline">
              {item.providerName}
            </Link>
            {" · "}
            {locationLabel(item, item.remoteOk)}
            {item.distanceMiles != null && !item.remoteOk && (
              <> · {Math.round(item.distanceMiles)} mi away</>
            )}
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-ink">{formatPrice(item)}</p>
          <div className="mt-1">
            <Stars value={item.ratingAvg} count={item.ratingCount} />
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink-muted">{excerpt(item.description)}</p>

      <div className="mt-4 flex items-center gap-3">
        <Link
          href={`/listings/${item.slug}`}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          View details
        </Link>
        <Link
          href={`/listings/${item.slug}#contact`}
          className="text-sm font-medium text-ink-muted hover:text-ink"
        >
          Send inquiry
        </Link>
      </div>
    </article>
  );
}
