import Link from "next/link";
import { Avatar, Badge, Button } from "@/components/ui";
import { createShareLinkAction } from "@/app/actions/recommendations";
import { countryName } from "@/lib/countries";
import {
  avatarColor,
  categoryColor,
  categoryTint,
  initials,
} from "@/lib/category-colors";
import {
  RELATIONSHIP_LABELS,
  STRENGTH_LABELS,
  VISIBILITY_LABELS,
  type relationshipValues,
  type strengthValues,
  type visibilityValues,
} from "@/lib/validation";

const VISIBILITY_ICONS: Record<(typeof visibilityValues)[number], string> = {
  private: "🔒",
  connections: "👥",
  groups: "🏘️",
  link: "🔗",
};

export type RecommendationCardData = {
  id: string;
  name: string;
  providerSlug: string;
  kind: "business" | "individual";
  phone: string | null;
  city: string | null;
  state: string | null;
  country?: string;
  websiteUrl: string | null;
  categoryName: string | null;
  categorySlug?: string | null;
  groupName: string | null;
  groupSlug?: string | null;
  note: string | null;
  relationship: (typeof relationshipValues)[number] | string;
  strength: (typeof strengthValues)[number];
  visibility?: (typeof visibilityValues)[number];
  otherRecommenders?: number;
  recommenderName?: string;
};

const strengthStyles = {
  go_to: { tone: "featured", icon: "★" },
  highly_recommend: { tone: "coral", icon: "♥" },
  recommend: { tone: "brand", icon: "" },
} as const;

export function RecommendationCard({
  item,
  showOwnerActions = false,
  showRecommender = false,
}: {
  item: RecommendationCardData;
  showOwnerActions?: boolean;
  showRecommender?: boolean;
}) {
  const location = [
    item.city,
    item.state,
    item.country && item.country !== "US" ? countryName(item.country) : null,
  ]
    .filter(Boolean)
    .join(", ");
  const hue = categoryColor(item.groupSlug ?? item.categorySlug);
  const strength = strengthStyles[item.strength];
  const relationshipLabel =
    RELATIONSHIP_LABELS[item.relationship as keyof typeof RELATIONSHIP_LABELS] ??
    item.relationship;

  return (
    <article
      className="lift group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
      style={{ borderLeft: `4px solid ${hue}` }}
    >
      {/* A wash of the category colour, so the card reads as belonging to it. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-70 transition-opacity group-hover:opacity-100"
        style={{ background: categoryTint(item.groupSlug ?? item.categorySlug, 0.16) }}
      />

      <div className="relative flex items-start gap-4">
        <Avatar name={initials(item.name)} color={avatarColor(item.name)} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={strength.tone}>
              {strength.icon && <span aria-hidden="true">{strength.icon}</span>}
              {STRENGTH_LABELS[item.strength]}
            </Badge>
            {item.categoryName && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: categoryTint(item.groupSlug), color: hue }}
              >
                {item.categoryName}
              </span>
            )}
            {item.kind === "individual" && <Badge tone="neutral">Person</Badge>}
          </div>

          <h3 className="mt-2 truncate text-lg font-semibold tracking-tight text-ink">
            <Link href={`/p/${item.providerSlug}`} className="hover:underline">
              {item.name}
            </Link>
          </h3>

          {location && <p className="text-sm text-ink-muted">{location}</p>}
        </div>

        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 sm:inline-flex"
          >
            <span aria-hidden="true">📞</span>
            {item.phone}
          </a>
        )}
      </div>

      {item.note && (
        <blockquote
          className="relative mt-4 rounded-xl px-4 py-3 text-sm italic text-ink"
          style={{ background: categoryTint(item.groupSlug ?? item.categorySlug, 0.09) }}
        >
          “{item.note}”
        </blockquote>
      )}

      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          {showRecommender && item.recommenderName && (
            <span className="font-medium text-ink">{item.recommenderName} · </span>
          )}
          {relationshipLabel}
          {item.otherRecommenders ? (
            <span className="ml-1 font-medium text-brand-600">
              · {item.otherRecommenders} other{" "}
              {item.otherRecommenders === 1 ? "person" : "people"} too
            </span>
          ) : null}
        </p>

        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 sm:hidden"
          >
            <span aria-hidden="true">📞</span>
            {item.phone}
          </a>
        )}
      </div>

      {showOwnerActions && (
        <div className="relative mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <Link
            href={`/recommendations/${item.id}/edit`}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Edit
          </Link>

          {/* Only link-scoped entries can be handed out as a public URL. */}
          {item.visibility === "link" ? (
            <form action={createShareLinkAction}>
              <input type="hidden" name="kind" value="recommendation" />
              <input type="hidden" name="recommendationId" value={item.id} />
              <Button type="submit" variant="ghost" size="sm">
                <span aria-hidden="true">↗</span> Share link
              </Button>
            </form>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <span aria-hidden="true">{VISIBILITY_ICONS[item.visibility ?? "private"]}</span>
              {VISIBILITY_LABELS[item.visibility ?? "private"]}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
