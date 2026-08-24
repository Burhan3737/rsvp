# Zola and The Knot, taken apart

Twelve of the eighteen themes are copied from these two platforms, so their code was read closely.
This document is what that turned up about the **products** — how they are built, how their RSVP
flows actually behave, and which of their failure modes this project avoids by construction rather
than by being careful.

It matters because both platforms are enormous and long-established. Where they do something well it
is worth copying outright; where they fail, the failure is usually architectural, and copying the
architecture would inherit the failure.

## How each one stores a theme

The two are built completely differently, and it changes what "copying a template" even means.

| | Zola | The Knot |
|---|---|---|
| Where a theme lives | `public_theme_v2`, a JSON token object inside the Next.js payload of every published site | `__NEXT_DATA__` → `weddingWebsiteResult.theme.themeStyles[0].styles`, applied at runtime by styled-components |
| Per-theme stylesheet | none | **none at all** |
| What a "template" is | a colour variant of a *theme group*; ~617 variants over far fewer groups | a token bundle: colours, six type scales, and a face per scale |
| Type scale | per **component** — `COUPLES_NAMES`, `CMS_FAQ`, `HERO_HOME` and six more, each with its own size, tracking and case | per **scale** — `s1`..`s6`, mapped to elements by the renderer (`s1` → couple names, `s6` → body, input, button) |

Neither ships CSS you can read. Both ship the numbers, which is better: the sizes, tracking and case
in `app/globals.css` for these twelve themes are **their own values**, not measurements taken off a
screenshot. That is why they are specific to the pixel — Malina really does set its names at 85px
with 3px of tracking and a line-height of 1.6, and Officially Official really does put eight pixels
of tracking on a 58px Oswald.

The Knot's faces are all Google Fonts, so those six themes substitute **nothing**. Zola names four
licensed retail faces; those are substituted and each substitution is recorded in `app/layout.tsx`
next to the font it replaces.

## Zola's product, and what it costs

**Nine pages, closed enum.** A Zola site can have Home, Wedding Party, Photos, Travel, Things To Do,
Registry, FAQs, RSVP and Our Story — and nothing else. The renderer switches on that list. There is
no custom page type at all, and the workaround is visible in the harvest: **two of the eight live
sites captured had renamed the "Things To Do" page to "Return to Main Website"**, purely to get an
arbitrary link into the nav. A closed enum being used as a generic container is a design smell you
can see from orbit.

One couple left over it:

> "it is not customizable beyond the templated designs (for example, we don't have wedding parties
> but need a page for a different thing, and I had to figure out how to use the wedding party forms
> to fit in the other event info)"

**Name-search RSVP, with a lockout.** Guests type their name to find their invitation, and the
client locks them out after five failed searches:

> "most people open their invitation and throw the envelope away... we had about a dozen people that
> couldn't figure it out. The locking you out after a couple tries seems unnecessary and really
> frustrated people"

The same search box is a guest-list enumeration oracle — one user described using it to browse who
else was invited.

**Other limits found in the client code or confirmed by users:** RSVP questions cannot be made
required; a household caps at **two adults**, so everyone else has to be filed as a child, which
breaks multi-generational families; password protection is whole-site only; and a "private" event
reportedly still renders its details to uninvited guests — it blocks the RSVP, not the display.
Zola's own "Start your wedding website" CTA sits in every couple's footer and cannot be removed.

One mechanism worth copying: setting a site non-indexable does not just add a `noindex` tag, it
**moves the canonical URL to a different route** (`/wedding/pvt/<slug>`).

## The Knot's RSVP, which is the interesting one

The Knot's guest flow is worth reading in detail because its problems are all one problem.

**The lookup key is the access-control key.** `GET /v1/weddings/{uuid}/guests?full_name=` is
unauthenticated — no key, no token. Knowing a name is knowing enough to write that party's RSVP,
meal choices and notes. Two separate abuse incidents surfaced in the research, and because the
platform records no submitter metadata, one victim could not find out who had submitted a racist
message under her father's name.

**A 183-day cookie with no escape.** `Cookies.set("gid", …, { expires: 183 })` — once a party has
replied, returning to the site jumps straight to a confirmation screen. There is no "not you?" link
and no logout, so the documented workaround is to clear your cookies:

> "It saves their RSVP info so every time they go back… will not allow adding guests or editing
> names. To clear this, they must clear their cache or use a different browser"

**And a partial name unlocks what a full name locks.** A `partial_match` result bypasses the cookie
fast-path entirely, so the *same guest* has more editing power if they type less of their own name:

> "if they type only their first name or only their last name, they can choose from a list. This
> allows them to then edit names or add more guests"

**Per-guest event visibility is a promise the public site cannot keep.** `event.visible` is a global
flag and the public payload is byte-identical for every visitor; per-guest filtering exists only
inside the RSVP micro-frontend. So:

> "The wedding one is supposed to only be visible to invited guests but it's showing for everyone"

That is not a bug. It is the architecture.

**Two smaller ones:** the free-text RSVP field never passes `maxLength`, so guests write extra
attendees into it; and `rsvpDeadline` is declared in `EventContext.tsx` with **zero usages** — there
is no closed-RSVP state at all, which is the single most-requested missing feature found (one thread
at 669 points, 493 comments).

## What this project does instead, and why

Set against those findings, three of this project's decisions stop being preferences:

| Their failure | Why it cannot happen here |
|---|---|
| The lookup name is the access key; anyone can RSVP as anyone | **There is no lookup.** A link is the unit of invitation. Nothing is keyed on a guest's name because no guest list exists |
| Private events still render to everyone; filtering is client-side | Visibility is a **SQL join** — `invite_events` — resolved server-side in `getEventsForInvite`. An event a link was not ticked for is never serialised into the HTML at all. `tests/unit/visibility.test.ts` pins the leak case against a real Postgres |
| A 183-day cookie locks a guest out of their own reply | Replies are **idempotent and re-editable**. Reopening the link loads the saved answer into the form; changing it updates rather than duplicating, and `guest-flow.spec.ts` asserts that round-trip |
| Free text is unbounded, so guests smuggle extra attendees into it | Every field is length-capped **server-side** in `lib/actions/rsvp.ts` — names 120, dietary 1000, message 2000 — and the seat cap is re-derived from the database, never from the form |
| No RSVP deadline exists | `isPastDeadline()` is checked before any write, and a closed form says so |
| Households cap at two adults | The cap is per link, 1–20, set by the owner |
| Nine pages, closed enum, no custom page | Events, travel blocks, FAQs and page copy are database rows edited through `/admin`; adding one is not a deploy |

Two things they do that are worth copying and **have** been copied:

- **Zola's non-indexable canonical.** Token routes here are `noindex` + `Referrer-Policy: no-referrer`
  + `no-store`, and carry a deliberately generic Open Graph card so a WhatsApp preview leaks nothing
  into a group chat.
- **The Knot's token-bundle theming.** A theme being data rather than a stylesheet is why eighteen
  themes cost eighteen token blocks instead of eighteen stylesheets, and it is the model
  `app/globals.css` already used before either platform was read.

## Sourcing, stated plainly

- **Template tokens** were read out of live published wedding sites — real couples' public pages —
  and out of the platforms' own JavaScript bundles. Every theme in `lib/themes.ts` carries the URL it
  came from.
- **User complaints** came from the **Arctic Shift Reddit archive API**, not from reddit.com, which
  is hard-blocked from this machine on every user-agent tried. The quotes are verbatim from archived
  JSON; the `reddit.com/...` permalinks reconstructed from that archive were **never confirmed
  against reddit.com** and should be treated as archive citations.
- **Blocked and therefore absent:** Trustpilot (403), forums.theknot.com (403), weddingwire.com
  (403), Pushshift (gated), and help.theknot.com (**DNS does not resolve**).
- **Sampling bias worth naming:** the app-store reviews read skew heavily negative (the most recent
  *written* reviews are mostly 1–2★, against an aggregate of 4.86 across ~220,000 ratings). The
  counts above measure how loud a complaint is, not how common.
- Anything that could not be reached is recorded as a gap rather than filled in. One Zola template,
  Poet, has its background, ink and button colours pixel-measured from Zola's own render but **no
  type data at all** — no published site using it was found among ~5,900 scanned. It is therefore
  **not** shipped as a theme.
