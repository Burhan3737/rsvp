/**
 * Theme registry.
 *
 * Every theme is a copy of a specific, live, publicly-reviewed template. Not "inspired by" — copied:
 * same palette (harvested from that site's own CSS), same type system, same layout signature.
 *
 * `source` is a URL you can open right now. `provenance` is why that template was worth copying.
 * Full detail, including the harvested colour counts, is in docs/TEMPLATE-SOURCES.md.
 */

export interface Theme {
  id: string;
  name: string;
  /** The template this is copied from. */
  sourceName: string;
  /** Live, reachable, verified 200. */
  source: string;
  /** Why this template — rating, sales, award. */
  provenance: string;
  blurb: string;
  mood: string;
  /** Swatches for the picker: [ground, ink, accent]. */
  preview: [string, string, string];
  dark: boolean;
}

export const THEMES: Theme[] = [
  {
    id: 'marry-monday',
    name: 'Marry Monday',
    sourceName: 'Veley + Ross',
    source: 'https://veleyross.wedding/',
    provenance: 'Awwwards Site of the Day',
    blurb:
      'The date set as outlined numerals spanning the whole window, navigation running vertically up the left margin, and a second bar pinned to the bottom of the screen as well as the top. Nothing on the page is filled with colour.',
    mood: 'Editorial, type-led, confident',
    preview: ['#f3f2f1', '#284135', '#284135'],
    dark: false,
  },
  {
    id: 'alessia',
    name: 'Alessia',
    sourceName: 'Alessia — Bliss & Bone',
    source: 'https://myblissandbone.com/alessia',
    provenance: 'Bliss & Bone published template',
    blurb:
      'Crimson on warm cream, and the crimson is the ink itself — the source sets every word on the page in it. Its running text is a marker pen, which is what makes it the least precious thing here.',
    mood: 'Maximalist, playful, hand-drawn',
    preview: ['#fffaf1', '#9c0a0d', '#ffd8c7'],
    dark: false,
  },
  {
    id: 'avril',
    name: 'Avril',
    sourceName: 'Avril — Bliss & Bone',
    source: 'https://myblissandbone.com/avril',
    provenance: 'Bliss & Bone published template',
    blurb:
      'Electric blue on cream, in three voices: a formal script for the names and section titles, caps tracked to seven pixels for the event names, and a light grotesque underneath. Whole sections block edge to edge in the blue.',
    mood: 'Bold, modern, colour-blocked',
    preview: ['#fffaf1', '#013ab2', '#013ab2'],
    dark: false,
  },
  {
    id: 'aspen',
    name: 'Aspen',
    sourceName: 'Aspen — Bliss & Bone',
    source: 'https://myblissandbone.com/aspen',
    provenance: 'Bliss & Bone published template',
    blurb:
      'Taupe on white in a single extra-light sans, with no serif anywhere on the page. Opens on a full screen carrying only the names, then staggers colour fields left and right down the page.',
    mood: 'Minimal, quiet, sans-only',
    preview: ['#ffffff', '#595141', '#978f8b'],
    dark: false,
  },
  {
    id: 'kelsey',
    name: 'Kelsey',
    sourceName: 'Kelsey — Bliss & Bone',
    source: 'https://myblissandbone.com/kelsey',
    provenance: 'Bliss & Bone published template',
    blurb:
      'A rust-brown page with tan type on it — inverted from every other wedding site, where the paper is pale and the ink is dark. Light blocks are set into the rust as the page goes down. One typeface throughout.',
    mood: 'Warm, earthy, inverted',
    preview: ['#7f4928', '#e0d8cb', '#c8a99a'],
    dark: false,
  },
  {
    id: 'anvaya',
    name: 'Anvaya',
    sourceName: 'Anvaya',
    source: 'https://anvaya.love/',
    provenance: 'Purpose-built for South Asian multi-event weddings',
    blurb:
      'Oxblood and gold on cream, with a second script loaded beside the Latin one so the names can be set in both. Sections block edge to edge in the oxblood, where the gold can finally be gold.',
    mood: 'Ornamental, ceremonial, multi-day',
    preview: ['#fbf9f5', '#570013', '#d4af37'],
    dark: false,
  },

  /* ---------------------------------------------------------------- Zola
     Zola publishes its theme tokens in `public_theme_v2` inside every live
     couple's site, so these six are copied from Zola's own values rather than
     measured off a screenshot. `source` is the published site each was taken
     from — a real wedding, publicly reachable. */
  {
    id: 'malina',
    name: 'Malina',
    sourceName: 'Malina (Black) — Zola',
    source: 'https://www.zola.com/wedding/latoyaandtyran2018',
    provenance: "Zola template, harvested from a live published site's own theme tokens",
    blurb:
      'Near-black, with warm cream type set in caps and tracked wide, over a painterly floral. The only genuinely dark design here, and Zola sets its names at 85px with the leading left loose at 1.6.',
    mood: 'Dark, dramatic, art-led',
    preview: ['#131313', '#f5efe8', '#b9aca2'],
    dark: true,
  },
  {
    id: 'morrison',
    name: 'Morrison',
    sourceName: 'Morrison — Zola',
    source: 'https://www.zola.com/wedding/jamesandtorrie2022',
    provenance: "Zola template, harvested from a live published site's own theme tokens",
    blurb:
      'A white column floating on a grey page — the whole invitation sits inside an 850px card with a hairline around it. Cardo over a geometric sans, near-black on near-white.',
    mood: 'Editorial, monochrome, boxed',
    preview: ['#f8f8f8', '#141414', '#141414'],
    dark: false,
  },
  {
    id: 'goundry',
    name: 'Goundry',
    sourceName: 'Goundry (Dusty Rose) — Zola',
    source: 'https://www.zola.com/wedding/lucy-gavin',
    provenance: "Zola template, harvested from a live published site's own theme tokens",
    blurb:
      'A dusty rose ground with deep plum type in true small caps. The only mid-tone coloured paper in the set — everything else is pale, dark, or a single strong hue.',
    mood: 'Romantic, tonal, small-caps',
    preview: ['#bd989f', '#49323c', '#49323c'],
    dark: false,
  },
  {
    id: 'buxton',
    name: 'Buxton',
    sourceName: 'Buxton (Light Tan) — Zola',
    source: 'https://www.zola.com/wedding/winsteadgalindowedding',
    provenance: "Zola template, harvested from a live published site's own theme tokens",
    blurb:
      'Navy-slate on light tan, one typeface throughout, names in caps with five pixels of tracking. Its original carries no photography at all — the artwork is a greenery arch across the top corners.',
    mood: 'Traditional, botanical, quiet',
    preview: ['#e2ddd7', '#364153', '#364153'],
    dark: false,
  },
  {
    id: 'galata',
    name: 'Galata',
    sourceName: 'Galata — Zola',
    source: 'https://www.zola.com/wedding/langponcerwedding',
    provenance: "Zola template, harvested from a live published site's own theme tokens",
    blurb:
      'Black on white with a slate-teal accent — the one Zola template whose accent is a different colour from its ink. A band of three equal panes sits above the names.',
    mood: 'Crisp, modern, three-up',
    preview: ['#ffffff', '#000000', '#546e6f'],
    dark: false,
  },
  {
    id: 'abbey',
    name: 'Abbey',
    sourceName: 'Abbey — Zola',
    source: 'https://www.zola.com/wedding/blakeandhannahmay23',
    provenance: "Zola's own 'classic design', and its most-chosen template",
    blurb:
      'Grey on warm white with the names in a fine engraved script. Zola calls this its classic design, and it is the most conventional thing in the set — which is the point, because it is what most couples actually choose.',
    mood: 'Classic, engraved, restrained',
    preview: ['#f7f5f2', '#4e4e4e', '#8a8378'],
    dark: false,
  },

  /* ------------------------------------------------------------- The Knot
     The Knot ships no per-theme stylesheet at all: a theme is a JSON token
     object in the page payload, applied at runtime. These six are copied from
     those tokens, taken off a live published wedding site. Every face they name
     is already a Google Font, so unlike the others nothing is substituted. */
  {
    id: 'hollywood',
    name: 'Vintage Hollywood',
    sourceName: 'Vintage Hollywood (Black) — The Knot',
    source: 'https://www.theknot.com/us/breana-knapp-and-ethan-wright-apr-2019?themeId=4642',
    provenance: "The Knot template, copied from the live site's own theme tokens",
    blurb:
      'Gold type on near-black, tracked to six pixels and set in caps, inside a gold hairline frame. Gold is the ink here rather than an ornament — which it can only be on a ground this dark.',
    mood: 'Deco, gilded, theatrical',
    preview: ['#231f20', '#e9b970', '#e9b970'],
    dark: true,
  },
  {
    id: 'lucky',
    name: 'Lucky Circle',
    sourceName: 'Lucky Circle (Red) — The Knot',
    source: 'https://www.theknot.com/wedding-website/templates',
    provenance: "The Knot template, copied from the live site's own theme tokens",
    blurb:
      'A saturated red page with everything reversed out of it in white. Not a red accent on pale paper — the paper itself is red, which nothing else here attempts.',
    mood: 'Loud, saturated, celebratory',
    preview: ['#d82b45', '#ffffff', '#ffffff'],
    dark: true,
  },
  {
    id: 'surround',
    name: 'Surround',
    sourceName: 'Surround (Yellow) — The Knot',
    source: 'https://www.theknot.com/wedding-website/templates',
    provenance: "The Knot template, copied from the live site's own theme tokens",
    blurb:
      'Warm brown on an ochre ground, in three typefaces where most of these use two — a light serif for the names, a tracked sans for the sub-headings, and a book serif underneath.',
    mood: 'Golden, warm, three-voiced',
    preview: ['#dcba6a', '#67471e', '#67471e'],
    dark: false,
  },
  {
    id: 'marrakesh',
    name: 'Marrakesh Tile',
    sourceName: 'Marrakesh Tile (Teal) — The Knot',
    source: 'https://www.theknot.com/wedding-website/templates',
    provenance: "The Knot template, copied from the live site's own theme tokens",
    blurb:
      'Teal on white, names in a fine handwriting face at sixty-five pixels, and sub-headings set in lowercase — the only template of the eighteen that does that.',
    mood: 'Handwritten, airy, lowercase',
    preview: ['#ffffff', '#2d808b', '#2d808b'],
    dark: false,
  },
  {
    id: 'official',
    name: 'Officially Official',
    sourceName: 'Officially Official (Cream) — The Knot',
    source: 'https://www.theknot.com/wedding-website/templates',
    provenance: "The Knot template, copied from the live site's own theme tokens",
    blurb:
      'Red on apricot, a condensed caps display tracked to eight pixels, and a monospace for everything else. The only monospaced design in the set, from any of the three sources.',
    mood: 'Typewritten, graphic, official',
    preview: ['#fae2c3', '#c42412', '#c42412'],
    dark: false,
  },
  {
    id: 'industrial',
    name: 'Elegant Industrial',
    sourceName: 'Elegant Industrial — The Knot',
    source: 'https://www.theknot.com/wedding-website/templates',
    provenance: "The Knot template, copied from the live site's own theme tokens",
    blurb:
      'An extra-condensed caps display over a grotesque, grey-green on warm white, with a rust accent that is deliberately not the ink — one of only two designs here whose accent colour stands apart.',
    mood: 'Condensed, utilitarian, rust-accented',
    preview: ['#f7f6f4', '#595c58', '#9b5a44'],
    dark: false,
  },
];

export const DEFAULT_THEME = 'anvaya';

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!;
}

export function isValidTheme(id: string): boolean {
  return THEMES.some((t) => t.id === id);
}
