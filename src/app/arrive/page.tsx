import Link from "next/link";
import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Alert, Badge, Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { AddCollegeForm } from "@/components/add-college-form";
import { EduVerifyForm } from "@/components/edu-verify-form";
import { selectCollegeAction } from "@/app/actions/college";
import { quickVouchAction } from "@/app/actions/recommendations";
import { getCurrentUser } from "@/lib/auth";
import {
  countCollegeMembers,
  getCollegeGroup,
  getUserCollegeState,
  searchColleges,
} from "@/lib/colleges";
import { ESSENTIALS, SAFETY_RULES } from "@/lib/arrival";
import { getGroupTopContacts } from "@/lib/discover";
import { getBoardCounts, getMyHelpActivity, KIND_EMOJI, KIND_LABELS, type HelpKind } from "@/lib/help";

export const metadata: Metadata = { title: "Arriving somewhere new" };

type Props = { searchParams: Promise<{ q?: string; change?: string }> };

const KINDS: HelpKind[] = ["pickup", "temp_stay", "room", "item"];

export default async function ArrivePage({ searchParams }: Props) {
  const { q, change } = await searchParams;
  const user = await getCurrentUser();

  /* ----------------------------------------------------------- signed out */
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="warm-wash rounded-3xl border border-line bg-surface px-6 py-12 sm:px-10">
          <Badge tone="coral">For students arriving in a new country</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
            Land with people who already know the way.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-muted">
            A pickup at the airport. A bed for the first week. A room from someone who is
            graduating. Every one from a senior at your own college, with a name on it and a
            record of who they have helped.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LinkButton href="/signup" size="lg">
              Get started — free
            </LinkButton>
            <LinkButton href="/login?next=/arrive" variant="secondary" size="lg">
              I have an account
            </LinkButton>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { e: "🎓", t: "Verified students only", b: "Everything sits behind a college email address, so you are dealing with real people from your own campus." },
            { e: "🤝", t: "Vouched, not listed", b: "Every helper shows how many newcomers they have genuinely helped and what they said." },
            { e: "🚫", t: "No money through us", b: "No deposits, no fees, no payments. That is how rental scams work, so we left it out." },
          ].map((c) => (
            <Card key={c.t}>
              <span aria-hidden="true" className="text-2xl">{c.e}</span>
              <h2 className="mt-2 font-semibold text-ink">{c.t}</h2>
              <p className="mt-1 text-sm text-ink-muted">{c.b}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const state = await getUserCollegeState(user.id);

  /* ------------------------------------------------------- choose a college */
  if (!state.college || change) {
    const results = await searchColleges(q ?? "");
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Where are you studying?"
          description="Pick your college. This does not unlock anything yet — you will confirm it with your student email next."
        />

        <Card>
          <form action="/arrive" method="get" role="search" className="flex gap-2">
            {change && <input type="hidden" name="change" value="1" />}
            <label htmlFor="q" className="sr-only">Search colleges</label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Search by name, city or email domain…"
              className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-5 text-sm text-ink placeholder:text-ink-muted"
            />
            <Button type="submit">Search</Button>
          </form>

          <ul className="mt-4 divide-y divide-line">
            {results.length === 0 && (
              <li className="py-4 text-sm text-ink-muted">
                Nothing matches &ldquo;{q}&rdquo;. Add it below.
              </li>
            )}
            {results.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{c.name}</p>
                  <p className="text-sm text-ink-muted">
                    {c.city}, {c.state}
                    {c.domain && ` · @${c.domain}`}
                  </p>
                </div>
                <form action={selectCollegeAction}>
                  <input type="hidden" name="collegeId" value={c.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    This one
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>

        <details className="group rounded-2xl border border-line bg-surface p-5">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            My college is not listed
          </summary>
          <div className="mt-4">
            <AddCollegeForm />
          </div>
        </details>
      </div>
    );
  }

  /* --------------------------------------------------------- have a college */
  const college = state.college;
  const group = await getCollegeGroup(college.id);

  type Essential = (typeof ESSENTIALS)[number] & {
    top: Awaited<ReturnType<typeof getGroupTopContacts>>;
  };

  let counts: Record<string, number> = {};
  let activity: Awaited<ReturnType<typeof getMyHelpActivity>> = [];
  let members = 0;
  let essentials: Essential[] = ESSENTIALS.map((e) => ({ ...e, top: [] }));
  let vouched = false;

  if (state.verified) {
    [counts, activity, members] = await Promise.all([
      getBoardCounts(college.id),
      getMyHelpActivity(user.id),
      countCollegeMembers(college.id),
    ]);

    if (group) {
      essentials = await Promise.all(
        ESSENTIALS.map(async (e) => ({
          ...e,
          top: await getGroupTopContacts(group.id, user.id, { categorySlug: e.slug, limit: 3 }),
        })),
      );

      const rows = (await db.execute(sql`
        SELECT count(*)::int AS n FROM recommendation_groups rg
        JOIN recommendations r ON r.id = rg.recommendation_id
        WHERE rg.group_id = ${group.id}::uuid AND r.recommender_user_id = ${user.id}::uuid
      `)) as unknown as Array<{ n: number }>;
      vouched = Number(rows[0]?.n ?? 0) > 0;
    }
  }

  const posted = activity.some((a) => a.role === "posted");
  const steps = [
    { done: true, label: `Chose ${college.name}` },
    { done: state.verified, label: "Verified your student email" },
    { done: posted, label: "Posted a request or an offer" },
    { done: vouched, label: "Recommended someone to your college community" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-8">
      <section className="warm-wash rounded-3xl border border-line bg-surface px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-coral-600">Your arrival</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">{college.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {college.city}, {college.state}
              {college.airport && ` · Nearest airport: ${college.airport}`}
              {state.verified && members > 0 && ` · ${members} verified ${members === 1 ? "student" : "students"}`}
            </p>
          </div>
          <Link href="/arrive?change=1" className="text-sm text-ink-muted underline hover:text-ink">
            Not your college?
          </Link>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">
              {doneCount} of {steps.length} done
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-label="Arrival progress"
          >
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={[
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold",
                    s.done ? "bg-brand-500 text-white" : "border border-line-strong text-transparent",
                  ].join(" ")}
                >
                  ✓
                </span>
                <span className={s.done ? "text-ink" : "text-ink-muted"}>{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {!state.verified ? (
        <Card className="warm-wash">
          <h2 className="text-lg font-semibold text-ink">Verify your student email</h2>
          <p className="mt-1 max-w-lg text-sm text-ink-muted">
            This is the one gate in front of everything — the help board, stays and your
            college community. It proves you belong without asking where you are from.
          </p>
          <div className="mt-5 max-w-md">
            <EduVerifyForm domain={college.domain} collegeName={college.name} />
          </div>
        </Card>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Help from your college</h2>
                <p className="text-sm text-ink-muted">What seniors are offering, and what newcomers are asking for.</p>
              </div>
              <div className="flex gap-2">
                <LinkButton href="/help/new?direction=need" variant="coral" size="sm">I need help</LinkButton>
                <LinkButton href="/help/new?direction=offer" variant="secondary" size="sm">I can help</LinkButton>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {KINDS.map((k) => {
                const offers = counts[`offer:${k}`] ?? 0;
                const needs = counts[`need:${k}`] ?? 0;
                return (
                  <Link key={k} href={`/help?kind=${k}`}>
                    <Card className="lift h-full">
                      <span aria-hidden="true" className="text-2xl">{KIND_EMOJI[k]}</span>
                      <h3 className="mt-2 font-semibold text-ink">{KIND_LABELS[k]}</h3>
                      <p className="mt-1 text-sm text-ink-muted">
                        <span className="font-medium text-brand-700">{offers}</span> offered ·{" "}
                        <span className="font-medium text-coral-600">{needs}</span> asking
                      </p>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Set up your first weeks</h2>
              <p className="text-sm text-ink-muted">
                The most-recommended names from {college.name} students, in each essential.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {essentials.map((e) => (
                <Card key={e.slug}>
                  <h3 className="flex items-center gap-2 font-semibold text-ink">
                    <span aria-hidden="true">{e.emoji}</span> {e.label}
                  </h3>
                  {e.top.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-muted">
                      {e.hint} Nobody has recommended one yet —{" "}
                      <Link href="/recommendations/new" className="font-medium text-brand-600 underline">
                        be the first
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {e.top.map((c) => (
                        <li key={c.providerId} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0">
                            <Link href={`/p/${c.slug}`} className="font-medium text-ink hover:underline">
                              {c.name}
                            </Link>
                            <span className="text-ink-muted"> · {c.members} {c.members === 1 ? "student" : "students"}</span>
                          </span>
                          {!c.mine && group && (
                            <form action={quickVouchAction}>
                              <input type="hidden" name="providerId" value={c.providerId} />
                              <input type="hidden" name="groupId" value={group.id} />
                              <input type="hidden" name="returnTo" value="/arrive" />
                              <button type="submit" className="rounded-full bg-coral-100 px-3 py-1 text-xs font-medium text-coral-700 hover:bg-coral-200">
                                ＋1
                              </button>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
            {group && (
              <p className="text-sm text-ink-muted">
                See everything on the{" "}
                <Link href={`/groups/${group.slug}`} className="font-medium text-brand-600 underline">
                  {college.name} community page
                </Link>
                .
              </p>
            )}
          </section>

          {activity.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">Your requests and offers</h2>
              <div className="space-y-2">
                {activity.map((a) => (
                  <Card key={`${a.postId}-${a.role}`} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">
                        <Link href={`/help/${a.postId}`} className="hover:underline">{a.title}</Link>
                      </p>
                      <p className="text-sm text-ink-muted">
                        {a.role === "posted" ? "You posted this" : "You responded"} · {KIND_LABELS[a.kind]}
                      </p>
                    </div>
                    <Badge tone={a.responseStatus === "accepted" ? "success" : "neutral"}>
                      {a.role === "posted" ? a.postStatus : a.responseStatus}
                    </Badge>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Card className="border-amber-300 bg-amber-50/60">
        <h2 className="font-semibold text-ink">Stay safe</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
          {SAFETY_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {!state.verified && (
          <div className="mt-3">
            <Alert tone="info">Verify your student email above to open the help board.</Alert>
          </div>
        )}
      </Card>
    </div>
  );
}
