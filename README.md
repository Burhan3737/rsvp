# Wedding site & RSVP

A multi-event wedding website where **you make a link, tick which events it shows, and send it**.
No guest list to build, no login for anyone, and the whole thing runs on **free tiers**.

Built from a teardown of Zola, The Knot, WithJoy, Minted, Appy Couple, Riley & Grey, RSVPify and
Greenvelope, plus real guest and couple complaints from Weddingbee, Mumsnet, MoneySavingExpert and
Hacker News. The research and the decisions it drove are in [`docs/`](./docs).

---

## How it works

**A link is the unit of invitation.** You create one, tick the events it should show, and share it
however you like — WhatsApp, SMS, email, or the printed code on a card. Anyone opening that link
sees exactly those events and nothing else. Different links, different events. That is the whole
model.

There is deliberately **no guest list**. The commercial platforms all keep one and resolve each
visitor by name lookup, which is where their worst failure lives: a WeddingWire user reported it
failing on *"about 20% of invites"*, and both market leaders match strictly enough that "Chris" will
never find "Christopher". Skipping the lookup skips the entire failure class.

- **Unlimited events** — dholki, mehndi, nikkah, walima, a day-after brunch.
- **Per-link visibility.** A link that does not show an event gives **no trace** of it: no greyed-out
  card, no gap in the timeline, nothing in the HTML.
- **Guests type their own names** when they reply. The link's seat cap is what stops a party of two
  becoming a party of six.
- **Per-person, per-event replies** with meal choice, so the CSV export is something a caterer can
  actually use.
- **An admin** with Attending / Declined / **Awaiting** per event, meal tallies, a chase-up
  worklist, and a **"what this link shows"** audit view that runs the same query the guest page runs.
- **Eighteen themes, each a copy of a real published template** — six from Bliss & Bone and two
  individual wedding sites, six from **Zola**, six from **The Knot** — with the original's link next
  to each so you can compare. See [`docs/TEMPLATE-SOURCES.md`](./docs/TEMPLATE-SOURCES.md) and
  [`docs/COMPETITOR-TEARDOWN.md`](./docs/COMPETITOR-TEARDOWN.md).

## Quick start

```bash
npm install
npx playwright install chromium webkit   # only needed to run the tests
node scripts/seed.mjs --reset            # loads a demo 6-event wedding + 5 invite links
npm run dev
```

> **One PGlite caveat.** The embedded database is single-process. If a dev server is running and you
> run the seed at the same time, the store corrupts and every page 500s with
> `RuntimeError: Aborted()`. Stop the server first, or recover with `npm run db:reset`. This does
> not apply in production, where `DATABASE_URL` points at Neon over HTTP.

It runs with **no configuration at all**: no database to provision, no API keys. With `DATABASE_URL`
unset it uses an embedded Postgres (PGlite) under `.data/pglite`, and with no email provider set it
logs notifications instead of sending them.

The seed prints the demo links. Open them side by side — that is the whole product:

| Link | Shows |
|---|---|
| Close family | all six events |
| Sarah Khan + guest | five — including the family dholki, but **not** the family-only mayoun |
| The Okonkwos | four |
| Work colleagues | two — only the events marked public |

Nothing about those links differs except which events are ticked.

To use the admin, put a password in `.env.local` (see [`.env.example`](./.env.example)):

```bash
ADMIN_SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")
ADMIN_PASSWORD=something-long-and-random
```

## Adding your own data

Make links in `/admin/invites`: give each a label only you see, set how many people it may bring,
and tick its events. Events, page copy, travel blocks and FAQs live in the database and are edited
through `/admin` — no redeploy needed to change a time or a venue.

## Deploying to Vercel (free)

1. Push to a **personal** GitHub repo. (Hobby cannot connect to org-owned repos.)
2. Import it in Vercel.
3. In the project, **Storage → Neon → Install**. This injects `DATABASE_URL` for you.
4. Set `ADMIN_SECRET`, `ADMIN_PASSWORD` and `IP_SALT` in Environment Variables.
5. Deploy, then run the schema once (`/admin` creates it on first query, or run
   `DATABASE_URL=... node scripts/seed.mjs`).

**Neon, specifically not Supabase.** Supabase's free tier pauses a project after a week of
inactivity and needs a manual restore — which is exactly the wedding failure pattern: build in
September, collect replies in October, go quiet in November, find out in December because a guest
told you. Neon scale-to-zeros after five minutes and auto-resumes, so the worst case is a sub-second
cold start.

**Two things worth knowing about the free tier** (both detailed in [`docs/STACK.md`](./docs/STACK.md)):

- Exceeding Hobby limits takes the site **offline** (`503`), resumes only manually, and there is no
  spend cap on Hobby. For a wedding, budget ~$20 to sit on Pro for the month that spans the date.
- **Do not add a cash-gift or honeymoon-fund widget.** Vercel counts "asking for donations" as
  commercial use, which Hobby forbids. Link out to an external registry instead.

## Testing

```bash
npm run test        # 66 unit tests (Vitest)
npm run test:e2e    # 175 end-to-end tests, desktop Chromium + real iOS WebKit
npm run test:all
```

Async Server Components cannot be unit-tested — Next's own docs say so — which is why the RSVP flow
is covered end-to-end rather than with mocks. The E2E suite runs against the real built app and the
real database.

Three things the suite exists to protect:

- **`guest-flow.spec.ts`** — that a link never shows an event it was not ticked for, that the seat
  cap holds, that a reply round-trips, and that a resubmission updates rather than duplicating.
- **`template-fidelity.spec.ts`** — that each theme still renders the exact ground, ink and
  typefaces harvested from the template it copies, plus one test per theme for the structural
  signature that makes its source recognisable.
- **`design-integrity.spec.ts`** — mechanical rules that cannot be reintroduced by accident (no
  gradients, no emoji icons, no blurred card shadows, real letter-spacing, six distinct type
  systems) plus **zero WCAG 2.1 AA violations** on every route, in both engines. Note two checks
  were deliberately relaxed to allow faithful copying — the reasons are written into the test file.
- **`tests/unit/visibility.test.ts`** — the visibility SQL against real Postgres, including the leak
  case, the revoked link and the expired link.

```bash
node scripts/harvest.mjs    # re-pull the source templates' own CSS and type
node scripts/capture.mjs --base http://127.0.0.1:3100 --out screenshots/x --theme kelsey --routes "/,/i/TOKEN"
```
captures fold + full-page shots at desktop and mobile for design review.

## The security model, honestly

An invitation link is a **bearer token**: anyone holding it sees that link's events. That is
appropriate here — an invitation gets shared within a household by definition, and the worst
realistic outcome is that an uninvited cousin sees a menu.

What matters is that the blast radius is bounded, and it is:

- A link exposes **only the events ticked for it**. Never another link's, never a list of anything.
- A forwarded link therefore cannot reveal an event it was not ticked for.
- The owner's own label for a link ("Close family") is **never rendered** to the guest.
- Links are **revocable** — one `UPDATE` kills one. This is why tokens are random rows in the
  database and not signed JWTs, which cannot be revoked.
- Token routes are `noindex` + `Referrer-Policy: no-referrer` + `no-store`, and get a **generic**
  Open Graph card so a WhatsApp preview cannot leak anything into a group chat.
- Links are **idempotent and re-visitable**, never single-use — corporate mail scanners pre-click
  every link they see, and a single-use link would be dead on arrival.

Admin is one shared password exchanged for an HMAC-signed HttpOnly cookie, rate-limited in the
database, re-verified inside every Server Action. Rotating `ADMIN_SECRET` invalidates every session
at once. There is no MFA and no audit of who signed in — proportionate for this, and stated plainly
rather than dressed up.

## Documentation

| File | What's in it |
|---|---|
| [`docs/REQUIREMENTS.md`](./docs/REQUIREMENTS.md) | Functional and non-functional requirements, with the evidence for each |
| [`docs/TEMPLATE-SOURCES.md`](./docs/TEMPLATE-SOURCES.md) | **Which real template each theme copies**, with live URLs, ratings and harvested values |
| [`docs/DESIGN-DIRECTIONS.md`](./docs/DESIGN-DIRECTIONS.md) | Design research and the AI-slop checklist |
| [`docs/STACK.md`](./docs/STACK.md) | Stack decisions and the free-tier traps, each tagged verified or unverified |
| [`docs/COMPETITOR-TEARDOWN.md`](./docs/COMPETITOR-TEARDOWN.md) | **Zola and The Knot taken apart** — how they store a theme, how their RSVP flows actually behave, and which of their failure modes this design cannot have |
| [`docs/DESIGN-REVIEW.md`](./docs/DESIGN-REVIEW.md) | The blind design-review loop and what each round changed |
