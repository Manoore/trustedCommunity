import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, EmptyState, LinkButton, Stars } from "@/components/ui";
import { ReportForm } from "@/components/report-form";
import { getCurrentUser } from "@/lib/auth";
import {
  getProviderBySlug,
  getProviderContact,
  hasUnlockedContact,
} from "@/lib/queries";
import {
  formatDate,
  formatPrice,
  locationLabel,
  maskEmailFromParts,
  maskPhoneFromTail,
} from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProviderBySlug(slug);
  if (!data) return { title: "Provider not found" };
  return {
    title: data.provider.displayName,
    description: data.provider.headline ?? undefined,
  };
}

export default async function ProviderPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProviderBySlug(slug);
  if (!data) notFound();

  const { provider, listings, reviews, team } = data;
  const user = await getCurrentUser();
  const unlocked = user ? await hasUnlockedContact(user.id, provider.id) : false;
  const contact = unlocked ? await getProviderContact(provider.id) : null;

  if (provider.status === "suspended" && user?.role !== "admin") notFound();

  return (
    <div className="space-y-8">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={provider.type === "entity" ? "brand" : "neutral"}>
                {provider.type === "entity" ? "Business" : "Individual"}
              </Badge>
              {provider.verifiedAt && <Badge tone="success">Verified</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {provider.displayName}
            </h1>
            {provider.legalName && provider.legalName !== provider.displayName && (
              <p className="text-sm text-ink-muted">Legal name: {provider.legalName}</p>
            )}
            {provider.headline && (
              <p className="mt-1 text-sm text-ink-muted">{provider.headline}</p>
            )}
            <p className="mt-2 text-sm text-ink-muted">
              {locationLabel(provider)} · member since {formatDate(provider.createdAt)}
            </p>
          </div>

          <div className="text-right">
            <Stars value={provider.ratingAvg} count={provider.ratingCount} />
            <div className="mt-3 text-sm">
              {unlocked && contact ? (
                <ul className="space-y-1">
                  {contact.contactPhone && (
                    <li>
                      <a
                        href={`tel:${contact.contactPhone}`}
                        className="text-brand-600 hover:underline"
                      >
                        {contact.contactPhone}
                      </a>
                    </li>
                  )}
                  {contact.contactEmail && (
                    <li>
                      <a
                        href={`mailto:${contact.contactEmail}`}
                        className="text-brand-600 hover:underline"
                      >
                        {contact.contactEmail}
                      </a>
                    </li>
                  )}
                </ul>
              ) : (
                <div className="text-ink-muted">
                  <p>{maskPhoneFromTail(provider.phoneTail) ?? "Phone on file"}</p>
                  <p>
                    {maskEmailFromParts(provider.emailHead, provider.emailDomain) ??
                      "Email on file"}
                  </p>
                  <p className="mt-1 text-xs">Unlocks after they reply to an inquiry.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {provider.bio && (
          <div className="mt-5 space-y-3 border-t border-line pt-5 text-sm leading-relaxed text-ink">
            {provider.bio.split("\n").filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {team.length > 1 && (
          <div className="mt-5 border-t border-line pt-5">
            <h2 className="text-sm font-semibold text-ink">Team</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {team.map((member) => (
                <li key={member.name}>
                  <Badge tone="neutral">
                    {member.name} · {member.role}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">
          Listings ({listings.length})
        </h2>
        {listings.length === 0 ? (
          <EmptyState
            title="No live listings"
            description="This provider has no active listings right now."
            action={<LinkButton href="/search" variant="secondary">Browse other providers</LinkButton>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {listings.map(({ listing, category }) => (
              <Card key={listing.id}>
                <Badge tone="neutral">{category.name}</Badge>
                <h3 className="mt-2 font-semibold text-ink">
                  <Link href={`/listings/${listing.slug}`} className="hover:underline">
                    {listing.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {locationLabel(listing, listing.remoteOk)} · {formatPrice(listing)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">
          Reviews ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No reviews yet. Only buyers whose inquiry got a reply can leave one.
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map(({ review, authorName, listingTitle }) => (
              <Card key={review.id}>
                <div className="flex items-center justify-between gap-2">
                  <Stars value={review.rating} />
                  <span className="text-xs text-ink-muted">
                    {formatDate(review.createdAt)}
                  </span>
                </div>
                {review.title && (
                  <p className="mt-2 font-medium text-ink">{review.title}</p>
                )}
                <p className="mt-1 text-sm text-ink-muted">{review.body}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  — {authorName} · {listingTitle}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ReportForm targetType="provider" targetId={provider.id} />
    </div>
  );
}
