import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recommendations } from "@/db/schema";
import { Alert, Avatar, Badge, Button, Card, LinkButton } from "@/components/ui";
import QRCode from "qrcode";
import { ShareBar } from "@/components/share-bar";
import { quickVouchAction } from "@/app/actions/recommendations";
import { countryName } from "@/lib/countries";
import { IMMIGRATION_WARNING, PROFESSIONAL_DISCLAIMER } from "@/lib/professional";
import { getOrigin } from "@/lib/site";
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

const VOUCH_NOTICES: Record<string, { tone: "success" | "info" | "error"; text: string }> = {
  saved: {
    tone: "success",
    text: "Saved to your list, privately. Edit it to say how you know them or to share it.",
  },
  exists: { tone: "info", text: "They are already on your list." },
  limited: { tone: "error", text: "Slow down a little — try again in a few minutes." },
  missing: { tone: "error", text: "That contact is no longer available." },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ listed?: string; vouch?: string }>;
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
  const { listed, vouch } = await searchParams;
  const vouchNotice = vouch ? VOUCH_NOTICES[vouch] : null;
  const user = await getCurrentUser();
  const data = await getContactProfile(slug, user?.id ?? null);
  if (!data) notFound();

  const { provider, vouches } = data;
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
  const location = [
    provider.city,
    provider.state,
    provider.country !== "US" ? countryName(provider.country) : null,
  ]
    .filter(Boolean)
    .join(", ");
  const origin = await getOrigin();
  const profileUrl = `${origin}/p/${provider.slug}`;

  // Doctors and lawyers carry extra context wherever they appear.
  const professional = vouches.some((v) => v.professional);
  const immigration = vouches.some((v) => v.categorySlug === "immigration-attorney");

  // The business's own promotion kit: only for whoever listed it themselves.
  const showPromote = Boolean(provider.selfListedAt) && isOwner && provider.kind === "business";
  const badgeUrl = `${origin}/p/${provider.slug}/badge`;
  const embedCode = `<a href="${profileUrl}"><img src="${badgeUrl}" alt="Recommended on Trusted By" width="360" height="84"></a>`;
  const qr = showPromote
    ? await QRCode.toDataURL(profileUrl, { margin: 1, width: 220, color: { dark: "#12866f", light: "#ffffff" } })
    : null;

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
              : "No recommendations you can see yet"}
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
          <form action={quickVouchAction}>
            <input type="hidden" name="providerId" value={provider.id} />
            <input type="hidden" name="returnTo" value={`/p/${provider.slug}`} />
            <Button type="submit" variant="coral">
              Save to my list
            </Button>
          </form>
        ) : (
          <LinkButton href={`/login?next=${encodeURIComponent(`/p/${provider.slug}`)}`} variant="coral">
            Sign in to save
          </LinkButton>
        )}
      </section>

      {vouchNotice && <Alert tone={vouchNotice.tone}>{vouchNotice.text}</Alert>}

      {professional && (
        <Card className="border-amber-300 bg-amber-50/60">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-ink">Before you contact them</h2>
            {provider.verifiedAt ? (
              <Badge tone="success">✓ Licence checked</Badge>
            ) : (
              <Badge tone="warning">Licence not checked yet</Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-ink-muted">{PROFESSIONAL_DISCLAIMER}</p>
          {immigration && (
            <p className="mt-2 text-sm font-medium text-amber-800">{IMMIGRATION_WARNING}</p>
          )}
          {provider.websiteUrl && (
            <p className="mt-3 text-sm">
              Book or enquire through{" "}
              <a
                href={provider.websiteUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="font-medium text-brand-700 underline"
              >
                their own website
              </a>
              . We do not take bookings or hold any personal details.
            </p>
          )}
        </Card>
      )}

      {showPromote && qr && (
        <Card className="warm-wash space-y-4">
          <div>
            <h2 className="font-semibold text-ink">Promote your page</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Put this on your website or in your shop window. It only ever shows
              recommendations people made public, and it is free — selling it would
              make the trust it signals worth less.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR code for ${provider.displayName}'s page`} width={160} height={160} className="rounded-xl border border-line bg-white p-1" />
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeUrl} alt="Recommended on Trusted By badge" width={360} height={84} className="max-w-full" />
              <label className="block text-xs font-medium text-ink-muted" htmlFor="embed">
                Embed code
              </label>
              <textarea
                id="embed"
                readOnly
                rows={3}
                value={embedCode}
                className="w-full rounded-lg border border-line-strong bg-surface p-3 font-mono text-xs text-ink"
              />
            </div>
          </div>
        </Card>
      )}

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

      <Card>
        <h2 className="text-sm font-semibold text-ink">Pass {provider.displayName} on</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Know someone who needs this? Send them the profile.
        </p>
        <div className="mt-3">
          <ShareBar
            url={profileUrl}
            text={`${provider.displayName} — recommended on Trusted By:`}
            label="Share this profile"
          />
        </div>
      </Card>

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
