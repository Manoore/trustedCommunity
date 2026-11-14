import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import { avatarColor, initials } from "@/lib/category-colors";
import {
  KIND_EMOJI,
  KIND_LABELS,
  type HelpKind,
  type HelpPostView,
  type PosterCard,
} from "@/lib/help";

/**
 * The trust line is the point of this section. A listing on an aggregator has no
 * human behind it; here every post shows whether the person proved a college
 * address, how many newcomers they have genuinely helped, and how they connect to
 * you.
 */
export function TrustLine({ card, size = "sm" }: { card: PosterCard; size?: "sm" | "md" }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-2">
        <Avatar name={initials(card.name)} color={avatarColor(card.name)} size="sm" />
        <span className={size === "md" ? "text-base font-semibold text-ink" : "text-sm font-medium text-ink"}>
          {card.name}
        </span>
      </span>
      {card.verified ? (
        <Badge tone="success">✓ Verified student</Badge>
      ) : (
        <Badge tone="warning">Not verified</Badge>
      )}
      {card.helped > 0 && (
        <Badge tone="featured">
          ★ Helped {card.helped} {card.helped === 1 ? "newcomer" : "newcomers"}
        </Badge>
      )}
      {card.relation === "connection" && <Badge tone="brand">You are connected</Badge>}
      {card.relation === "friend_of_friend" && <Badge tone="coral">Friend of a friend</Badge>}
    </div>
  );
}

export function DirectionBadge({ direction }: { direction: "offer" | "need" }) {
  return direction === "offer" ? (
    <Badge tone="success">Offering</Badge>
  ) : (
    <Badge tone="coral">Needs</Badge>
  );
}

export function formatDateRange(startsOn: string | null, endsOn: string | null) {
  const fmt = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (startsOn && endsOn && startsOn !== endsOn) return `${fmt(startsOn)} – ${fmt(endsOn)}`;
  if (startsOn) return fmt(startsOn);
  return null;
}

export function HelpCard({ post }: { post: HelpPostView }) {
  const when = formatDateRange(post.startsOn, post.endsOn);
  const spotsLeft = Math.max(post.capacity - post.acceptedCount, 0);

  return (
    <article className="lift rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <DirectionBadge direction={post.direction} />
            <Badge tone="neutral">
              <span aria-hidden="true">{KIND_EMOJI[post.kind as HelpKind]}</span>{" "}
              {KIND_LABELS[post.kind as HelpKind]}
            </Badge>
            {post.isMine && <Badge tone="brand">Yours</Badge>}
            {post.myResponse && <Badge tone="gold">You responded · {post.myResponse.status}</Badge>}
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink">
            <Link href={`/help/${post.id}`} className="hover:underline">
              {post.title}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {[post.area, when].filter(Boolean).join(" · ") || "Details inside"}
            {post.direction === "offer" && post.capacity > 1 && ` · ${spotsLeft} of ${post.capacity} spots left`}
          </p>
        </div>
        <Link
          href={`/help/${post.id}`}
          className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
        >
          {post.isMine ? "Manage →" : "View →"}
        </Link>
      </div>

      {post.details && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{post.details}</p>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <TrustLine card={post.poster} />
      </div>
    </article>
  );
}
