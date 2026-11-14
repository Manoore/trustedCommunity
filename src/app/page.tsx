import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Avatar, Card, LinkButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { avatarColor, categoryColor, categoryTint, initials } from "@/lib/category-colors";

/** A taste of what a list looks like, rendered as real cards on the hero. */
const SAMPLE = [
  {
    name: "Mike's Plumbing",
    category: "Plumbing",
    group: "home-improvement",
    quote: "Used them twice. Very responsive and reasonable.",
    strength: "My go-to",
  },
  {
    name: "Sarah Johnson",
    category: "Real Estate",
    group: "professional-services",
    quote: "Sold our house in nine days and talked us out of overpricing it.",
    strength: "My go-to",
  },
  {
    name: "Amar India",
    category: "Restaurants",
    group: "business-promotion",
    quote: "Best dosa in the area. Ask for the weekend thali.",
    strength: "Highly recommend",
  },
];

const CATEGORY_TASTER = [
  { name: "Plumbers", slug: "home-improvement", emoji: "🔧" },
  { name: "Mechanics", slug: "automotive", emoji: "🚗" },
  { name: "Hairdressers", slug: "beauty-wellness", emoji: "✂️" },
  { name: "Tutors", slug: "education", emoji: "📚" },
  { name: "Photographers", slug: "events", emoji: "📸" },
  { name: "Dog walkers", slug: "pets", emoji: "🐕" },
  { name: "Cleaners", slug: "home-services", emoji: "🧽" },
  { name: "Accountants", slug: "professional-services", emoji: "📊" },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/list");

  const [stats] = (await db.execute(sql`
    SELECT (SELECT count(*)::int FROM recommendations) AS recommendations
  `)) as unknown as Array<Record<string, unknown>>;

  const recommendationCount = Number(stats?.recommendations ?? 0);

  return (
    <div className="space-y-20">
      {/* ------------------------------------------------------------ hero */}
      <section className="warm-wash -mx-4 rounded-b-[2.5rem] px-4 pb-16 pt-10 sm:-mx-0 sm:rounded-3xl sm:px-10 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-coral-100 px-4 py-1.5 text-sm font-medium text-coral-700">
              <span aria-hidden="true">💬</span> Recommendations, not reviews
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              The people you trust,
              <br />
              <span className="text-brand-600">recommending</span> the
              <br />
              people you need.
            </h1>

            <p className="mt-5 max-w-lg text-lg text-ink-muted">
              You already have the good plumber, the honest mechanic, the tutor who
              actually turns up. Keep them in one place — and share them in one link.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/signup" size="lg">
                Start my list — free
              </LinkButton>
              <LinkButton href="/login" variant="secondary" size="lg">
                I already have one
              </LinkButton>
            </div>

            <p className="mt-5 text-sm text-ink-muted">
              <span aria-hidden="true">⭐</span> No star ratings. No anonymous strangers.
              {recommendationCount > 0 && (
                <> {recommendationCount} recommendations saved so far.</>
              )}
            </p>
          </div>

          {/* Stacked sample cards, angled so it reads as a real list. */}
          <div className="relative mx-auto w-full max-w-md lg:mx-0">
            {SAMPLE.map((s, i) => (
              <div
                key={s.name}
                className="lift mb-4 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
                style={{
                  borderLeft: `4px solid ${categoryColor(s.group)}`,
                  marginLeft: `${i * 14}px`,
                }}
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    name={initials(s.name)}
                    color={avatarColor(s.name)}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: categoryTint(s.group),
                          color: categoryColor(s.group),
                        }}
                      >
                        {s.category}
                      </span>
                      <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-medium text-white">
                        ★ {s.strength}
                      </span>
                    </div>
                    <p className="mt-1.5 font-semibold text-ink">{s.name}</p>
                    <p className="mt-1 text-sm italic text-ink-muted">“{s.quote}”</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- how it works */}
      <section>
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ink">
          Three things, and that is the whole app
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              emoji: "💾",
              title: "Save",
              body: "Name, number, category, and why you would send a friend. Under a minute.",
              tint: "#12866f",
            },
            {
              emoji: "🔎",
              title: "Find",
              body: "Your own list, colour-coded by category. No more scrolling through old texts.",
              tint: "#f96a52",
            },
            {
              emoji: "🔗",
              title: "Share",
              body: "One link. Whoever opens it sees who you recommend and why — no account needed.",
              tint: "#f0a413",
            },
          ].map((item) => (
            <Card key={item.title} className="lift">
              <div
                aria-hidden="true"
                className="grid h-12 w-12 place-items-center rounded-2xl text-2xl"
                style={{ backgroundColor: `${item.tint}1f` }}
              >
                {item.emoji}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- taster */}
      <section>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Everyone you keep meaning to write down
        </h2>
        <p className="mt-2 text-ink-muted">
          Anything from a plumber to a wedding photographer. 189 categories, all of them
          optional.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {CATEGORY_TASTER.map((c) => (
            <span
              key={c.name}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium"
              style={{
                backgroundColor: categoryTint(c.slug, 0.14),
                color: categoryColor(c.slug),
              }}
            >
              <span aria-hidden="true">{c.emoji}</span>
              {c.name}
            </span>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------- arriving somewhere new */}
      <section className="warm-wash rounded-3xl border border-line bg-surface p-8 sm:p-12">
        <div className="grid items-center gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-coral-100 px-4 py-1.5 text-sm font-medium text-coral-700">
              <span aria-hidden="true">✈️</span> New: for students arriving in a new country
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
              Land with people who already know the way.
            </h2>
            <p className="mt-3 max-w-lg text-ink-muted">
              An airport pickup, a bed for the first week, a room from someone graduating —
              each from a verified senior at your own college, with a record of who they have
              helped. No money through us, so nothing to be scammed out of.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/arrive" size="lg">
                See how arrival help works
              </LinkButton>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              ["🚗", "Pickup from the airport"],
              ["🛏️", "A first-week stay"],
              ["🏠", "A room or sublet handover"],
              ["🛒", "The grocery, SIM and bank the seniors use"],
            ].map(([emoji, label]) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-card)]"
              >
                <span aria-hidden="true" className="text-xl">{emoji}</span>
                <span className="font-medium text-ink">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------- why not reviews */}
      <section className="warm-wash rounded-3xl border border-line bg-surface p-8 sm:p-12">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Why not just use reviews?
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-base font-semibold text-ink">
              <span aria-hidden="true">🕵️</span> Star ratings are anonymous
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              You do not know who left them, or whether they ever hired the person. Here
              every recommendation has a name on it and says how that person knows them.
            </p>
          </div>
          <div>
            <p className="text-base font-semibold text-ink">
              <span aria-hidden="true">👍</span> There are no bad reviews here
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              You either vouch for someone or you say nothing at all. That is how word of
              mouth actually works, and it keeps the list worth reading.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ final CTA */}
      <section className="rounded-3xl bg-brand-600 px-8 py-12 text-center sm:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Who do you already recommend?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-brand-100">
          Start with one. Your list is private until you decide to share it.
        </p>
        <div className="mt-7 flex justify-center">
          <LinkButton href="/signup" size="lg" variant="coral">
            Start my list — free
          </LinkButton>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-ink">Run a business?</h2>
          <p className="mt-2 text-sm text-ink-muted">
            You do not have to wait to be recommended. List yourself, share your page
            with customers, and let their vouches do the rest.
          </p>
          <div className="mt-4">
            <LinkButton href="/business/claim" variant="secondary">
              List my business
            </LinkButton>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-ink">
            Listed here and did not ask to be?
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            If someone added you as a recommendation, you can claim the profile or have
            it removed — no account required. Open the profile and use the link at the
            bottom, or{" "}
            <Link
              href="/legal/privacy"
              className="font-medium text-brand-600 hover:underline"
            >
              read how we handle your details
            </Link>
            .
          </p>
        </Card>
      </section>
    </div>
  );
}
