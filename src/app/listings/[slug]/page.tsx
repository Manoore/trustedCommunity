import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge, Card, Stars } from "@/components/ui";
import { InquiryForm } from "@/components/inquiry-form";
import { ReportForm } from "@/components/report-form";
import { getCurrentUser, getMemberships } from "@/lib/auth";
import {
  getListingBySlug,
  getListingReviews,
  getProviderContact,
  hasUnlockedContact,
} from "@/lib/queries";
import {
  formatDate,
  formatPrice,
  locationLabel,
  maskEmailFromParts,
  maskPhoneFromTail,
  pluralize,
  timeAgo,
} from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getListingBySlug(slug);
  if (!data) return { title: "Listing not found" };
  return {
    title: data.listing.title,
    description: data.listing.description.slice(0, 155),
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const data = await getListingBySlug(slug);
  if (!data) notFound();

  const { listing, provider, category } = data;
  const user = await getCurrentUser();
  const memberships = user ? await getMemberships(user.id) : [];
  const isOwner = memberships.some((m) => m.providerId === provider.id);
  const unlocked =
    isOwner || (user ? await hasUnlockedContact(user.id, provider.id) : false);
  // Loaded only once access is established - see providerPublicColumns.
  const contact = unlocked ? await getProviderContact(provider.id) : null;
  const reviews = await getListingReviews(listing.id);

  // A listing that is not live is only visible to its own team.
  if (listing.status !== "active" && !isOwner && user?.role !== "admin") notFound();

  const featured =
    listing.featuredUntil != null && new Date(listing.featuredUntil) > new Date();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {listing.status !== "active" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This listing is <strong>{listing.status}</strong> and is not visible to
            buyers.
            {listing.rejectionReason && <> Reason: {listing.rejectionReason}</>}
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {featured && <Badge tone="featured">Featured</Badge>}
            <Link href={`/search?category=${category.slug}`}>
              <Badge tone="neutral">{category.name}</Badge>
            </Link>
            {provider.type === "entity" && <Badge tone="brand">Business</Badge>}
            {provider.verifiedAt && <Badge tone="success">Verified</Badge>}
            {category.licenseRequired && <Badge tone="warning">Licensed trade</Badge>}
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            {listing.title}
          </h1>

          <p className="mt-2 text-sm text-ink-muted">
            {locationLabel(listing, listing.remoteOk)}
            {!listing.remoteOk && <> · travels up to {listing.serviceRadiusMiles} mi</>}
            {" · "}
            posted {timeAgo(listing.createdAt)}
          </p>
        </div>

        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xl font-semibold text-ink">{formatPrice(listing)}</p>
            <p className="text-sm text-ink-muted">
              {listing.viewCount} views · {listing.inquiryCount}{" "}
              {pluralize(listing.inquiryCount, "inquiry", "inquiries")}
            </p>
          </div>
        </Card>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink">About this service</h2>
          <div className="space-y-3 text-sm leading-relaxed text-ink">
            {listing.description.split("\n").filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>

        {category.licenseRequired && (
          <Card>
            <h2 className="text-sm font-semibold text-ink">Licence details</h2>
            {listing.licenseNumber ? (
              <p className="mt-1 text-sm text-ink-muted">
                Licence {listing.licenseNumber}
                {listing.licenseState && <> · {listing.licenseState}</>}. Verify this
                against your state licensing board before work starts.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">
                No licence number on file. {category.name} normally requires a state
                licence — ask for it before hiring.
              </p>
            )}
          </Card>
        )}

        <section id="contact" className="scroll-mt-24">
          <h2 className="mb-3 text-lg font-semibold text-ink">
            Contact {provider.displayName}
          </h2>
          <Card>
            {isOwner ? (
              <p className="text-sm text-ink-muted">
                This is your listing.{" "}
                <Link
                  href={`/dashboard/listings/${listing.id}/edit`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Edit it
                </Link>
                .
              </p>
            ) : (
              <InquiryForm
                listingId={listing.id}
                listingSlug={listing.slug}
                providerName={provider.displayName}
                signedIn={Boolean(user)}
                defaults={{
                  name: user?.name,
                  email: user?.email,
                  phone: user?.phone ?? undefined,
                }}
              />
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">
            Reviews ({reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No reviews yet. Reviews here can only be left by buyers who sent an inquiry
              and got a reply.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map(({ review, authorName }) => (
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
                  <p className="mt-2 text-xs text-ink-muted">— {authorName}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="pt-2">
          <ReportForm targetType="listing" targetId={listing.id} />
        </div>
      </div>

      {/* ------------------------------------------------------ provider rail */}
      <aside className="space-y-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-muted">
            {provider.type === "entity" ? "Business" : "Individual provider"}
          </p>
          <h2 className="mt-1 font-semibold text-ink">
            <Link href={`/providers/${provider.slug}`} className="hover:underline">
              {provider.displayName}
            </Link>
          </h2>
          {provider.headline && (
            <p className="mt-1 text-sm text-ink-muted">{provider.headline}</p>
          )}

          <div className="mt-3">
            <Stars value={provider.ratingAvg} count={provider.ratingCount} />
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            {provider.yearsExperience != null && (
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Experience</dt>
                <dd className="text-ink">{provider.yearsExperience} years</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Based in</dt>
              <dd className="text-ink">{locationLabel(provider)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Member since</dt>
              <dd className="text-ink">{formatDate(provider.createdAt)}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Contact
            </p>
            {unlocked && contact ? (
              <ul className="mt-2 space-y-1 text-sm">
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
                {contact.websiteUrl && (
                  <li>
                    <a
                      href={contact.websiteUrl}
                      rel="nofollow noopener noreferrer"
                      target="_blank"
                      className="text-brand-600 hover:underline"
                    >
                      Website
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-ink-muted">
                <p>{maskPhoneFromTail(provider.phoneTail) ?? "Phone on file"}</p>
                <p>
                  {maskEmailFromParts(provider.emailHead, provider.emailDomain) ??
                    "Email on file"}
                </p>
                <p className="mt-2 text-xs">
                  Full details unlock as soon as {provider.displayName} replies to your
                  inquiry.
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-ink">Before you hire</h2>
          <ul className="mt-2 space-y-2 text-sm text-ink-muted">
            <li>Get the quote in writing through the inbox here.</li>
            <li>For licensed trades, check the licence number with your state board.</li>
            <li>Ask for proof of insurance on any work at your property.</li>
            <li>Never wire money or pay in gift cards.</li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}
