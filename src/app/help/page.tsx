import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Alert, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { HelpCard } from "@/components/help-ui";
import { getCurrentUser } from "@/lib/auth";
import { getUserCollegeState } from "@/lib/colleges";
import { getHelpBoard, KIND_EMOJI, KIND_LABELS, type HelpDirection, type HelpKind } from "@/lib/help";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Help board" };

type Props = { searchParams: Promise<{ direction?: string; kind?: string }> };

const KINDS: HelpKind[] = ["pickup", "temp_stay", "room", "item"];

export default async function HelpBoardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/help");

  const state = await getUserCollegeState(user.id);
  if (!state.college || !state.verified) redirect("/arrive");

  const direction: HelpDirection | undefined =
    sp.direction === "offer" || sp.direction === "need" ? sp.direction : undefined;
  const kind: HelpKind | undefined = KINDS.includes(sp.kind as HelpKind)
    ? (sp.kind as HelpKind)
    : undefined;

  const posts = await getHelpBoard(user.id, state.college.id, { direction, kind });

  function href(next: { direction?: string | null; kind?: string | null }) {
    const p = new URLSearchParams();
    const d = next.direction === undefined ? direction : next.direction;
    const k = next.kind === undefined ? kind : next.kind;
    if (d) p.set("direction", d);
    if (k) p.set("kind", k);
    const qs = p.toString();
    return qs ? `/help?${qs}` : "/help";
  }

  const chip = (active: boolean) =>
    [
      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
      active
        ? "border-transparent bg-ink text-surface"
        : "border-line-strong text-ink-muted hover:bg-surface-sunken",
    ].join(" ");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help board"
        description={`Verified ${state.college.name} students helping each other settle in.`}
        action={
          <div className="flex gap-2">
            <LinkButton href="/help/new?direction=need" variant="coral">I need help</LinkButton>
            <LinkButton href="/help/new?direction=offer" variant="secondary">I can help</LinkButton>
          </div>
        }
      />

      <nav aria-label="Filter" className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link href={href({ direction: null })} className={chip(!direction)}>Everything</Link>
          <Link href={href({ direction: "offer" })} className={chip(direction === "offer")}>Offers</Link>
          <Link href={href({ direction: "need" })} className={chip(direction === "need")}>Requests</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={href({ kind: null })} className={chip(!kind)}>All kinds</Link>
          {KINDS.map((k) => (
            <Link key={k} href={href({ kind: k })} className={chip(kind === k)}>
              <span aria-hidden="true">{KIND_EMOJI[k]}</span> {KIND_LABELS[k]}
            </Link>
          ))}
        </div>
      </nav>

      {(kind === "temp_stay" || kind === "room") && (
        <Alert tone="info">
          Never pay a deposit or fee before you have met in person and seen the place. A
          real senior will happily do a video call first. Report anyone who asks for money.
        </Alert>
      )}

      {posts.length === 0 ? (
        <EmptyState
          emoji="🌱"
          title="Nothing here yet"
          description="Be the first. If you have already been through your first weeks, an offer helps someone more than you would guess."
          action={<LinkButton href="/help/new?direction=offer">Offer help</LinkButton>}
        />
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {posts.length} open {pluralize(posts.length, "post")}.
          </p>
          <div className="stagger space-y-4">
            {posts.map((p) => (
              <HelpCard key={p.id} post={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
