import type { Metadata } from "next";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { ConnectionInviteForm } from "@/components/connection-invite-form";
import { ConnectionSearchResults } from "@/components/connection-search-form";
import {
  cancelConnectionRequestAction,
  removeConnectionAction,
  respondToConnectionAction,
} from "@/app/actions/connections";
import { requireUser } from "@/lib/guards";
import {
  getConnections,
  getPendingIncoming,
  getPendingOutgoing,
  getSecondDegreeIds,
  searchSecondDegreeByName,
} from "@/lib/social";
import { avatarColor, initials } from "@/lib/category-colors";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "People" };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function PeoplePage({ searchParams }: Props) {
  const { q } = await searchParams;
  const user = await requireUser("/people");

  const [accepted, incoming, outgoing, secondDegree, searchResults] = await Promise.all([
    getConnections(user.id),
    getPendingIncoming(user.id),
    getPendingOutgoing(user.id),
    getSecondDegreeIds(user.id),
    q ? searchSecondDegreeByName(user.id, q) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="People"
        description="Connections let you see the recommendations each of you has chosen to share. Both sides have to agree."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: pluralize(accepted.length, "connection"), value: accepted.length, tone: "bg-brand-50 text-brand-800" },
          { label: "waiting on you", value: incoming.length, tone: "bg-coral-100 text-coral-700" },
          { label: "friends of friends", value: secondDegree.length, tone: "bg-gold-100 text-gold-700" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl px-5 py-4 ${stat.tone}`}>
            <p className="text-2xl font-semibold leading-none">{stat.value}</p>
            <p className="mt-1 text-xs font-medium opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Waiting on you
          </h2>
          {incoming.map((req) => (
            <Card key={req.connectionId} className="flex flex-wrap items-center gap-4">
              <Avatar name={initials(req.name)} color={avatarColor(req.name)} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{req.name}</p>
                <p className="text-sm text-ink-muted">{req.email}</p>
              </div>
              <div className="flex gap-2">
                <form action={respondToConnectionAction}>
                  <input type="hidden" name="connectionId" value={req.connectionId} />
                  <input type="hidden" name="decision" value="accepted" />
                  <Button type="submit" size="sm">
                    Accept
                  </Button>
                </form>
                <form action={respondToConnectionAction}>
                  <input type="hidden" name="connectionId" value={req.connectionId} />
                  <input type="hidden" name="decision" value="declined" />
                  <Button type="submit" variant="ghost" size="sm">
                    Decline
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Your connections
        </h2>
        {accepted.length === 0 ? (
          <EmptyState
            emoji="🤝"
            title="No connections yet"
            description="Connect with the people whose recommendations you would actually act on."
          />
        ) : (
          <div className="stagger space-y-3">
            {accepted.map((c) => (
              <Card key={c.connectionId} className="lift flex flex-wrap items-center gap-4">
                <Avatar name={initials(c.name)} color={avatarColor(c.name)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="text-sm text-ink-muted">{c.email}</p>
                </div>
                <form action={removeConnectionAction}>
                  <input type="hidden" name="connectionId" value={c.connectionId} />
                  <Button type="submit" variant="ghost" size="sm">
                    Remove
                  </Button>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Sent, not answered yet
          </h2>
          {outgoing.map((req) => (
            <Card key={req.connectionId} className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{req.name}</p>
                <p className="text-sm text-ink-muted">{req.email}</p>
              </div>
              <Badge tone="warning">Pending</Badge>
              <form action={cancelConnectionRequestAction}>
                <input type="hidden" name="connectionId" value={req.connectionId} />
                <Button type="submit" variant="ghost" size="sm">
                  Cancel
                </Button>
              </form>
            </Card>
          ))}
        </section>
      )}

      <Card className="warm-wash">
        <h2 className="text-lg font-semibold text-ink">
          Search your extended network
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Find people by name, but only among friends of your friends — not everyone on
          the app. That is what your connections make possible.
        </p>
        <form action="/people" method="get" className="mt-4 flex max-w-sm gap-2">
          <label htmlFor="q" className="sr-only">
            Search by name
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Priya…"
            className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm text-ink placeholder:text-ink-muted"
          />
          <Button type="submit">Search</Button>
        </form>

        {q && (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nobody matching “{q}” in your extended network. Try their exact email
                below instead.
              </p>
            ) : (
              <ConnectionSearchResults results={searchResults} />
            )}
          </div>
        )}
      </Card>

      <Card className="warm-wash">
        <h2 className="text-lg font-semibold text-ink">Know their email?</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Works for anyone with an account, inside or outside your network. Nothing is
          shared until they accept.
        </p>
        <div className="mt-4 max-w-sm">
          <ConnectionInviteForm />
        </div>
      </Card>
    </div>
  );
}
