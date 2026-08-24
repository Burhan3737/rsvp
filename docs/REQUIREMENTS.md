# Functional & Non-Functional Requirements

_Derived from (a) a teardown of Zola, The Knot, WithJoy, Minted, Appy Couple, Riley & Grey, Squarespace,
RSVPify, Greenvelope, Bridebook, Hitched, Say I Do, WeddingWire; and (b) real user sentiment from
Weddingbee boards, Mumsnet, MoneySavingExpert, Hacker News, Capterra and vendor help-centres.
Researched 2026-08-23._

> **Sourcing note.** Reddit was hard-blocked at the tool layer (reddit.com disallows the crawler), and
> Trustpilot / Capterra / WeddingWire / Hitched / theknot forums return 403 to direct fetch. The evidence
> spine is therefore Weddingbee, Mumsnet, MoneySavingExpert, HN, and vendor help articles — the last of
> which are themselves evidence, since a help article exists because the failure is high-volume.

---

## AMENDMENT — the guest list was removed after this research was written

Everything below is the original research and still stands as evidence. **One requirement it produced
was overruled by the product owner, and the shipped system is different in exactly one way.**

The research concluded that a guest list should be the system of record, with a tokenised link
*resolving* to a household inside it. The owner's instruction was the opposite:

> "we would be sharing specific links to specific people manually and hiding events on each link"

So there is **no guest list, no household table and no import**. The **link itself is the unit of
invitation**: you create one, tick the events it shows, and send it. `invite_events` — a row per
(link, event) pair — *is* the entire access-control model. Guests type their own names when they
reply, and the link's seat cap is what bounds the party.

**What this changes about the requirements below**

| Original | As shipped | Why the change is safe |
|---|---|---|
| **M1** per-*household* tokenised link | Per-*link* token, no household behind it | Unchanged in every property that mattered: 128-bit opaque, DB-stored, revocable |
| **M2** guest list is the system of record, one row per person | **Dropped.** No guest list, no import | The evidence for M2 was reporting and chasing, both of which the link list provides |
| **M3** party/household grouping | The link's **seat cap** groups the party | The failure M3 existed to prevent — "the rest of their party got confused and trekked to enter another name" — cannot occur, because nobody is ever looked up |
| **M4** name lookup as fallback | **Dropped as a lookup.** `/find` takes a printed *code*, not a name | This removes the top complaint in the whole research set rather than mitigating it, and closes the open-lookup privacy leak completely |
| **M7** event access by tag or named individual | Access is per link only | Tags were an authoring convenience over a guest list that no longer exists |
| **M10** zero free slots, pre-loaded with the invited party | Exactly `max_guests` name fields, no add button | Same structural block on plus-one abuse, reached without knowing anyone's name |

Everything else below — M5, M6, M8, M9, M11 onward, and every non-functional requirement — is
implemented as written.

One property the original architecture claimed is **not** true of the shipped one, and is stated
plainly rather than glossed: the research line *"the link grants nothing; identity grants visibility"*
no longer holds. With no identity to check, **a link is a bearer token**. A person you forward it to
sees what it shows. That is an accepted trade, bounded deliberately: a link exposes only its own
ticked events, never another link's and never a list of anything, and one `UPDATE` revokes it. The
full reasoning is in the README under "The security model, honestly".

---

## THE DECISION THAT DRIVES EVERYTHING

**Issue every household a unique tokenised link. Do not make guests type and match their own name.**

This single choice kills six of the top complaints at once: name-matching failure, URL recall, forced
accounts, password walls, household grouping, and the open-lookup privacy leak. Name search survives only
as a clearly-labelled fallback.

The architecture, stated correctly: **the link grants nothing; identity grants visibility.** A forwarded
link exposes no event the forwarder wasn't invited to, so forwarding becomes harmless by design.

### Why: the evidence

- **Name matching fails at scale.** A WeddingWire user: guests "can find themself in the search but when
  they cliick to RSVP, no options come up" — "it's affecting about 20% of invites", and the guest sees
  "Not whether they are coming; not what they want to eat; NOTHING."
- WithJoy's docs concede strict matching: `"Chris Smith" will only match "Chris Smith," not "Christopher Smith."`
  Zola temporarily **locks the guest out** after repeated failures.
- **A lookup failure reads as "you're not invited."** That is the worst possible message to send a guest.
- **The open name-lookup is an unauthenticated write to the guest list.** A real complaint:
  "you can easily type 'Jack Johnson' in the RSVP form and it pops to a window marked either Accept or
  Regret... What if a vindictive uninvited guest just goes on and puts everyone's RSVP to 'Regret'?
  Can't even tell who did it." Failed lookups also leaked "a list of similar names & the town that guest
  was from."
- **Password walls cause abandonment:** "If the website is password protected I usually will skip it."
  And the advice everyone gives defeats the mechanism — Zola tells couples to pick a password that's
  "easy for your guests to remember and simple to spell." A shared guessable password deters casual
  discovery; it is not access control.
- **Accounts are fatal.** Joy shipped login-less RSVP explicitly to remove "a lot of the friction for your
  guests"; a couple rejected a competitor because "the ONLY reason I didn't go with them" was the account.

---

## Core data model: THREE ORTHOGONAL STATES, not one switch

`visible?` x `rsvp_required?` x `invited?` — all three independent. Zola's two per-event booleans plus the
guest↔event join. All four visible/rsvp combinations occur in real weddings:

| public | rsvp | Real case |
|---|---|---|
| yes | yes | The reception. Everyone sees it, everyone replies. |
| yes | no  | The ceremony — "We'd love for you to join us, no RSVP needed." (Joy's literal copy.) |
| no  | yes | The rehearsal dinner. Invisible to most; the wedding party sees it and replies. |
| no  | no  | The morning-after brunch, still being finalised. Draft state. |

**Guest lists across events are _overlapping circles_, not tiers.** Joy's published spread for a South Asian
wedding: Haldi 30–60 (immediate family only) · Mehndi 50–100 · Sangeet 150–250 · Ceremony 300–500+ ·
Reception sometimes a wholly separate professional list. **A 10x spread between smallest and largest event
is the quantitative case for a genuine many-to-many join.** It also rules out an ordinal tier field.

**Do NOT require a "main event everyone is invited to."** Appy Couple forces this, and a real user hit the
wall: she needed to invite her sister-in-law's in-laws to the rehearsal dinner *only*, and could not.

**Per-event visibility must be a per-event SETTING, not a hardcoded global policy.** Users disagree along
cultural lines and both are right:
> "Personally I think it's rude for guests to know that there are other events that they aren't invited to."
> — bear123
>
> "While it may be rude in some cultures, it is not in mine. In my culture, the wedding and reception are
> two separate events. The guest lists can be huge... so most people split some of the guests to make sure
> everyone can be invited." — paprika25

---

## MUST HAVE

- **M1** Per-household tokenised invite link as the primary entry path. 128-bit opaque, DB-stored, revocable.
- **M2** Guest list is the system of record. Spreadsheet import + manual add. One row per PERSON.
- **M3** Party/household grouping — one link surfaces every member of the party in a single flow.
      Real failure to avoid: "the head of some household's couldn't come, so the rest of their party got
      confused an trekked to enter another name." Label it the *party's* name, not "your name".
- **M4** Name-lookup as a **fallback only**, fuzzy + nickname dictionary + masked disambiguation.
      **A failure must never dead-end or imply non-invitation** — show a human fallback (phone + email).
- **M5** Per-event invitation as a many-to-many join. No main-event requirement. No tiers.
- **M6** Two independent per-event flags `is_public` / `rsvp_enabled` (table above).
- **M7** Guest tags, with event access grantable by tag AND by named individual, **additively**.
- **M8** **Personalised schedule as the PRIMARY surface** — not a gated RSVP popup.
      Zola and The Knot both hide private events from the Schedule and reveal them only inside the RSVP
      flow, leaving an invited guest's itinerary incomplete. Zola concedes: *"We do not currently have an
      option to show events to select guests on the Schedule page."* This is the clearest differentiation
      opportunity in the entire research set.
- **M9** RSVP is the primary object on the homepage, **above the fold, on mobile**. It is "the most-used
      feature on the site." No hero-scroll gauntlet between arrival and the RSVP button.
- **M10** Per-person attendance toggles per event, pre-loaded with the exact invited party and **zero free
      slots** — structurally blocking plus-one abuse. Praised by real users: "there is no way to add an
      extra person. It worked great."
      **Close the notes-field loophole**: a free-text note is where guests smuggle extras
      ("we noticed that you added someone in the notes section"). Route notes to a review queue that never
      touches the headcount.
- **M11** Meal choice **bound to the guest record** — kids' records get kids' menus. A $30 adult entrée
      selected for a 10-year-old is real money and a documented failure.
- **M12** Split **allergy/medical** from **preference** as separate fields. An open dietary box produces
      "he won't eat broccoli."
- **M13** **Attending / Not attending only.** No guest-facing "Maybe" — no major platform exposes it;
      it produces uncountable headcounts and caterers reject it.
- **M14** Guests can return and edit until the deadline. Links must be **idempotent and re-visitable**
      (also required because corporate mail scanners pre-click links — see STACK.md trap 3).
- **M15** **Never lose an RSVP.** A lost RSVP is indistinguishable from a non-response and is the most
      trust-destroying failure this product can have — there is a dedicated Knot bug report titled
      "RSVP function not working and I'm not receiving notifications". Requires: persist before email,
      idempotent writes, confirmation to the guest, notification to the owner, and a visible
      "last updated" timestamp on every response.
- **M16** **Immutable change log** — who/when on every RSVP change, and notify the owner on accept→decline
      flips. Silent flipping with no audit trail is a named fear.
- **M17** RSVP deadline, server-enforced, anchored to the **event's** timezone.
- **M18** **Label the timezone; NEVER auto-convert to viewer-local.** The guest reads from home but will be
      physically present in the venue's timezone — auto-conversion is actively dangerous. Store wall-clock
      + venue tz; render "4:00 PM (venue local)".
- **M19** **Attire block per event**: one-line formality + **colour swatches** + colours to avoid +
      modesty/venue rules (head covering, sleeve length — a *different* field from dress code) + a
      couple-authored permission line. Dress code is the #1 guest question, and mainstream guides currently
      instruct guests to *text the couple* — every one of those texts is a website failure.
- **M20** **Owner proxy-RSVP for offline guests.** Explicitly praised, and it is the accessibility answer
      for the 80-year-old guest — cheaper and more reliable than trying to make the flow senior-proof.
      ~73% of couples still take paper/phone RSVPs (Knot: 8% digital-only, 19% hybrid).
- **M21** **The outstanding-guest chase-up worklist.** The clearest unbuilt-feature demand in the research —
      couples hand-roll "one email, one call a week after the deadline, then assume no" in every thread and
      call it the worst part of planning. Ship: outstanding filter, staged reminders, one-click
      "record a phone RSVP", one-click "mark declined".
      Three-bucket header per event: **Attending / Declined / Awaiting reply**, third one clickable.
- **M22** **One export that IS the caterer handoff**: name, party, per-event attendance, meal, dietary,
      accessibility — one sheet, one click. Minted's reviewed failure to export per-person meals cleanly
      is the anti-pattern; real couples specifically valued exporting guest list + entrée together.
- **M23** Email notification to the owner on every RSVP.
- **M24** noindex + `X-Robots-Tag` by default. Riley & Grey and Bridebook both default to hidden.
- **M25** **Zero monetisation, upsells, or vendor branding anywhere in the guest flow.**
      The best-documented reputational disaster in this space: The Knot auto-appended
      *"Save the Date...to Buy Your Gift!"* to RSVP confirmations. Real reactions: "I am so embarassed!
      This comes across as so presumptious and gift-grabby." / "OMG WTF??! ...so lacking in grace and poise!"
      The couple pulled the feature and personally apologised to everyone who had already RSVP'd.
      (Also a Vercel Hobby ToS issue — see STACK.md trap 2.)

## SHOULD HAVE

- **S1** **Pre-send "what each guest sees" audit view.** NOBODY offers this. Misconfiguration is
      asymmetrically catastrophic: a wrong tag either leaks a private event (irreversible social damage)
      or silently locks a guest out (looks like a bug). Riley & Grey's "preview as this guest" is the
      closest existing thing.
- **S2** Confirmation email/SMS to the guest summarising what was submitted, with an edit link.
- **S3** **Replace the fridge.** The most-cited reason digital invites fail is that they vanish:
      "It's too easy to think 'I'll email a reply later' and then, 37 emails later, forget."
      "If it's physical, they put it up on the fridge and have a reminder of the date."
      Ship add-to-calendar on **every** event + a staged reminder cadence.
- **S4** Admin schedule labels each event with its audience — tag chips + names, or "All Guests" —
      plus a live count: "Wedding Party (8) + 3 others = 11 guests".
- **S5** Per-segment messaging, not one global template (a named RSVPify failure:
      "There is only one email template so you can't send different emails to different types of RSVPs").
- **S6** Plus-one allowance per guest; guest names them at RSVP time.
- **S7** Don't require a fully-resolved guest list to launch — support group-level links plus later
      per-person refinement. Guest lists are in flux until weeks before; requiring resolution up front is
      the #1 adoption killer for per-guest visibility.
- **S8** Custom post-deadline message; **grace period default 24h**; deadline enforceable but hideable
      (separate "show deadline to guests" toggle).
- **S9** Deadline buffer nudge: "your caterer needs numbers when? we'll set the guest deadline two weeks
      earlier." Real advice: "give yourself at least a 2 week buffer."
- **S10** Short, memorable, all-lowercase URL + QR code with the URL printed beneath as fallback.
      Real failure: "guests type the website I gave them into a google search instead of the address bar
      and people couldn't find our site even when they were looking for it!"
- **S11** Soft rate-limit with a visible countdown on the fallback lookup — never a silent lock.
- **S12** Notify the owner when an unrecognised person attempts to RSVP (doubles as the
      "I forgot to add Aunt Sue" recovery path).
- **S13** Tell guests attendance at every event is optional — a per-event decline must not read as
      rejecting the whole wedding.
- **S14** Wedding-party role fields on the same event (call times, photo locations, who carries the rings).
- **S15** B-list wave support that **does not leak wave identity** — no visible "invited on" date, no
      differing deadline copy between waves, no sequential/guessable URLs. Timing is the detection vector.
- **S16** Multiple admins.

## WON'T HAVE (this release)
Native app · registry/gift commerce · ticketing/payments · guest-facing "Maybe" · vendor marketplace ·
budget tracker · seating chart · conditional question branching.

## CONTENT CHECKLIST — ranked by evidence strength

| # | Item | Strength |
|---|---|---|
| 1 | Date, **ceremony start time** (not "guest arrival"), full venue address | ***** |
| 2 | RSVP with a visible deadline, findable from the homepage | ***** |
| 3 | Dress code, one line, **per event** | ***** |
| 4 | Schedule / order of the day **including end time** | ***** |
| 5 | Travel, parking, transport, local taxi numbers to pre-book | **** |
| 6 | Accommodation / hotel block with rates + booking code | **** |
| 7 | Plus-one and children policy, explicit — and **repeated on the RSVP itself** | **** |
| 8 | Food details + dietary field on the RSVP | **** |
| 9 | FAQ page — "the single most-read page after the homepage" | **** |
| 10 | Accessibility: wheelchair, terrain, footwear warnings | *** |
| 11 | Registry — **its own page, never the homepage, never the RSVP confirmation** | *** |
| 12 | A day-of contact person | *** |
| 13 | Ceremony→reception gap; cash vs open bar; whether to eat beforehand | *** |
| 14 | Weather contingency for outdoor events | ** |
| 15 | **"Our Story" / wedding party bios — DEMOTE** | * |

**On #15:** WedSites ranks it dead last ("This section is rarely their first stop"); Bliss & Bone says
"most guests skip this"; couples call it cringe ("I always cringe reading them lol" / "If people care,
they'll ask"). **No guest anywhere in this research asked for it.** Make it genuinely optional.

**On #6** — the one thing even website-sceptics use: *"I only look up the wedding website if I have to
travel to see if there are hotel accomodations."* And the payoff: *"Our hotel blocks are already filled up
thanks to the website."*

**Never include:** gift demands or cash asks · events not all guests are invited to (creates
"second-class wedding guests") · wardrobe micromanagement · moral diatribes about rejected traditions.

---

## Non-functional

- **NF1 Design for a guest who visits EXACTLY TWICE** — once on receipt, once the morning of.
  *"I will look at someone's wedding website once... But I won't go back and check for updates."*
  **The site is the reference layer, not the notification layer.** Anything that changes (a venue, a
  shuttle time) must be *pushed*; the site must never be the only place a load-bearing fact lives.
- **NF2 Mobile-first.** RSVP flow completable one-handed, 375px, portrait. Traffic arrives via QR codes on
  printed invitations, SMS and WhatsApp forwards.
- **NF3 Performance is a design attribute.** Real complaints name 5-second loads, laggy animation, and
  Chrome-only compatibility: *"the end user doesn't give a damn. They want a fast, responsive, stylish
  site."* Target LCP < 2.5s on 4G. **Test on old Android, iOS Safari, and a slow connection** — real
  reports include iPhone-only "We found 0 guests matching" failures that succeeded on desktop.
- **NF4 Accessibility WCAG 2.2 AA.** Guest lists skew elderly: 200% zoom, 44px tap targets, proper
  fieldset/legend on per-person RSVP cards. **Never set script over a photo for anything load-bearing** —
  the documented consequence of low-contrast script is guests missing the ceremony time.
- **NF5 Privacy.** Dietary/allergy data is special-category health data under UK GDPR. Never expose the
  guest list to enumeration. No guest PII in URLs or in any page served before identification.
  A real, concrete case for taking this seriously: *"I know a couple who had their wedding website open to
  the public. While the brides parents were enjoying themselves at her wedding, their house was robbed.
  The thieves knew exactly when they would be gone."*
- **NF6** OG/Twitter cards are the first impression when pasted into WhatsApp — but token routes get a
  **generic** card (STACK.md trap 6).
- **NF7** Idempotent, transactional RSVP writes. Spiky traffic: peaks when invitations land, at the
  deadline, and the week of.
- **NF8** Progressive enhancement — plain HTML POST fallback. Guests open these in in-app browsers
  (Gmail, WhatsApp, Facebook) with unpredictable JS.
- **NF9 The Tori Aaker test, as an acceptance criterion:** *"A truly high-end website would still feel
  high-end if you stripped out every hover effect and scroll animation."* Motion is garnish; if it is
  load-bearing, the design is not good yet.

---

## Evidence gaps (stated honestly, not filled by invention)

- **No real user complaint about autoplay music was found** across ~100 searches. The only signal is a
  market one (WeddingWire removed the feature). Treat it as designer-assumed, not evidenced.
  Same for countdown timers — Bliss & Bone classes them merely "Optional But Common"; nobody calls them cheap.
- **No first-person guest account of being locked out by a site password** — couples' *fear* of it is
  heavily evidenced, the guest-side harm is not.
- **No named mockery of Great Vibes / Alex Brush / Playfair / Lato / Montserrat was found.** The sourced
  criticism is *structural* (bouncy-baseline scripts, over-swashed calligraphy, single-typeface monotony),
  not name-specific to those five. The Inter / indigo-gradient tells ARE name-specific and well sourced.
- **No first-person account of a guest attending the wrong event** within a multi-day wedding. The
  best-evidenced multi-event pain is *pre-event ambiguity*, not day-of misnavigation.
- Nigerian and Jewish multi-event evidence is thin — search budget capped.
