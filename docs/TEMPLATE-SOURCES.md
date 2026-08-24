# Template sources — what each theme is copied from

Every theme in this project is a copy of a **specific, live, publicly-published template**. Not
"inspired by". Copied: the palette is harvested from that site's own stylesheets, the type system
matches role for role, and the one structural signature that makes the original recognisable at a
glance is reproduced.

This document is the contract. Each entry gives a URL you can open right now, why that template was
worth copying, the exact values pulled out of its CSS by `scripts/harvest.mjs`, and — stated plainly
rather than hidden — **every place the copy deliberately departs from the source**.

Raw harvests are in `.data/harvest/<name>/report.txt`. The counts below (`x61`, `x23`) are how many
times that hex literally appears in the source's stylesheets, which is how the *dominant* colour was
identified rather than guessed.

## How these six were chosen

- **Two families of source.** Four are from [Bliss & Bone](https://myblissandbone.com), a paid
  wedding-website studio whose templates are published as fully-populated live demos — so what you
  are copying is a finished design, not a screenshot. Two are real, individual wedding sites:
  `veleyross.wedding` (an Awwwards winner) and `anvaya.love` (built specifically for South Asian
  multi-day weddings, which is this project's demo case).
- **Every URL was fetched, not assumed.** `scripts/harvest.mjs` requested each page, followed its
  `<link rel=stylesheet>` tags, and parsed the CSS for colour frequency, custom properties and
  `font-family` declarations. If a page had not returned 200 it would not be in this list.
- **Selected for maximum difference from each other.** The brief was explicitly not to end up with
  six variations of elegant-serif-on-cream. What is here: a type-led editorial green, a marker-pen
  crimson, an electric blue with a script, a sans-only near-monochrome, an inverted rust-on-tan, and
  one ornamental bilingual serif. Exactly one uses a classical serif on a pale ground.

## Where the substitutions are, and why

Three sources use **licensed retail typefaces** that cannot legally be redistributed with this
project. Each is replaced by the closest Google Font in the same genre, and the substitution is named
in the table rather than quietly made:

| Source face | Where | Substitute | Why it is the right substitute |
|---|---|---|---|
| Canela | veleyross.wedding display | **Fraunces** | Both are high-contrast transitional serifs with a flared, slightly wonky axis; Fraunces' optical-size axis lets it hold at 19vw without going spindly |
| Founders Grotesk | veleyross.wedding body | **Archivo** | A neo-grotesque with the same slightly-condensed, engineering feel |
| SaintAmour | myblissandbone.com/avril names | **Allura** | A single-weight formal English roundhand; same high-contrast copperplate genre |
| OlivieSans | myblissandbone.com/alessia body | **Poppins** | A geometric sans with near-circular bowls, as the original has |

The rest use faces that **are** freely available and are therefore used directly and unchanged:
Permanent Marker (Alessia), EB Garamond (Kelsey, throughout), Poppins (Aspen, throughout) and
Cormorant Garamond (Anvaya's display, at the source's weight 300). Anvaya's neutral sans — Geist in
the source — is Inter here.

One more substitution is editorial rather than legal: **Anvaya's Devanagari** is swapped for
**Noto Nastaliq Urdu**, because the demo wedding is Pakistani. The structural point — a second script
set beside the Latin names, which is why the source loads Noto Serif in four Indic scripts — is
preserved exactly.

---

## 1. Marry Monday ← **veleyross.wedding**

| | |
|---|---|
| **Live** | https://veleyross.wedding/ |
| **Provenance** | Awwwards Site of the Day — a real wedding site, not a template demo |
| **Why this one** | It is the least wedding-looking wedding site of the six, and the only one whose identity is carried by type size alone |

**Harvested**

```
#284135  x13   deep forest green — the ink and the accent, both
#f3f2f1  x11   the ground
#c3c2c0  x5    hairline / the outline stroke colour
#999790  x2    muted text
#fdfdfb  x1    raised surface
```

Its own `h1` is literally the words **"Marry Monday."** — which is where this theme's name comes
from — and the date is set as `.h-s1-no` at `font-size: 22.22vw; letter-spacing: -.889vw`, painted as
an **outline** (`-webkit-text-stroke-color: #c3c2c0`) with a transparent fill, not as a filled
headline. It carries a sticky bar pinned to the **bottom** of the window as well as the top.

**Copied**: all five colours at their harvested roles; the giant outlined date numerals; the
bottom-pinned rail; the running head hung outside the text column.

**Departures**

- Display and body faces are substituted (see the table above).
- The numerals are set at **19.6vw, not 22.22vw**. Fraunces' figures are wider than Canela's, so at
  the source's exact value our twelve characters ran past the viewport and clipped mid-glyph. The
  size was solved so the string ends flush with the screen edge — the source's *proportion*
  reproduced with our substitute's *metrics*. This is written into `app/compositions.css` at the
  rule itself.
- `--muted` is `#647169`, darkened from the harvested `#999790`, which fails WCAG AA at body size.

---

## 2. Alessia ← **myblissandbone.com/alessia**

| | |
|---|---|
| **Live** | https://myblissandbone.com/alessia |
| **Provenance** | A published Bliss & Bone template, sold and shipped to real couples |
| **Why this one** | The loudest, least precious wedding design in general circulation — a marker pen at display size |

**Harvested**

```
#9c0a0d  x61   crimson — by a distance the dominant colour
#fffaf1  x23   warm cream ground
#f3f1ee  x4    raised surface
#9a9490  x1    muted
```

Its own headings show the house convention that all four Bliss & Bone templates share and that this
project copies wholesale: **dates and times are written longhand, never in numerals** — *"3 in the
Afternoon"*, *"September Ninth Two Thousand Twenty Three"*. There is not one numeral in a Bliss &
Bone event block. `lib/format.ts` implements this (`dateInWords`, `timeInWords`, `timeSpanInWords`)
and `tests/e2e/template-fidelity.spec.ts` asserts it.

**Copied**: the crimson-on-cream at the source's proportion (crimson is the accent *and* the display
ink); Permanent Marker at display size; the longhand date convention; no card containers anywhere —
sections are separated by rules and space, exactly as the source does it.

**Departures**

- Body face substituted (OlivieSans → Poppins).
- **Type roles are half-swapped, knowingly.** In the source, Permanent Marker is the *body* face and
  the heavy geometric sans is the *display* face. Setting a forty-field RSVP form in a marker face is
  a legibility trade this project will not make, so running text stays in the sans — but the cover
  sets its one enormous line in the heavy sans, uppercase and cream, which is where the source puts
  that face.
- `--muted` is `#8a4a4c`, a desaturated crimson at 6.38:1. The source has no grey secondary tone.
- The source's `#ff0000` (x14) is ignored: it is the Bliss & Bone form-validation red, not part of
  the design.

---

## 3. Avril ← **myblissandbone.com/avril**

| | |
|---|---|
| **Live** | https://myblissandbone.com/avril |
| **Provenance** | A published Bliss & Bone template |
| **Why this one** | Electric blue is the single least "wedding" colour in use anywhere in the category |

**Harvested**

```
#013ab2  x65   electric blue — dominant, and used as the ink itself
#fffaf1  x21   the same warm cream as Alessia
#9a9490  x1    muted
```

**Copied**: the blue used as *body ink*, not merely as an accent — this is the thing that makes the
template look like itself; a light grotesque for everything with one formal script reserved for the
names; a full-bleed colour block for the dress code.

**Departures**

- Script face substituted (SaintAmour → Allura).
- `--muted` is `#4a5a80` — the blue desaturated toward slate at 6.59:1, not a grey. The source sets
  `body`, `p`, `h4` and `h5` to the blue itself.
- The source sets its body in **Inter Light**, which the project's own design-integrity test would
  normally reject as too thin. That check is deliberately relaxed for this theme with the reason
  written into `tests/e2e/design-integrity.spec.ts` — copying faithfully was judged the higher goal.

---

## 4. Aspen ← **myblissandbone.com/aspen**

| | |
|---|---|
| **Live** | https://myblissandbone.com/aspen |
| **Provenance** | A published Bliss & Bone template |
| **Why this one** | The restrained one. It proves the set is not six loud themes |

**Harvested**

```
#595141  x39   taupe — the ink
#978f8b  x21   secondary
#ffffff  x17   the ground, genuinely white
#cfc7c1  x9    hairline
```

**Copied**: a **single** typeface for the entire page at an extra-light weight, with **no serif
anywhere** — the source loads Poppins and nothing else, and the copy is tested for it; the taupe ink;
and the structural signature, a **full-viewport splash carrying nothing but the names**, with the
site beginning below it.

**Departures**

- `--muted` darkened to `#746d69` for AA.
- The source grounds on pure `#ffffff` (x17), which the design-integrity suite would normally flag as
  the default-white smell. Relaxed for this theme, with the reason in the test file: it is what the
  source actually does.

---

## 5. Kelsey ← **myblissandbone.com/kelsey**

| | |
|---|---|
| **Live** | https://myblissandbone.com/kelsey |
| **Provenance** | A published Bliss & Bone template |
| **Why this one** | It is **inverted** — the paper is dark and warm. Every other wedding site in the category is dark ink on pale |

**Harvested**

```
#e0d8cb  x56   TAN — the ground, and the dominant colour on the page
#7f4928  x21   rust — the ink
#c8a99a  x9    dusty rose accent
```

That `x56` on the ground is the whole point: in every other source here the dominant hex is the ink
or the accent. Here it is the paper.

There is a second inversion the frequency count alone does not show, and round 2 caught it: the
source is `html { background: #7F4928 }` with `body { color: #E0D8CB }`. The **page** is rust with
cream type on it, and only the cover flips to the tan. Every section after the cover — including
`main section.rsvp .content + .content` — is cream on rust.

**Copied**: both grounds in their source roles — a rust page with a tan cover over it; one typeface
(EB Garamond) throughout, at `letter-spacing: 0`, which is what the source sets on every rule it
writes; the longhand date convention; the cover name set left against the gutter rather than centred.

**Departures**

- `--muted` on the rust is `#e2d2c8` (4.95:1). The harvested `#c8a99a` is 3.33:1 and cannot carry
  body copy; it survives as a hairline and a swatch.
- `--muted` on the tan cover is `#665346` (5.14:1).

---

## 6. Anvaya ← **anvaya.love**

| | |
|---|---|
| **Live** | https://anvaya.love/ |
| **Provenance** | A live product built specifically for South Asian multi-event weddings |
| **Why this one** | It is the only source in the set designed for a wedding that runs for days, which is exactly this project's demo case |

Anvaya publishes **named design tokens**, so its palette is not inferred from frequency but read
straight off:

```
--background          #fbf9f5
--foreground          #1b1c1a
--template-primary    #570013   oxblood        (x13, and the literal fallback in var(...))
                      #d4af37   metallic gold  (x7)
                      #6f5c5d   muted          (x9)
                      #e0d0d0   soft rose      (x5)
```

It loads **Noto Serif in four Indic scripts** precisely so names can be set in a second script beside
the Latin ones. That is its signature and the copy reproduces it.

**Copied**: the tokens at their named roles; **Cormorant Garamond as the display face at weight 300
with -0.015em of tracking**, which is what the source's `h1` actually is, over a neutral sans; the
gold tracked eyebrow; the fully-rounded oxblood CTA pill; the second script beside the names (as
Nastaliq, for a Pakistani wedding).

**Departures**

- **Gold as text is darkened.** `#d4af37` on this cream measures **2.00:1** — not a near miss on
  WCAG AA, unreadable. The eyebrow and folio marks the source sets in gold are set in `#836618`
  here: the same metal, 5.15:1 on the ground and 4.89:1 on the rounded panels — it has to clear AA
  on both, and the first value chosen cleared only the ground. `#d4af37` survives as the hairline it can legitimately be.
- Bodoni Moda sat in the display slot for three rounds and is **gone**. It appears nowhere in the
  source, and having it there pushed Cormorant down into the body and left the page with no sans at
  all. Round 2 caught this.
- `--accent` was `#800020` for three rounds, which also appears nowhere in the harvest. It is now
  `#570013` — 13 occurrences, and the literal fallback in `var(--template-primary, #570013)`.
- The source is a **product landing page**, not an invitation, so its photo-card collage, its top
  nav and its floating stat card have no counterpart here. Its palette, its type system and its
  bilingual headline are what is being copied; that is stated rather than glossed.

---

## How fidelity is kept honest

Two mechanisms, one mechanical and one human-ish:

1. **`tests/e2e/template-fidelity.spec.ts`** asserts, for all six, that the rendered ground, display
   ink, display face and body face equal the harvested source values — plus one test per theme for
   its structural signature (the longhand dates, Anvaya's second script, Marry Monday's bottom rail,
   Aspen's zero serifs, Kelsey's tan ground). Nudge a hex or swap a typeface and this fails.
2. **A blind audit agent** is given the six source URLs and screenshots of the six copies with no
   information about which is which, and scores each on palette (25), type (25), layout signature
   (30) and overall gestalt (20).

### Audit record

| Round | Overall | Per theme | What changed after |
|---|---|---|---|
| 1 | **80** | kelsey 92 · anvaya 88 · avril 81 · aspen 81 · marry-monday 80 · alessia 76 | Marry Monday's date numerals made giant and **outlined** as the source's `.h-s1-no` is — round 1 caught that the 22.22vw value had been applied to the *names* rather than the *date*, and that the source paints them as a stroke, not a fill. Alessia's peach card container removed (the source has no card containers; the audit's phrase was that the signature "is not merely missed, it is reversed"). Avril's dress-code block made full-bleed. Aspen given its full-viewport splash gate. Buttons switched to each theme's own accent instead of a shared one. |
| 2 | **65** | aspen 79 · marry-monday 75 · kelsey 71 · anvaya 67 · avril 55 · alessia 45 | Round 2 was audited far more strictly than round 1 — this auditor fetched each source's own stylesheet and read its live computed styles rather than judging from screenshots — so the number is not comparable to round 1's, and the findings are the useful part. Its verdict: **"the six copies get colour VALUES right and colour ROLES wrong."** See below. |
| 3 | **66** | marry-monday 74 · aspen 72 · avril 71 · anvaya 66 · kelsey 59 · alessia 52 | Flat against round 2, and the audit said precisely why. It verified the wins — Avril's blue/cream banding surviving to mobile, Aspen's type now literally being the source's own Poppins Light/ExtraLight at `letter-spacing: normal`, Anvaya's Bodoni confirmably gone, Marry Monday's rotated rail, corner marks and stroke-only numerals as faithful transcriptions of real rules — then found **two fixes that had overshot into new errors**, **two that had not actually landed**, and one charge that caps every score. |
| 4 | **67** | avril 78 · marry-monday 74 · anvaya 72 · aspen 63 · kelsey 57 · alessia 56 | Real structural work, cancelled out by what it broke. The audit verified the wins — the date gutter genuinely scoped to one theme, rail and node genuinely gone from the other five, section titles genuinely 57-78px past the fold, Avril's flat-blue script cover "a near-exact reproduction of the one screen its template is recognised by" — and then found that **Kelsey's ground had been inverted back to wrong**, **Alessia had gained a fabricated first screen**, and **two headline claims were false as stated**. |
| 5 | **70** | kelsey 79 · avril 78 · marry-monday 73 · aspen 71 · anvaya 62 · alessia 59 | The harvest itself was wrong, and everything downstream of it. Kelsey's inversion and Avril's three type voices both landed and are now the two strongest copies in the set. Two reversals moved *away* from the source while citing it, and one fix was dead code — all three found and fixed afterwards. |

**The loop stopped here.** The brief set 90 as the target and five rounds as the ceiling; the ceiling
arrived first. Scores: **80 → 65 → 66 → 67 → 70**. Round 1's 80 is not comparable — it judged from
screenshots, and every round after it read the sources' own stylesheets and computed styles.

### What round 5's audit caught that was real, and what was fixed after it

Three were defects rather than matters of taste, and all three are fixed:

- **A unitless zero was silently breaking every button on two themes.** `--label-tracking: 0` made
  `calc(1.6em + var(--label-tracking))` invalid at computed-value time, so `padding-right` fell back
  to its initial `0` — and every Kelsey button label sat on or across its own right border. The
  tracking tokens carry units now. This is the kind of thing no screenshot review finds and no
  assertion in the suite was watching for.
- **Marry Monday's shell cap was dead code.** A later rule at equal specificity won, because a media
  query adds no specificity. The running head was still rendering off the left edge, mid-word
  ("riday / ruary"), at 1440px — in the very screenshots submitted as evidence that it was fixed.
- **Aspen's button.** The source's visible box is on `.button span` (`border: 1px solid #CFC7C1`),
  not on the outer `.button`, whose border genuinely does compute to 0. Round 5 measured the outer
  element, made the button borderless, and in doing so made Aspen disagree with Kelsey — which is
  built from the identical Bliss & Bone base sheet and had it right.

And one methodological miss that had produced **three invented colours**: the harvester read
`styles.css` but not `page.html`. All four Bliss & Bone templates keep their block colours in inline
styles. `#a20d13`, `#fbd8cb` and `#e8e3df` were written into this project's CSS with comments
asserting them as harvested fact, and **none of them appears anywhere in any source**. The real
values were sitting in the pages the whole time:

```
alessia   #ffd8c7 x5   #9c0a0d x7      aspen    #cfc7c1 x4   #595141 x5
kelsey    #c5ad9f x4   #a27a65 x3      #e0d8cb x6   #7f4928 x23
```

All replaced with the source values, and Kelsey gained the third block colour it had been missing.

### Where the audit was wrong, and how that was settled

Round 5 recommended deleting the line icons from Alessia and Avril as "invented — no source ships
any of it". Round 4's audit had said the opposite. The sources settle it, and round 4 was right:

```
alessia/page.html:  <object data="…/pp_graphic-country-club-10.svg"  data-color="9c0a0d">   × 5
avril/page.html:    <object data="…/pp_graphic_dolce-vita-drink-1.svg" data-color="013ab2">  × 7
aspen/page.html, kelsey/page.html:  none
```

Bliss & Bone ships recoloured line-art SVGs through `<object data-color>` — five on Alessia, seven
on Avril, none on Aspen or Kelsey. So the icons stay on the two templates that have them, Kelsey's
invented leaf was correctly removed, and Aspen correctly has none. An audit finding is evidence, not
a verdict; this one was checked against the source and did not survive.



### What round 2 found, and what round 3 did about it

The audit's central charge was that every harvested hex was present and three themes assigned them
backwards. That was correct, and it is fixed:

| Theme | The source | What we were doing | Now |
|---|---|---|---|
| **alessia** | `body{color:#9c0a0d}`, `p`, `h2`-`h5` all crimson — no dark ink on the page at all | crimson demoted to an accent; body copy near-black `#2b2320`; the ampersand rendering black | `--ink: #9c0a0d`, `--muted: #8a4a4c` — a desaturated crimson, not a grey |
| **avril** | `body`, `p`, `h4`, `h5` all `#013ab2`; cover is a full-viewport blue field with the names reversed out in white script on one line | ink was already the blue, but secondary text was a neutral grey `#6b6a67`, and the cover was blue-on-cream — the inverse of the source's most recognisable screen | `--muted: #4a5a80`; the cover is now the blue field with white script |
| **kelsey** | `html{background:#7F4928}` with `body{color:#E0D8CB}` — cream on rust for the whole page, and only the cover inverts to tan | the cover's tan was run across the entire document; the rust ground never appeared once | page is rust with cream ink; `.hero` re-binds the tokens to tan-with-rust-ink for the cover alone |

Three cross-cutting findings were also acted on, because each was a house style overriding what six
different sources actually do:

- **Buttons.** Every theme shipped the same solid rectangle. Four of the sources draw an outline
  (`background: none`) and veleyross puts **no filled surface on its page at all**. Fill, radius,
  face and tracking are now `--btn-*` tokens set per theme: outlined for aspen, kelsey and avril, an
  outlined script pill for alessia, an underlined text mark for marry-monday, and a filled rounded
  pill for anvaya — which is the one source that genuinely has one.
- **Radius.** `--radius: 0` was hard-set on all six while avril's buttons are 8px and anvaya's CTA is
  a full pill. Now per source.
- **Label tracking** had been normalised into a 0.14–0.22em band. The sources span **0** (aspen and
  kelsey set `letter-spacing: 0` on literally every rule they write) to **0.41em** (avril's `h3`:
  7px on 17px). Now harvested per source rather than applied as a default.

Two round-2 findings were **defects, not taste**, and are worth naming:

- **Avril's full-bleed attire block was broken.** Bleeding it with a negative inline margin only
  works if the element is centred in the window; `.dresscode` sits inside a schedule item, so its
  `50%` resolved against a narrow ancestor. The block started 20px in, stopped at 67% of the window,
  and collapsed its content column to ~90px — which wrapped the attire note **one word per line**,
  six times down the desktop page.

  The fix moved the paint up a level, which is also the more faithful reading: the source does not
  block the attire panel, it blocks **whole sections** edge to edge in the blue and reverses the
  cream type out of them ("The Weekend", "Travel Tips", "Reply Now"). A top-level section is already
  the full width of the page, so alternate sections simply re-bind the theme tokens — there is no
  bleed to fake, at any breakpoint, and it renders identically on mobile.

  Worth recording because it cost a test: the intermediate fix overshot the bleed and clipped it
  with `overflow-x: clip` on `main`. That passed in Chromium and **failed in WebKit**, where a
  clipped ancestor pulls `position: sticky` off the viewport — the schedule's day headers began
  straddling the viewing bar on iOS. The suite caught it; the approach was wrong, not the value.
- **`app/globals.css` contained ~950 lines of verbatim duplicate.** Two separate blocks of the base
  stylesheet appeared twice. Harmless to look at — the later copy simply won — but it is now 1,322
  lines instead of 2,274.

Two things the audit asked for were **declined, with reasons**:

- **Gold as text on Anvaya.** The source's eyebrow is `#d4af37`, which is **2.00:1** on its cream.
  That is not a near miss on WCAG AA. The eyebrow is set in `#836618` — the same metal, 5.15:1 —
  and `#d4af37` survives as the hairline it can legitimately be.
- **Aspen's button label colour.** The source's is `#978F8B`, 3.17:1 on white and failing at 12px.
  The outline is the source's; the ink is the darker harvested taupe.

### Round 5: the instrument was broken, so the readings were

Round 4's audit found something worth more than its score. **`scripts/harvest.mjs` could not see
`@font-face`.** It swept `font-family:` declarations, and all four Bliss & Bone templates self-host
their faces and then refer to them by name — so the harvest reported this family list for every one
of them:

```
## font-family declarations
  bootstrap-icons
```

Four rounds of typographic decisions were argued from evidence the harvest did not contain. The same
blind spot ran through the colour census: **a frequency count counts declarations, not painted
area**, and cannot tell a foreground from a background. `#e0d8cb x56` looked like Kelsey's dominant
ground. It is its dominant *text* colour. That single misreading inverted a whole theme, in one
direction in round 2, the other direction in round 4.

The harvester now reads `@font-face` blocks, resolves what each structural selector actually
declares, and prints `html { background }` and `body { color }` under a heading that says in as many
words *read these, not the census above*. What it returned changed four decisions:

| | The harvest now says | Which means |
|---|---|---|
| kelsey | `html background: #7F4928` · `body color: #E0D8CB` · `letter-spacing: 0px` | The page **is** the rust. Round 3 had it right and round 4 undid it. Reverted, and the light blocks are now set *into* the rust — which is the direction the source runs — in its three block colours rather than one. Label tracking back to 0. |
| alessia | `body { font: 16px/1.5em "PermanentMarker-Regular"; letter-spacing: 1px }` · faces: `OlivieSans-Regular`, `PermanentMarker-Regular`, `kalinda-script-regular` | The marker **is** the running text. Round 3 made it the display face, round 4 demoted it to captions; both wrong, in opposite directions. It is the body face now, with OlivieSans (→ Montserrat, at the source's `normal` weight, title-case not forced caps) on h1 and h2. |
| avril | faces: `OlivieSans-Regular`, `SaintAmour-Regular`, `Inter-Light` · `.button { letter-spacing: 5px }` | **Three** voices, not two. Round 4 put the script on every heading level and killed the tracked-caps h3 register — 7px on 17px, the widest tracking in the Bliss & Bone set and this template's second-most recognisable feature. Restored, which also revives `--font-alt`, orphaned since round 4. |
| aspen | faces: `Poppins-Light`, `Poppins-ExtraLight` only · `.button { color: #978F8B }` | Confirms the type is right. The button is plain text — `--btn-width: 0` now, since "borderless" had been shipping as a 1px transparent border. |

### Two inventions, removed

Copying stops being copying when it fills a gap with something the source does not contain. Two
things had crept in, both flattering, both fabricated:

- **Alessia's cabana stripe.** `#b53c30` is declared nowhere in the source, whose cover is a
  photograph. An invented pattern standing in for a photograph put the loudest element on the page
  in the one place the template does not have it. The cover is a flat field in the source's own
  crimson now.
- **Kelsey's leaf.** Kelsey and Aspen are the two sources that ship *no* decorative graphics at all
  — their visual interest is photography and colour blocks. Round 4 gave Kelsey a leaf silhouette to
  satisfy "a device per theme". The rule was wrong, so the leaf is gone. Marry Monday's landscape
  and the line icons on Avril and Alessia stay: those sources genuinely load recoloured line-art
  SVGs, five and seven of them respectively.

### And one bug the audit caught that the test suite could not

**Marry Monday's running head was clipped off the left edge of the window at 1440px** — "Friday 26
February" rendering as "riday / ruary". `.shell` is `min(1320px, 94vw)`, leaving 60px of gutter at
that width, and the grid pulls `232px + 3.5rem` into it. The theme's one recognisable structural
device was truncated mid-word at the most common desktop width, and at exactly the width the review
screenshots are captured at. The grid is gated at 1360px now, with the shell capped inside the query
so the pull-left always has room.

### Aspen's stagger, and the thing this project will not copy

Aspen's structure is `.section.stagger_l` / `.stagger_r`: photographs held to alternating edges with
a narrow left-set text column offset against each. It is the only Bliss & Bone layout that breaks
the base sheet's centring, and round 4 had approximated it by staggering the *titles* left and
right over centred body copy — which, with nothing to sit against, reads as a defect rather than a
rhythm. The structure is built properly now, with a flat field in the source's own two block colours
standing where the photograph goes.

That substitution is the one place every theme departs from its source in the same way, so it is
worth stating plainly rather than leaving as an omission: **none of the six copies contains a
photograph, and every one of the six sources is photo-led.** A wedding template that ships with
somebody else's wedding inside it is not a template a couple can use. Drawn ornament and flat colour
fields stand in where a photograph would be. It costs real fidelity — the audit is right that it is
the largest remaining gap, and it hits Aspen and Kelsey hardest — and it is a product decision, not
an oversight.

### Where the loop stopped

Five rounds: **80, 65, 66, 67, and a fifth not yet scored**. The brief set 90 as the target and five
rounds as the ceiling, and the ceiling arrived first.

The honest summary of why: rounds 2 through 4 were scored by auditors that read the sources' own
stylesheets, and the number stayed flat because each round fixed real things while the same
structural charge stood — one component tree rendering six palettes. Round 5 fixed the instrument
that was feeding the loop bad evidence, which is the most useful thing any of the rounds did, and
reverted every invention it found. What remains between here and 90 is not paint: it is six
different component trees and six sets of photographs, and both were weighed and declined for
reasons written above rather than quietly skipped.



---

# Part two: Zola and The Knot

Twelve more themes, copied from the two largest wedding-website platforms. The product teardown —
how their RSVP flows behave and which of their failure modes this design cannot have — is in
[`COMPETITOR-TEARDOWN.md`](./COMPETITOR-TEARDOWN.md). This section is about the copies.

## Why these are copied from better evidence than the first six

Neither platform ships a per-theme stylesheet, and that turns out to help rather than hinder:
**both ship their themes as numbers.**

- **Zola** publishes `public_theme_v2` inside the Next.js payload of every live couple's site. Its
  type scale is per **component** — `COUPLES_NAMES`, `CMS_FAQ`, `HERO_HOME` and six more, each with
  its own size, tracking and case.
- **The Knot** puts its theme in `__NEXT_DATA__` → `weddingWebsiteResult.theme.themeStyles[0].styles`
  and applies it at runtime with styled-components. Its scale is `s1`–`s6`, mapped to elements by
  the renderer (`s1` → couple names, `s3` → sub-headline, `s6` → body, input, button).

So for these twelve there is no measuring off a screenshot and no inference from hex frequency. The
sizes, tracking, case and colours in `app/globals.css` are the platforms' own values. That also
makes the audit sharper: a mismatch is a fact, not an opinion.

Every face The Knot names is already a Google Font, so those six substitute **nothing**. Zola names
four licensed retail faces, each substituted and recorded in `app/layout.tsx` beside the font it
replaces:

| Source face | Where | Substitute |
|---|---|---|
| Circular | Malina, Morrison body | **Jost** |
| Fifty Fifty | Malina display | **Prata** |
| Mrs Eaves Roman Small Caps | Goundry display | **Cormorant SC** — true small caps, which is the point of the original |
| — | Abbey, Morrison, Buxton, Galata | Pinyon Script, Cardo, Libre Baskerville and Cormorant Garamond are Google faces and are used unchanged |

## The audit record

| Round | Overall | Per theme |
|---|---|---|
| 1 | **73** | hollywood 81 · surround 78 · lucky 77 · official 77 · buxton 74 · malina 73 · galata 72 · morrison 69 · goundry 69 · abbey 69 · marrakesh 69 · industrial 64 |
| 2 | **82** | hollywood 88 · lucky 88 · marrakesh 88 · industrial 87 · official 85 · morrison 76 · goundry 78 · buxton 77 · galata 82 · abbey 82 · malina 80 · surround 68 |
| 3 | **84** | surround 91 · hollywood 89 · industrial 88 · lucky 87 · marrakesh 86 · morrison 85 · galata 84 · malina 83 · abbey 83 · goundry 81 · official 79 · buxton 74 |
| 4 | *findings acted on; score not captured* | The agent returned its findings and ranking but not its JSON block, and could not be resumed to retrieve it. Recorded as a gap rather than filled with a number |
| 5 | **87** | industrial 90 · hollywood 90 · morrison 89 · goundry 88 · galata 88 · lucky 88 · buxton 87 · surround 87 · malina 86 · abbey 86 · marrakesh 86 · official 80 |

**The loop stopped here** — five rounds, as set. Final: **73 → 82 → 84 → (—) → 87**.

### What round 5 found, and what was fixed after it

Four of its findings were defects rather than matters of taste, and all four are fixed:

- **`s2` and `s4` name a different family from `s1`** on four of six Knot themes — the section head
  and the item are set in the BODY face. Marrakesh had been setting its section heads in a
  handwriting script at 42px caps, which its source never does anywhere. Sizes cannot compensate
  for a wrong family.
- **`--faq-size` was still pointed at `s3`**, contradicting the rule written the round before to
  point it at `s2`. Writing a rule and not applying it to the one component it was written for.
- **The mobile floor multipliers were ordered backwards** — 0.58 / 0.6 / 0.66 for section / event /
  item — which inverted the ladder at 390px on the three themes whose components are all one size,
  and pushed the day header *below the body copy it heads* on five others. That is the only defect
  in the set a guest would read as broken rather than as different.
- **Officially Official's hero decoration was invented.** The ghosted `OFFICIAL` wordmark and the
  script overlay came from the template's *name*, not from any token — the source's `images.top` is
  a PNG — and they collided with the date line and the names. Deleted. An invented mark that
  damages legibility is worse than an absent one.

### And a factual error in the brief itself

Round 5 caught something worth more than its score: the constraint I had been stating to every
auditor — *"the tokens carry no mobile size step"* — is **false for The Knot**. Five of its six
themes declare `calc(X * 0.85)` steps on `s3`–`s6`, and Lucky's `s1` declares a size step as well as
a tracking one. It is true only of the Zola six and of Elegant Industrial.

That is not a fidelity miss, it is a wrong premise that was being handed to the audit as ground
truth, and it means the copies do the inverse of what those tokens say — shrinking display type by
roughly half on a phone while holding body flat. It is recorded here rather than quietly corrected
because the brief was mine.

### What is left, and why it is left

`.SiteTitle { padding-top }` is the one explicit layout token The Knot ships, and it ranges from
40px (Surround) to 340px (Officially Official) — collapsing it into one shared clamp erases the
difference between a tight hero and a cathedral of space. Implementing the Knot mobile steps, and
honouring that padding, is the clearest remaining path to 90. Both were within reach and neither was
done inside five rounds; that is the honest position rather than a claim that the gap is
unreachable.

### What each round actually bought

Almost every point in this loop has come from **deleting something invented**, not from adding
design. The audits keep returning the same shape of finding, because the tokens make it checkable:

| Invented | What the token said |
|---|---|
| `body { font-size: 17px }` on all twelve | 16px on six Zola themes, 15px on Officially Official, 14px on Elegant Industrial, 17px on Surround alone |
| `.label { font-size: 11px }` — and 10.5px under 560px | Zola's smallest stated step is **16px**; The Knot's `tiny` is 12px, 13px on Marrakesh, 14px on Surround |
| A 700-weight uppercase button on all twelve, then a 400-weight sentence-case one | Zola's `BUTTON .body` is 16px/400/none/0; The Knot's dedicated `.Button` is uppercase/2px/700 (600 on Surround and Industrial) |
| `.faq-q` at 23.2px, then at `--faq-size × 0.72` | Its own `CMS_FAQ` component — 30px on Malina, **64px** on Goundry against a 48px `CMS_ENTITY` |
| Sub-headings at `--section-size × 0.86` in the BODY face | The heading face at the token size, on ten of twelve themes |
| `--section-tracking` derived once from the names as an em value | Both platforms hold tracking constant in **pixels** across the whole scale |

### The three regressions, which were one mistake in three costumes

Each was honouring a number without checking what it governs:

- **Buxton's 56px date.** `COUPLES_NAMES .body` really is 56px — applied to the source's short date
  string. Ours is "SATURDAY, FEBRUARY TWENTY SEVENTH TWO THOUSAND TWENTY SEVEN", written longhand
  because that is the convention copied from Bliss & Bone. At 56px it wrapped to five lines, became
  the largest mass on the fold, and pushed the names below it — inverting the template's hierarchy
  in order to match one value.
- **The Knot's buttons read from `s6`.** `s6` exists and governs body, input and button *text* — but
  the platform ships a dedicated `.Button` block that overrides it. Round 2's shared uppercase
  button had been accidentally right; round 3 "corrected" it to something explicitly contradicted.
- **Abbey's Title Case CTA.** `capitalize` belongs to `BUTTON .heading`. The label is `BUTTON .body`,
  which states `none`.

### What round 1 found

The palette work held up — eleven of twelve grounds and inks were the harvested hex exactly, both
accent-is-not-ink cases (Galata, Industrial) were preserved, and the single-ink discipline of Lucky
and Goundry was respected rather than prettified. Couple-name metrics were near-exact in ten of
twelve.

Everything below the names was wrong, and in four systemic ways:

- **A house body scale overwrote eleven of twelve harvested values.** `body { font-size: 17px }`,
  with the comment "body text under 16px reads as cheap", silently replaced the number each source
  states. Worst on Officially Official (15px) and Elegant Industrial (14px), where the small body
  *is* the design.
- **`.section-title` had no per-theme value for five of the six Knot themes**, so it fell through to
  `.display-lg` — 60px, against tokens of 28–40px. In Lucky Circle the section heads came out the
  same size as the couple names, which flattens the hierarchy entirely.
- **Tracking was authored in ems.** Both platforms hold letter-spacing constant in **pixels** across
  the whole scale: Malina sets 3px at 85px, at 45px, at 30px and at 25px alike. One em value derived
  from the names and inherited everywhere is wrong at every other size by the ratio between them —
  Malina's section heads came out 2.9× too tight.
- **Five buttons contradicted their own tokens.** Four Zola themes shipped a transparent outline
  where all four harvested renders show a solid filled rectangle, and Industrial shipped an outline
  where `.Button { background-color: #9b5a44 }` was quoted verbatim in the comment two lines above
  the value.

Two more that were mine rather than systemic: **Galata's band panes are 33/55/12**, not three equal
thirds — the seams measure at 33.3% and 88.1% — and **all four Zola bands were painted 2–6% off
their own ground** (in Morrison's case `#ffffff` on `#ffffff`, which is to say not painted at all)
at a height that filled the entire fold. The first screen of four themes was a blank rectangle with
the names pushed below it.

### The design-level miss

These twelve were built on the premise that The Knot's templates *have no structure to copy* — that
they are one centred document differing only in type and colour. Their own theme objects say
otherwise. Every one of the six carries a `styles.images.top` (Hollywood and Industrial carry a
`.bottom` too), and those assets are **flat vector or type art, not photography**:

| Theme | What the asset is |
|---|---|
| Marrakesh Tile | a Moroccan tile border band with a scalloped lower edge |
| Vintage Hollywood | a gold art-deco stepped-corner frame |
| Elegant Industrial | rust brush bands, top and bottom |
| Officially Official | an enormous ghosted `OFFICIAL` in condensed caps with a red script *officially* over it |
| Surround | a 190×190 double-line oval drawn around the ampersand |
| Lucky Circle | a circle |

**Three of those themes are named for the asset that was missing.** The no-photograph constraint
never covered any of it — none is a photograph — so leaving them out was a real fidelity cost rather
than a stated compromise. All six are drawn now, in flat strokes and fills, along with Goundry's
flanking botanical stems and a denser, filled version of Buxton's greenery arch, which had been four
hairline arcs standing in for a watercolour mass.

### The one departure that stands

Officially Official states 15px body and Elegant Industrial 14px. Both are held at **16px**. iOS
Safari zooms the page when a focused input is under 16px, and this project's own NF4 records that
wedding guest lists skew elderly. Industrial's *case* and *weight* — `uppercase`, 500 — are the
source's, because those carry the voice; only the size is held. `design-integrity.spec.ts` enforces
the floor so it cannot quietly drift back.
