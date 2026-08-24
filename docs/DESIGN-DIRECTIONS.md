# Design Directions

> **Phase 1 research.** The four *directions* proposed at the end of this document (Editorial Ivory,
> Botanical Plate, Letterpress Nocturne, Haveli) were built, reviewed three times, and then **replaced
> wholesale** by six themes that each copy a specific live published template — see
> [`TEMPLATE-SOURCES.md`](./TEMPLATE-SOURCES.md). The *findings* below are what made that decision
> obvious, and several of them (the Bliss & Bone longhand-date convention, the harvested-palette
> method, the AI-slop checklist that `design-integrity.spec.ts` enforces) carried straight over.


_Palettes marked **[harvested]** were pulled directly out of the live site's production CSS. **[derived]** are
tints/shades computed from a harvested anchor to complete a 7-role palette. All fonts named are real Google Fonts._

## The load-bearing findings

1. **Serif display + grotesk body is now table stakes, not differentiation.**
   - `danielaandmoe.com` (SiteInspire, Bridal & Weddings): **Canela Web Thin** + **Calibre** — a Klim/Commercial
     Type pairing you'd expect on a fashion masthead.
   - `blissandbone.com` (the platform "synonymous with high design"): **Ethic Serif Light** + **NeueSwiss**.
   - Even Zola, the volume player, ships **new-spirit** + **circular**.
   - **Therefore: differentiation must come from palette, layout signature, and ornament — not the type genre.**
2. **2026 stationery consensus is a hard turn AWAY from the wedding default.** Paperlust: away from watercolour
   florals, hand-drawn fonts and blush-on-blush; toward coloured stock as the design, white-ink on dark,
   arch die-cuts, oversized date typography, and one unexpected hue against a structural neutral.
3. **Sage / dusty blue / blush is now the DEFAULT palette** — it carries the same signal Inter and
   indigo-purple carry in software. Poppy Flowers' 2026 "what's out": dusty blue = "color fatigue after 3+
   years of dominance"; baby's breath "now reads as dated"; sage "overexposed".
4. **Cheapness is the unchosen default plus clutter — not any single element.**
   Tori Aaker's test, which we adopt as an acceptance criterion:
   > "A truly high-end website would still feel high-end if you stripped out every hover effect and
   > scroll animation."
   And: "A well-handled standard font in a beautiful layout looks more luxurious than an expensive font
   in a crowded, poorly spaced design."
5. **Dress-code-as-colour-swatches** (from Anvaya) is the single best detail found anywhere:
   guests see "the exact yellow for the haldi, not the word 'yellow'." Steal it regardless of theme.

---

## THEMES TO BUILD (4)

### 1. Editorial Ivory — _lowest risk, highest floor_
Refs: danielaandmoe.com · blissandbone.com · katieleamon.com · papier.com · Minted "Wedding Editorial"

| Role | Hex | |
|---|---|---|
| bg | `#FDFBF6` | [derived] warm paper |
| surface | `#F4F1EA` | [derived] |
| ink | `#1E2525` | **[harvested]** papier.com — green-shifted near-black, NOT neutral grey |
| muted | `#6B6B63` | [derived] |
| accent | `#B4472C` | [derived] from danielaandmoe `#FF5734`, desaturated for large areas |
| accent-soft | `#F5E2D8` | [derived] |
| border | `#DED9CE` | [derived] |

- **Type:** `Cormorant Garamond` 300 (+300 italic) display / `Archivo` 400,500 body.
  Names `clamp(3.5rem,11vw,8.5rem)` w300 `ls:-0.02em` `lh:0.94` **sentence case**.
  Eyebrows `11px` w500 UPPERCASE `ls:0.18em`. **Never set Cormorant below 20px** — it goes spindly.
- **Ratio discipline: display:body must exceed 6:1** (112px vs 17px). Under 4:1 reads as a template.
- **Layout:** centred single column `max-width:620px`, `200px` between sections, hairline rules that span
  ONLY the column (never edge-to-edge). Dates hang in the left margin at `-140px`, marginalia-style, desktop only.
- **Motion:** opacity 0→1 over 700ms `cubic-bezier(.22,1,.36,1)` + 12px rise, **on section headings only**.
- **Signature:** the `&` set in Cormorant 300 *italic* at 1.4x in `--accent` as the sole ornament ·
  letterpress hairlines (`border-top` + `box-shadow: 0 1px 0 #FFFDF8` to mimic debossing) · roman-numeral
  section numbers hung in the margin.
- **Zero `border-radius` in the entire system.**
- Do NOT use `#FF5734` above 24px — at heading size it reads as "startup orange".

### 2. Haveli Gold — _best fit for a multi-event celebration_
Refs: anvaya.love (harvested) · WedSites George & Tarini · Paperlust flat-foil-on-dark

| Role | Hex | |
|---|---|---|
| bg | `#F3EAD8` | **[harvested]** anvaya.love — lime-washed bone |
| surface | `#EFE7D6` | **[harvested]** |
| ink | `#3A2A21` | [derived] warm umber, never neutral black |
| muted | `#8A7261` | [derived] |
| accent | `#C1572F` | **[harvested]** terracotta/vermillion |
| accent-soft | `#F4C9B8` | **[harvested]** |
| border | `#DCCFB6` | [derived] |
| metal | `#C9A227` | **[harvested]** antique gold — hairlines and ornament ONLY |
| night | `#2A1F2E` + `#C79B4A` | for candlelit evening-event sections |

- **Per-event accent hues are CORRECT here** because each is a real dress code, not decoration:
  Mehndi `#7A6A2E` henna-olive · Haldi `#C9A227` turmeric · Nikkah `#EEF2EE` **[harvested]** cool bone ·
  Sangeet `#B56A4A` **[harvested]** · Walima `#5D3B42` **[harvested]**.
- **Type:** `Marcellus` 400 display (Roman-inscriptional, reads carved not printed) / `Jost` 300,400,500 body.
  Optional third face for a bismillah or couplet: `Aref Ruqaa`, `Amiri` (Naskh), or `Gulzar` (Nastaliq) —
  all genuinely well-drawn, all on Google Fonts. **One line of Nastaliq is worth more than any ornament we
  could draw**, and no template generator ships it.
- **Layout signature — the gold thread rail:** a 1px `#C9A227` vertical line down the left of the content
  column (desktop `x:64px`, mobile `x:20px`). Each event is a `9px` open circle node; days are a **filled**
  gold diamond. Jali screen dividers between sections (SVG lattice of interlocking eight-pointed stars,
  `48px` tall, `--border` at 40%).
- **Motion:** 600ms ease-out + 16px rise, staggered `80ms` per event card so the schedule "unrolls".
  The gold thread draws top-to-bottom via `stroke-dashoffset` tied to scroll — the ONLY scroll-linked
  effect in any theme, and it earns its place because it literally is the through-line of the multi-day event.
- **Signature:** dress-code swatch chips (`14px` circles of the actual colours) on every event card.
- Trap to avoid: "Western themes tinted gold". Jali geometry and per-event semantic colour are the antidote.

### 3. Letterpress Nocturne — _highest ceiling, highest risk_
Refs: mrboddington.com (harvested) · Zola "Milky Way"/"Verona" · Greenvelope Art Deco guide · colinanddewi.com

| Role | Hex | |
|---|---|---|
| bg | `#12132B` | [derived] |
| surface | `#1C1D3D` | **[harvested]** mrboddington.com |
| ink | `#F2EEE4` | [derived] warm white-ink, **not** `#FFFFFF` |
| muted | `#9A9AB4` | [derived] |
| accent | `#C9A227` | **[harvested]** true antique gold, not yellow |
| accent-soft | `#ECD06F` | **[harvested]** colinanddewi.com — foil-shine highlight |
| border | `#2E2F52` | [derived] |

- **Type:** `Italiana` 400 display, **UPPERCASE**, `ls:0.14em` — wide tracking is non-negotiable, deco
  lettering is defined by it. `Cinzel` 400 for dates/roman numerals. `Jost` 300,400,500 body (Futura lineage
  = the actual typeface of the deco moment). Fallback display if Italiana is too fragile on mobile:
  `Poiret One` or `Julius Sans One` — both period-correct.
- **Layout:** a **fixed full-viewport inset frame** — 1px `#C9A227` rectangle inset 28px (mobile 16px) that
  stays while content scrolls beneath, like the printed border on card stock. Stepped deco arch (SVG, three
  concentric arcs) introduces each section.
- **Motion:** 900ms ease-out. One signature move: the inset frame **draws itself** on load — four
  `stroke-dasharray` animations, 1200ms, staggered 100ms, top→right→bottom→left. Happens once, never again.
- **Signature:** sunburst rule (a 120px fan of 9 hairline rays) instead of a divider line · roman numerals
  `XIV · IX · MMXXVI` · 6px gold corner lozenges.
- **THE GOLD MUST NEVER BE A GRADIENT.** Real foil is flat metallic with a hard specular edge. Use flat
  `#C9A227` with a 1px `#ECD06F` top-edge highlight. `linear-gradient(gold, darker-gold)` is the single
  fastest way to make this look like a 2013 Gatsby WordPress theme.
- This is dark *stock*, not dark mode. Warm `#F2EEE4` on `#12132B` simulates white ink on navy card.

### 4. Botanical Plate — _the answer when there are no couple photos_
Refs: riflepaperco.com (harvested) · Minted "In Bloom" · Bliss & Bone "Greens" · Zola "Eastwick"

| Role | Hex | |
|---|---|---|
| bg | `#F5F2EF` | **[harvested]** riflepaperco.com |
| surface | `#EDE9E2` | [derived] |
| ink | `#272727` | **[harvested]** |
| muted | `#6E7264` | [derived] |
| accent | `#214232` | **[harvested]** deep green |
| accent-soft | `#C2CAAC` | **[harvested]** sage |
| border | `#D8D3C7` | [derived] |
| cool note | `#3B6072` | **[harvested]** slate blue — links only; **this is what stops it going twee** |

- **Type:** `EB Garamond` 400/500 + 400 italic display / `Karla` 400,500 body. Section headings `2rem` w500
  with `font-variant: small-caps` `ls:0.06em`.
- **Signature detail — the Latin binomial caption.** `Rosa gallica var. officinalis` in EB Garamond italic
  at 13px under every plate, mimicking a printed botanical plate. Nobody else does this. The couple gets one
  too in the footer, as a joke for people who notice.
- **Layout:** asymmetric `1fr / 320px` grid, narrow right rail holds one botanical plate per section, with a
  1px vertical rule between columns. **Plates are never cropped to a shape and never behind text** — they
  float on the paper ground with their own whitespace, as a printed plate sits on its page. Mobile: rail
  collapses, plate becomes a 140px centred ornament above its heading.
- **Motion: nothing moves.** A printed plate doesn't animate. Sole concession: plates fade 0→1 over 1000ms
  on first scroll into view with **no translate** — they develop, like ink appearing.
- **Assets (all public domain / CC0):**
  - rawpixel — Edwards's Botanical Register board, CC0, ~100 hand-coloured engravings 1829–1847,
    already background-removed. Best drop-in set.
  - Biodiversity Heritage Library on Flickr — 250,000+ images, curated by album.
  - Old Book Illustrations — incl. an Ornaments & Patterns subject for rules and fleurons.
  - **Treatment rule:** 100% opacity on the paper ground with full whitespace. Do NOT blur, do NOT put
    behind text, do NOT tint to the accent, do NOT tile as a background.

---

## THE AI-SLOP CHECKLIST — automated gate

> **Quick self-audit — if the build contains ANY of these, it has failed:**
> `linear-gradient` · `border-radius: 16px` · `box-shadow: 0 4px 6px rgba(0,0,0,.1)` ·
> `font-family: Inter` · an emoji inside a heading.

**Colour**
1. Purple/indigo→violet gradients. The literal AI defaults: `#615FFF`, `#8E51FF`, `#0F172B`. If any appear, restart.
2. Gradient-filled buttons/CTAs. Real stationery has no gradients; ink is flat.
3. Gold as `linear-gradient(#FFD700,#B8860B)` — the wedding-specific version of #2.
4. Alternating `#FFFFFF`/`#F5F5F5` section backgrounds — the universal AI rhythm.
5. Pure `#FFFFFF` bg and pure `#000000` text. Every real stationer harvested uses warm off-whites and
   near-blacks (Papier `#FFFEFA`/`#1E2525`, Katie Leamon `#FEF9F2`/`#121212`, Rifle `#F5F2EF`/`#272727`).
6. 5+ competing hues with no semantic meaning. (Per-event dress-code colours are the legitimate exception.)
7. **Dusty rose + sage + cream specifically** — the wedding equivalent of Tailwind Blue.

**Typography**
8. Inter / Roboto / Open Sans / Lato / Montserrat / Poppins as primary. Inter is the #1 named tell.
9. Same family for headings and body.
10. Uniform increments 16→24→32→48px. Real editorial jumps violently (17px body → 112px display).
11. `line-height: 1.5` on everything. Display needs 0.9–1.1; body 1.6–1.7.
12. Default (zero) letter-spacing everywhere.
13. Bouncy-baseline wedding script as display — Great Vibes, Dancing Script, Parisienne, Allura.
    Script confined to 2–3 words (names only) is fine; script as the headline face is the tell.
14. Playfair Display at **weight 700**. Playfair is fine at 400–500; at 700 it's the most-used free
    "elegant" heading on the internet.

**Shape / shadow / spacing**
15. Uniform `border-radius` on everything. Best wedding sites use ZERO, or one intentional organic shape.
16. `box-shadow` on cards. Paper doesn't cast a soft blurred shadow onto other paper. Use a hairline rule.
17. Identical padding everywhere (Tailwind's `py-24` is named as a tell).
18. Left-border accent stripes on cards.

**Layout**
19. A three-column card grid, repeated.
20. Every section structured heading → description → cards.
21. Everything centre-aligned. (Centring as a *system* is fine — Editorial Ivory uses it — but only if
    something deliberately violates it.)
22. Fullscreen hero + big text + two side-by-side CTA buttons.
23. Countdown timer as a boxed widget with colons. Only acceptable if typographically integrated —
    an oversized numeral in the display face.
24. 3+ CTAs per section. 25. 50+ items visible without scrolling.

**Imagery / icons**
26. **Emoji as functional icons** — 💍 💐 🥂 ✨ as section markers. Instantly fatal.
27. Generic line icons for schedule events (champagne glass, rings, cake). Several real sites do this and
    it's the most template-coded detail on an otherwise good page. **Use a numeral or a typographic mark.**
28. AI-generated couple illustrations. 29. Stock photos of anonymous couples — worse than no photo.
30. The same watercolour floral corner-spray on every page. 31. Gradient placeholder blocks.

**Copy / motion**
32. Excessive em dashes — the single most-cited copy tell.
33. Curly quotes where straight ones would be natural — a direct LLM artefact.
34. Vague headings: "Details", "Information", "The Big Day". **Specificity is the antidote** — one real site
    reads as human precisely because its schedule names *close-up magic, carving station, paella*.
35. Scroll-reveal opacity animations on every element.
36. Uniform fade-ins with identical timing on all element types.
37. Touch targets under 44x44px.

---

## Multi-event schedule layout — the recommended pattern

**Day-segmented, left-anchored timeline rail of equal-weight event cards.**

```
FRIDAY 26 JUNE                    <- day header, display face, rule beneath, position:sticky
 |
 O  17:00   MEHNDI                <- node on rail; time in tabular-nums; name in display face
 |          Ivy House, Karachi
 |          * * *  Emerald - Gold <- dress-code swatches (the single best detail found)
 |          One sentence on what this ceremony is and what to expect.
 |          [ Map ]  [ Add to calendar ]
SATURDAY 27 JUNE
 |
 O  11:00   NIKKAH
```

Why: **day headers** give scanning anchors · a **left-anchored** rail (never centre-alternating) collapses to
mobile with zero layout change · **`font-variant-numeric: tabular-nums`** makes times align vertically down
the column, which is what makes it feel like a printed itinerary rather than a list of divs ·
**one explanatory sentence per event** is essential where ceremonies are unfamiliar to some guests.

**Mobile rules:** rail at `x:20px`, content indented 44px · time and event name on separate lines, never
side-by-side (they wrap horribly) · **no horizontal scroll, no tabs-by-day, no accordions on the core
schedule** — tabs hide the shape of the weekend, which is the exact thing a multi-day guest needs ·
sticky day header · every tap target >= 44x44px.

**Never:** a horizontally-scrolling day carousel · a `<table>` with time/event/venue/dress columns (dies
below 480px) · centre-alternating timelines · an accordion with the ceremony time behind a tap.
