# The design-review loop

> **Read this first: there were two phases, against two different theme sets.**
>
> **Phase 1 (rounds 1-3, below)** ran against an *original* set of four themes — Editorial Ivory,
> Botanical Plate, Letterpress Nocturne, Haveli — designed from scratch against an AI-slop checklist.
> A blind reviewer scored how confident it was that a machine had designed them. It ran 42 → 45 → 40
> and stalled, so it stopped at three rounds as the brief specified. **It never reached the <10%
> gate.** The reason it could not is recorded honestly at the end of round 3: the themes differed in
> paint and in hero composition, but shared one page skeleton below the fold.
>
> **Phase 2 replaced all four themes.** The instruction was to stop designing and start *copying*:
> every theme is now a copy of a specific live published template, and the gate changed from "does
> this look AI-made" to "does this match its source", judged by a different agent against a 90%
> target. Those six themes and that loop are documented in
> [`TEMPLATE-SOURCES.md`](./TEMPLATE-SOURCES.md).
>
> Rounds 1-3 below are kept because the *findings* outlived the themes: the margin-grid desktop
> layout, the optical leading, the sticky-header hand-off, the `@import` hoisting bug and the whole of
> `design-integrity.spec.ts` all came out of this loop and all still ship. The theme names in the
> tables no longer exist.


The brief set a hard gate: an independent reviewer looks at screenshots of the site and scores how
confident it is that the design was AI-generated. If that confidence is **10% or higher**, take the
feedback and go again. Stop after three rounds if the score stalls.

## How it runs

1. `scripts/capture.mjs` shoots every theme at desktop (1440×900) and mobile (iPhone 13), fold and
   full-page, after scrolling through to trigger any reveal animations.
2. `scripts/sections.mjs` shoots the content-dense sections framed rather than as a 28,000px strip.
   It pins `position: sticky` elements static for the shot only — Playwright scrolls a tall element
   to capture it, which drags sticky children down the frame and looks like an overlap bug that
   isn't there. That artefact wasted a reviewer's attention in round 1.
3. A **blind** reviewer agent gets only the images and a checklist of known AI/template tells. It is
   told nothing about who built the site or how, and is explicitly instructed not to be encouraging.
4. Findings are triaged into *real defects*, *taste calls*, and *capture artefacts*, then fixed.

Mechanical tells are also enforced continuously in `tests/e2e/design-integrity.spec.ts`, so a review
round only ever has to argue about judgement, never about whether someone shipped a gradient.

---

## Round 1 — `ai_confidence: 42`

The verdict was sharper than the number:

> "A human wrote this and a machine laid it out. The content layer has a point of view. The design
> system does not — it has a token file."

### What it caught, and what was done

| Finding | Verdict | Action |
|---|---|---|
| **Four themes were one layout with four token sets.** Every structural coordinate identical to the pixel across all four: content edge x=900, CTA height 96px, eyebrow at y=298. | Real, and the single strongest tell | Composition is now themed, not just paint — see below |
| **No desktop layout.** A 620px column in a 1440px viewport: ~62% of the screen doing nothing. "A mobile layout centred on a desktop canvas." | Real | Day headers moved out into the left margin as running heads at ≥1100px; per-theme grids |
| **Three theme names promised ornament that was entirely absent.** "A haveli theme with no jali. A botanical plate with no plate. A letterpress theme with zero impression." | Real, and damning | Each theme got one piece of drawn ornament with actual provenance |
| Ampersand leading broken — measured **1px** ink gap above and 84px below; in one theme it physically touched the descender of the first name | Real | Optical leading set per theme rather than from one shared token |
| `editorial-ivory` body face read as Inter — "the default tasteful-developer grotesque" | Real | Swapped Archivo → **Familjen Grotesk** |
| `botanical-plate` accent `#214232` indistinguishable from `#272727` ink at 13px — the "please arrive by" alert had no signal at all | Real | Accent-text lightened to `#3E6B4E` |
| Em-dash saturation, especially three consecutive dashed lines in the dress-code block | Real | Reasons became a quiet second line; prose dashes thinned |
| Straight apostrophes in "bride's" / "groom's" inside a design with swash italics and tracked small caps | Real | Smart quotes throughout |
| Vague headings: "Your schedule", "Questions" | Real | "Where you need to be", "Things people have asked" |
| Timeline rail at x=916 vs outer column at x=900 — an 8px near-miss | Real | Rail flush with its column |
| Sticky day header overlapping card content | **Capture artefact** — but it surfaced a genuine adjacent bug: the day header pinned *underneath* the sticky "viewing as" bar, hiding the day name. Fixed and regression-tested. |
| Old-style figures inside tracked caps reading as a broken glyph | Real | `font-variant-numeric: lining-nums` in the nocturne caps setting |

### The ornament, specifically

Each theme now carries one drawn thing, used sparingly:

- **Haveli Gold** — a **multifoil (cusped) arch** as an aperture the names sit inside, drawn as nine
  shallow lobes meeting at points on a tall narrow springing. The first attempt used five deep lobes
  and read as a cloud; a plain `border-radius` can only give the smooth semicircle of the generic
  "arch trend", which is precisely what the review was objecting to. Plus an eight-point **jali**
  star fret as the section rule.
- **Botanical Plate** — an engraved **specimen in a right-hand rail**, an engraved leaf centred on
  each rule, and italic plate-style section numbering.
- **Letterpress Nocturne** — actual **impression**: a dark offset below and a light highlight above
  the display type, which is what a debossed plate looks like under a raking light. Plus the printed
  border of the card stock, drawn once on arrival, and a deco **sunburst** rule.
- **Editorial Ivory** — no new ornament, deliberately. Its position is restraint; the change there
  was structural (marginalia) rather than decorative.

### The structural differentiation

| Theme | Hero composition |
|---|---|
| Editorial Ivory | Asymmetric two-column: date hung in the left margin as a running head, names flush against it |
| Haveli Gold | Centred inside a cusped-arch aperture |
| Letterpress Nocturne | Centred, inside a fixed full-viewport gold frame |
| Botanical Plate | Asymmetric: names left, engraved specimen in a right-hand rail |

---

## Round 2 — `ai_confidence: 45`

The score went **up**, and the reason was fair: round 1's composition work introduced a regression.

### The regression it caught

The desktop margin layout took its 210px running-head column **out of the text column** instead of
hanging outside it. Measured:

| Theme | Content column | Schedule height |
|---|---|---|
| editorial-ivory | 490px | 3,487px |
| botanical-plate | 530px | 3,591px |
| **haveli-gold** | **210px** | **6,205px** |
| **letterpress-nocturne** | **210px** | **6,148px** |

Two themes were wrapping body text at ~20 characters, stacking the three action buttons one per row,
and running **78% taller** for byte-identical content. The reviewer measured this independently and
ranked it above every aesthetic finding — correctly, because it was simply broken.

Fixed by pulling the grid left with `margin-left: calc(-210px - 3.5rem)` so column two begins at the
shell's own content edge. Content column is now 476px in the affected themes, and schedule heights
sit within 6% of each other.

### Other round-2 findings actioned

| Finding | Action |
|---|---|
| All four themes shared one body typeface (haveli and nocturne both on Jost) | Haveli moved to **Alegreya Sans**. Four themes, four body faces: Familjen Grotesk / Alegreya Sans / Jost / Karla |
| The botanical "plate" was free-icon-pack line art — symmetric, monoline, unanchored | Redrawn as an engraved **Jasminum sambac** (motia, the jasmine strung into garlands at Pakistani weddings): cross-hatched leaves, deliberately unequal pairs, caption rule, italic binomial, "PLATE I" |
| Botanical was a recolour of Editorial — 3% coordinate delta | Added a hairline rail between type and plate, making it a genuine three-column hero |
| Both centred themes had zero axis violation | Haveli's tagline and CTA step off-axis to the arch's springing; nocturne's date aligns left against a centred stack |
| The nocturne gold frame collided with the viewing bar | Frame now starts below it: `inset: calc(var(--stick-top) + 16px) 16px 16px` |
| Folio numerals illegible — "read as a stray tick" | 12.5px with 0.24em tracking |
| FAQ hairlines overshot the longest line by 273px | `.faq-item { max-width: 62ch }` so rule and measure agree |
| Tracked caps leave a trailing space, making button right padding read tight | Right padding compensated by the tracking amount |
| "Stray gold rectangle across the schedule" | **Capture artefact** — `position: fixed` ornament is painted at viewport coordinates inside a tall element screenshot. Harness now hides it for capture. |

### Three real product bugs surfaced by the test suite in the same round

None of these were design issues, and all three would have bitten a real owner:

1. **Successful sign-ins consumed the brute-force budget.** An owner who mistyped twice, succeeded,
   and came back later was locked out of their own guest list. Only failures count now, and a
   correct password clears the slate.
2. **`SameSite=Strict` on the admin cookie** meant following the CSV export link from an email or a
   bookmark looked like being signed out. Moved to `Lax`, which still withholds the cookie on
   cross-site POST — the thing that actually protects the Server Actions.
3. **The `Secure` flag was set from `NODE_ENV` rather than the request protocol.** Anywhere TLS is
   not terminated in front of the app, the browser silently drops the cookie and the admin loops
   back to sign-in. Now derived from `x-forwarded-proto`.

---

## Round 3 — `ai_confidence: 40`

Per theme: Editorial Ivory **25** · Botanical Plate **30** · Letterpress Nocturne **38** ·
Haveli Gold **42**.

### The loop stops here, and it did not hit the target

The brief said: iterate until the score is under 10%, and stop after three rounds if it stalls.

    Round 1: 42   Round 2: 45   Round 3: 40

That is stalled. Three rounds are done, so the loop is closed at **40%**, not under 10%. Reporting
that plainly rather than declaring success.

### Why it stalls, and it is worth understanding

Every round, the same finding sits at the top: **the heroes differ structurally but the page below
the fold does not.** Round 3 measured it precisely — four distinct hero arrangements (left-rail
asymmetric / centred / framed-centred / two-column-with-rail), but a schedule whose card slot order
is byte-identical across all four themes:

> time+timezone eyebrow -> event name -> summary -> venue -> arrive-by -> paragraph -> hairline ->
> WEAR + code -> swatch row -> not-swatch row -> notes -> three buttons

Eleven slots, same sequence, four themes, no theme reordering or dropping one.

**That is a deliberate product decision, not an oversight.** The schedule is the part of the site
guests actually use, under time pressure, on a phone, often at the venue. Four genuinely different
information architectures for the same content would mean four times the surface to test for the
visibility rules, four ways for an event to be missed, and a guest experience that changes depending
on a cosmetic setting the couple picked. The reviewer is right that shared structure reads as a
theme system. It is a theme system — and for the load-bearing screen that is the correct trade.

The honest summary of where this landed:

> The reviewer's own words, round 3: *"Individual surfaces read as human work — the copy especially.
> But the system reads generated"* — because four themes share one schedule wireframe.

To move materially below 40 would require giving each theme its own schedule information
architecture. That is achievable, and it is the single highest-value thing a fourth round would do —
but it trades a real guest-facing risk for a score, so it is left as an explicit recommendation
rather than done silently.

### Breakage fixed in this round anyway

The score gate closed, but defects are defects:

| Defect | Fix |
|---|---|
| **The haveli arch rendered broken** — both legs terminated mid-stroke and two orphan verticals reappeared ~160px below. The theme's signature asset looked like a clipping bug. | The path carried short vertical legs below the springing and the mask cut the arc mid-stroke. Now arc-only, with the fade starting below the springing so nothing ends in mid-air. |
| Swatch dots invisible on the dark theme — "Deep teal" and "Oxblood" were near-black circles on near-black navy | Every chip carries a legible hairline ring on that theme |
| Mobile: the A and Y of the first name collided in the nocturne caps | Explicit mobile tracking instead of inheriting the desktop value |
| The day rail wrapped inconsistently, stranding a lone "24" on its own line | Weekday and date are separate spans with a deterministic break — **two lines only at desktop**, where the header sits in the margin. A two-line *sticky* header slides half-under the viewing bar during hand-off and briefly shows one orphaned line, which is worse than the wrap it fixed. |
| Folio numerals read as a stray pipe or slash | Roman numerals replaced with `01`–`04`. A lone "I" is ambiguous at any size. |
| **A CSS ordering bug found while checking a review finding** | `@import './compositions.css'` is hoisted to the top of `globals.css`, so every base rule below it silently won same-specificity conflicts against the per-theme layer. The day-header underline was still painting despite `border-bottom: 0`. Now imported from the layout *after* globals. |

### Findings deliberately not actioned

- **"Body copy fails contrast" on three themes.** Judged by eye. `@axe-core/playwright` measures the
  actual ratios on every route in both engines and reports zero WCAG 2.1 AA violations. Trusting the
  instrument over the impression.
- **"Faint horizontal tone seams in the FAQ captures."** The reviewer flagged these as probable
  capture artefacts themselves. They are: the paper-grain overlay tiles at 240px.
- **"Two of four themes name ornament they do not deliver."** Partly actioned — the arch, jali fret,
  deboss, card frame, sunburst, engraved plate and plate captions were all added across rounds 1-3.
  Going further (a repeating jali field, per-glyph impression) starts to fight the restraint that
  every round has praised as the strongest thing here.

---

## Notes on judging the judge

The reviewer is a useful instrument but not an oracle, and two round-1 findings were wrong:

- The "sticky header has no background" claim was a screenshot artefact; the header does have an
  opaque ground. The capture harness was fixed so later rounds are not misled by it.
- Reviewing 28,000px full-page strips produces spurious "overlap" and "cramped" findings.

Findings are therefore always triaged against the live page — usually by measuring the actual DOM —
before anything is changed. A design review that is acted on without verification is just a second
opinion applied blind.
