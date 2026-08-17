# Trusted By

The people you trust, recommending the people you need.

Keep the businesses and people you already tell your friends about in one list, share it
with a link, see what your network recommends, and ask them when you need a name you do
not have.

**Not a review site.** No star ratings, no negative reviews. You vouch for someone or you
say nothing.

**Works for one person.** Your own list is useful with zero other users. Connections and
groups are layers on top, not preconditions.

---

## Running it

Requires Node 20+ and Docker Desktop.

```bash
npm install
```

```bash
npm run db:up
```

```bash
cp .env.example .env.local
```

Schema, in order (the first step is separate because `drizzle-kit push` offers to
truncate `providers` when adding the unique phone constraint — never accept that):

```bash
npm run db:migrate:recs
```

```bash
npx drizzle-kit push --force
```

```bash
npm run db:setup
```

Seed data:

```bash
npm run db:seed
```

```bash
npm run seed:recs
```

```bash
npm run seed:social
```

Run it:

```bash
npm run dev
```

### Demo accounts

All use password `Password123!`.

| Account | What they show |
| --- | --- |
| `buyer@example.com` | A list of 9, two connections, owns a group |
| `raj@example.com` | A connection with an open ask |
| `meera@example.com` | A connection in the same group |
| `admin@example.com` | Admin, and deliberately outside the network |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:up` / `db:down` | Postgres container |
| `npm run db:migrate:recs` | Recommendation columns on `providers` |
| `npm run db:push` / `db:setup` / `db:reset` | Schema and indexes |
| `npm run db:seed` | Users and the category taxonomy |
| `npm run seed:recs` | A demo list |
| `npm run seed:social` | Connections, a group, an open ask |
| `npm run session <email>` | Mint a session cookie for testing |
| `npm run check:recs <token>` | Privacy, sharing, dedupe |
| `npm run check:network` | Visibility scopes, groups, discovery, asks |
| `npm run check:masking <token>` | Masking on the parked directory |

---

## The product

| Route | What it is |
| --- | --- |
| `/` | Signed out: the pitch. Signed in: your list |
| `/list` | Your recommendations — search, category filters, share |
| `/recommendations/new` | Add someone in under a minute |
| `/import` | Paste vCard or CSV, preview, bulk import |
| `/discover` | Your network's recommendations, closest first |
| `/asks` `/asks/new` `/asks/[id]` | Ask your network, and answer theirs |
| `/people` | Connections: invite, accept, remove |
| `/groups` `/groups/[slug]` `/join/[token]` | Communities and invite links |
| `/p/[slug]` | A contact and everyone who vouched for them |
| `/s/[token]` | Public share card or list, with a generated preview image |
| `/claim/[slug]` | How someone listed here gets out, without an account |
| `/business/claim` | A business owner listing themselves directly |
| `/admin/*` | Claims, removals, reports, moderation |

### Decisions worth knowing

**Phone number is the identity key.** Normalised to E.164 on write
(`src/lib/phone.ts`), unique index on the column. Two people adding the same plumber
attach to one profile. If the number already belongs to someone under a different name,
the save succeeds and the list says which contact it was filed under.

**Visibility is one rule, written once.** `visibilityCondition` in `src/lib/social.ts`
decides who may see a recommendation, and every feed, search, and group page uses it:

| Audience | Who sees it |
| --- | --- |
| Private | Only you. The default, including everything imported |
| Connections | People who accepted a mutual connection |
| Groups | Members of the specific groups you picked |
| Anyone with the link | Genuinely public — and **only these** appear on a shared list |

That last row matters. A share link exposes only entries marked "anyone with the link" —
not merely "everything that is not private". An entry scoped to your connections was
given a narrower audience than a public URL, and quietly widening it would break the
promise the picker makes.

**Trust degrees rank discovery.** `src/lib/discover.ts` sorts by how close the
recommender is: someone you know, then your groups, then friends of friends. Second-degree
results only surface when the author scoped them to their connections — the graph stops
where the author's intent stops, rather than flattening into a public directory.

**Connections: email for anyone, name search only among friends of friends.** There is no
directory of every user — that would let anyone browse for anyone. But once someone is
two hops away, your friend already vouches for knowing them, so search reaches that far
(`searchSecondDegreeByName` in `src/lib/social.ts`) and no further. Outside that, you
need their exact email.

**A business can list itself, clearly marked as such.** `providers.selfListedAt` is set
only when the owner created the profile themselves via `/business/claim`, kept separate
from `claimedAt` (which also fires on an approved claim of a friend-added profile) so the
UI can say "self-listed" without guessing from the recommendation count. The badge drops
once someone actually recommends them — real vouches carry the trust, not the listing.
Self-listing hits the same phone-uniqueness guard as everything else: claiming a number
that already has a profile points the owner at that profile's claim flow instead of
forking a duplicate.

**Answers to asks come from your own list.** You cannot type a stranger's name into an
answer box; you pick someone you already recommend. That keeps an answer a real vouch.

**Private individuals are not public.** A `kind: individual` contact's number is shown to
the person who added them and to anyone who independently vouched for them. Everyone else
sees `(•••) •••-0477`. Enforced in the query layer — `contactPublicColumns` selects only
the last four digits, and the real number is fetched separately after access is
established, so a page rendered for a stranger never holds it.

**Anyone can get themselves out.** `/claim/[slug]` needs no account. A removal request
hides the profile immediately; confirming deletes every recommendation attached to it,
and bulk import refuses to re-add a hidden number.

**Stripe and email are keys-optional.** Without keys the app runs and email is written to
the server log. Set `RESEND_API_KEY` and `EMAIL_FROM` to deliver for real.

### Look and feel

Warm cream and teal, coral for calls to action, gold reserved for "my go-to". Each of the
twelve category groups owns a colour (`src/lib/category-colors.ts`) — a list of thirty
contacts is much faster to scan when plumbing is always orange. The same file generates
avatar colours and initials, so everyone has a face without an uploaded image. Motion
sits inside a `prefers-reduced-motion` guard.

---

## Verified

`npm run check:network` — 16 assertions, all passing:

- A share link exposes neither connections-scoped nor group-scoped entries
- Discover surfaces a connection's entries and a shared group's entries, attributed by name
- Someone outside the network sees none of it
- Group pages are members-only; non-members get a 404, signed-out visitors are redirected
- An ask reaches the author's network and nobody else

`npm run check:recs` (13) and `npm run check:masking` (10) also pass. `npm run typecheck`
and `npm run build` are clean.

Walked through in a browser: sign in, add a recommendation, the list with filters and
search, the share card, the duplicate-number notice, and Discover's degree grouping.

## Known limits

- **Rate limiting is in-process.** Counters live in memory, so behind several instances
  the effective limit multiplies and a restart clears them. Move to Redis before scaling
  out. `src/lib/rate-limit.ts` says so at the top.
- **Import files under one paste.** No file upload yet — you paste the vCard text.
- **No email verification** on signup.
- **Second-degree only.** The graph stops at friends-of-friends; there is no third degree.
- **Policies are drafts.** `/legal/*` describes what the app does but has not been near
  an attorney.
- Re-adding an existing contact overwrites your previous note — one recommendation per
  person per contact, by design.

## Parked

The repo began as a nationwide classifieds marketplace. Those routes still exist and
still work, but nothing links to them: `/search`, `/categories`, `/listings`,
`/providers`, `/dashboard`, `/inbox`, listing CRUD, inquiries, reviews, and Stripe
featured placement. The directory becomes useful again when vouched contacts need
something to rank above.
