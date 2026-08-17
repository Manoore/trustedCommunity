import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recommendations } from "@/db/schema";
import { Alert, Avatar, Badge, Card, LinkButton } from "@/components/ui";
import { avatarColor, initials } from "@/lib/category-colors";
import { getCurrentUser } from "@/lib/auth";
import { getProviderContact } from "@/lib/queries";
import { getContactProfile } from "@/lib/recommendations";
import { maskPhoneFromTail } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import {
  RELATIONSHIP_LABELS,
  STRENGTH_LABELS,
  type relationshipValues,
  type strengthValues,
} from "@/lib/validation";

const strengthTone = {
  go_to: "featured",
  highly_recommend: "coral",
  recommend: "brand",
} as const;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ listed?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getContactProfile(slug);
  return data ? { title: data.provider.displayName } : { title: "Not found" };
}

export default async function ContactProfilePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { listed } = await searchParams;
  const data = await getContactProfile(slug);
  if (!data) notFound();

  const { provider, vouches } = data;
  const user = await getCurrentUser();
  const isOwner = provider.createdByUserId === user?.id;

  const myVouch = user
    ? await db
        .select({ id: recommendations.id })
        .from(recommendations)
        .where(
          and(
            eq(recommendations.providerId, provider.id),
            eq(recommendations.recommenderUserId, user.id),
          ),
        )
        .limit(1)
    : [];

  /**
   * A private individual's number is not public. It is shown to the person who
   * added them and to anyone who has independently vouched for them — people
   * who already had the number. Everyone else sees the masked form.
   */
  const isIndividual = provider.kind === "individual";
  const knowsThem =
    myVouch.length > 0 ||
    provider.createdByUserId === user?.id ||
    user?.role === "admin";
  const showPhone = !isIndividual ? Boolean(user) : knowsThem;

  // Fetched only once we know the viewer may see it.
  const contact = showPhone ? await getProviderContact(provider.id) : null;
  const location = [provider.city, provider.state].filter(Boolean).join(", ");

  const selfListedNoVouches = Boolean(provider.selfListedAt) && vouches.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {listed && isOwner && (
        <Alert tone="success">
          Your business is listed. Share this page with happy customers — when they sign
          in and click &ldquo;I recommend them too&rdquo;, their vouch shows up below and
          your profile starts appearing in their network&apos;s Discover.
        </Alert>
      )}

      <section className="warm-wash flex flex-wrap items-center gap-5 rounded-3xl border border-line bg-surface p-6">
        <Avatar
          name={initials(provider.displayName)}
          color={avatarColor(provider.displayName)}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {selfListedNoVouches && (
              <Badge tone="neutral">
                <span aria-hidden="true">🏷️</span> Self-listed
              </Badge>
            )}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
            {provider.displayName}
          </h1>
          {provider.headline && (
            <p className="mt-0.5 text-sm text-ink">{provider.headline}</p>
          )}
          <p className="mt-1 text-sm text-ink-muted">
            {[provider.kind === "individual" ? "Person" : "Business", location]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p
            className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
              vouches.length > 0
                ? "bg-brand-50 text-brand-700"
                : "bg-surface-sunken text-ink-muted"
            }`}
          >
            <span aria-hidden="true">♥</span>
            {vouches.length > 0
              ? `Recommended by ${vouches.length} ${vouches.length === 1 ? "person" : "people"}`
              : "Not recommended by anyone yet"}
          </p>
        </div>

        {myVouch.length ? (
          <LinkButton
            href={`/recommendations/${myVouch[0].id}/edit`}
            variant="secondary"
          >
            Edit my recommendation
          </LinkButton>
        ) : user ? (
          <LinkButton href="/recommendations/new" variant="coral">
            I recommend them too
          </LinkButton>
        ) : null}
      </section>

      {selfListedNoVouches && (
        <Alert tone="info">
          {provider.displayName} added this profile themselves — nobody has recommended
          them here yet. That is not a red flag, just worth knowing: on this site,
          recommendations carry the trust, not the listing.
        </Alert>
      )}

      {provider.bio && (
        <Card>
          <h2 className="text-sm font-semibold text-ink">About</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{provider.bio}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-ink">Contact</h2>
        <div className="mt-2 space-y-1 text-sm">
          {contact?.contactPhone ? (
            <a
              href={`tel:${contact.contactPhone}`}
              className="text-brand-600 hover:underline"
            >
              {normalizePhone(contact.contactPhone)?.display ?? contact.contactPhone}
            </a>
          ) : (
            <p className="text-ink-muted">
              {maskPhoneFromTail(provider.phoneTail) ?? "Phone on file"}
            </p>
          )}
          {provider.websiteUrl && (
            <p>
              <a
                href={provider.websiteUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                Website
              </a>
            </p>
          )}
        </div>

        {isIndividual && !showPhone && (
          <p className="mt-3 text-xs text-ink-muted">
            This is a private individual, so their number is only shared with people who
            already know them.
          </p>
        )}
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">What people say</h2>

        {vouches.length === 0 ? (
          <p className="text-sm text-ink-muted">No recommendations yet.</p>
        ) : (
          <div className="stagger space-y-3">
            {vouches.map((v) => (
              <Card key={v.id} className="lift">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-medium text-ink">
                    <Avatar
                      name={initials(v.recommenderName)}
                      color={avatarColor(v.recommenderName)}
                      size="sm"
                    />
                    {v.recommenderName} recommends {provider.displayName}
                  </p>
                  <Badge tone={strengthTone[v.strength as (typeof strengthValues)[number]]}>
                    {v.strength === "go_to" && <span aria-hidden="true">★</span>}
                    {STRENGTH_LABELS[v.strength as (typeof strengthValues)[number]]}
                  </Badge>
                </div>
                {v.note && (
                  <blockquote className="mt-2 border-l-2 border-brand-200 pl-3 text-sm text-ink">
                    “{v.note}”
                  </blockquote>
                )}
                <p className="mt-2 text-xs text-ink-muted">
                  {
                    RELATIONSHIP_LABELS[
                      v.relationship as (typeof relationshipValues)[number]
                    ]
                  }
                  {v.categoryName && ` · ${v.categoryName}`}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {isIndividual && (
        <Alert tone="info">
          Are you {provider.displayName}?{" "}
          <Link href={`/claim/${provider.slug}`} className="font-medium underline">
            Claim this profile or ask us to remove it
          </Link>
          . You do not need an account.
        </Alert>
      )}
    </div>
  );
}
