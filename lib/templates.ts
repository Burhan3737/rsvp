/**
 * Template registry.
 *
 * A THEME is paint — palette and type. A TEMPLATE is structure: which sections appear, in what
 * order, and how each one is presented. They are independent axes, so the same palette can arrive
 * as a long editorial scroll or as a single invitation card, and every theme can wear every
 * template.
 *
 * That separation exists because of a specific criticism. Eighteen themes were built first, and
 * three rounds of blind audit returned the same verdict: "one skeleton, six paint jobs". Every
 * theme rendered the identical page — hero, welcome, schedule, travel, FAQ, gifts, one centred
 * column — and only the colours moved. Recolouring one structure does not produce variety.
 *
 * Section vocabulary is taken from what the real builders actually offer. Zola ships a closed
 * nine-page enum and refuses custom pages outright; The Knot composes pages out of eighteen typed
 * items. Both break the couple's story into named beats rather than one prose block, and both key
 * a wedding party member off a role.
 *
 * The strongest evidence that this axis is the right one: EVERY platform surveyed ships a
 * single-page/multi-page switch of its own — Zola `layout_type`, The Knot "Layout", Minted
 * `page_configuration`, Appy Couple `layout`, Bliss & Bone's `singlePage`/`coverpage` header
 * classes. And Zola's is independent of design: `galata`, `cooper` and `stevens` each appear under
 * both MULTI_PAGE and SINGLE_PAGE. Structure and paint are separate choices in the products
 * themselves, not only here.
 */

/** The sections a template may order. Not every template uses every one. */
export type SectionId =
  | 'welcome'
  | 'story'
  | 'schedule'
  | 'party'
  | 'travel'
  | 'things'
  | 'faq'
  | 'gifts';

export interface Template {
  id: string;
  name: string;
  /** What this structure is copied from. */
  sourceName: string;
  source: string;
  provenance: string;
  blurb: string;
  /** One line an owner can pick from. */
  mood: string;

  /** Section order. The hero is always first and the footer always last. */
  order: SectionId[];

  /** Fixed anchor navigation, a rotated edge rail, or nothing. */
  nav: 'none' | 'anchors' | 'rail';
  /**
   * A full-viewport cover before the page begins. Read by the renderer, which is what makes the
   * gate variant carry the date and both links rather than names alone.
   */
  cover: boolean;
  /**
   * How the schedule — the densest thing on any wedding site — is laid out.
   *
   * WithJoy is the only builder that ships NAMED presentation variants for a section, and it ships
   * five for exactly this one: Classic ("simple columns for each day"), Timeline ("arranged along a
   * vertical line with dot markers"), Centered, Compact ("collapsed by default, guests tap to
   * expand") and Cards ("each event gets its own contained tile"). That is the precedent for
   * treating schedule layout as a first-class choice rather than a side effect of the theme.
   */
  schedule: 'list' | 'timeline' | 'cards' | 'columns' | 'agenda' | 'ledger' | 'banded';
  /**
   * How the story beats are laid out, for the templates that carry them. `stack` is the plain
   * default; `alternating` sets each beat against the one before it; `timeline` hangs them off a
   * centre rule. Only meaningful when `order` includes `story`.
   */
  story?: 'stack' | 'alternating' | 'timeline';
  /** Section numbering (01, 02, 03) in the eyebrow. */
  numbered: boolean;
  /**
   * How the wedding party is presented, for the templates that carry one. Two genuinely different
   * treatments exist in the wild: a grid of portraits (Zola, WithJoy, Minted, Appy Couple) and one
   * member per full alternating band (Bliss & Bone's `lara`).
   *
   * Only meaningful when `order` includes `party` — a value on a template that never renders the
   * section is configuration that cannot be observed, which is the pattern three audit rounds have
   * scored this project down for.
   */
  party?: 'grid' | 'list' | 'bands';
}

export const TEMPLATES: Template[] = [
  {
    id: 'classic',
    name: 'Classic scroll',
    sourceName: 'Zola — default wedding site',
    source: 'https://www.zola.com/wedding-planning/website',
    provenance: 'The order Zola ships by default, and what most published wedding sites use',
    blurb:
      'One long scroll, everything centred, the schedule as a plain list under sticky day headers. The order Zola gives a new site: a welcome, then where to be, then how to get there, then the questions.',
    mood: 'Familiar, straightforward, no surprises',
    // Zola's canonical order, confirmed in 116 of the 151 sampled sites that enable every page
    // (77%): Home, Schedule, Travel, Registry, Wedding Party, Gallery, Things To Do, FAQs, RSVP.
    order: ['welcome', 'schedule', 'travel', 'gifts', 'party', 'things', 'faq'],
    nav: 'none',
    cover: false,
    schedule: 'list',
    party: 'grid',
    numbered: true,
  },
  {
    id: 'rail',
    name: 'Side rail',
    sourceName: 'Eternity — ThemeChills',
    source: 'https://themechills.com/preview/html/eternity/',
    provenance: 'ThemeForest 4.92 out of 5 from 38 reviews, 851 sales — the best-rated wedding HTML template',
    blurb:
      'A monogram and a list of sections pinned down the left quarter of the screen, never scrolling away, with the content in the remaining three quarters and alternate sections tinted so the bands read as separate.',
    mood: 'Navigable, banded, always oriented',
    order: ['welcome', 'story', 'schedule', 'party', 'travel', 'faq', 'gifts'],
    nav: 'rail',
    cover: false,
    schedule: 'banded',
    story: 'stack',
    party: 'grid',
    numbered: false,
  },
  {
    id: 'timeline',
    name: 'Timeline',
    sourceName: 'Lovebirds, The Aisle and Forever',
    source: 'https://lithemes.com/lovebirds/vertical-menu/index.html',
    provenance:
      'Three independent top sellers converged on it — Forever (2K sales, 4.67 out of 5), The Aisle (2.8K sales), Lovebirds (4.29 out of 5)',
    blurb:
      'A rule down the centre of the page with a node on it for every event, cards alternating left and right, staggered so the two columns interleave rather than pair up. Built for a wedding that runs for days.',
    mood: 'Sequential, multi-day, at a glance',
    order: ['welcome', 'story', 'schedule', 'travel', 'things', 'faq', 'gifts'],
    nav: 'anchors',
    cover: false,
    schedule: 'timeline',
    story: 'timeline',
    numbered: false,
  },
  {
    id: 'split',
    name: 'Split screen',
    sourceName: 'The Aisle — invitation split',
    source: 'https://theaisle.qodeinteractive.com/invitation-split/',
    provenance: 'ThemeForest 2.8K sales, 4.13 out of 5 from 31 reviews — the most-sold wedding theme inspected',
    blurb:
      'The page divides down the middle and content arrives in pairs — the event on one side, its time and place on the other — inside a deep inset frame. Nothing is centred.',
    mood: 'Paired, framed, deliberate',
    order: ['welcome', 'schedule', 'party', 'travel', 'faq', 'gifts'],
    nav: 'none',
    cover: true,
    schedule: 'columns',
    party: 'list',
    numbered: true,
  },
  {
    id: 'card',
    name: 'Invitation card',
    sourceName: 'Batik — Indonez',
    source: 'https://www.indonez.com/html-demo/batik/v1/',
    provenance: 'ThemeForest 54 reviews — the most-reviewed wedding template in the category, 494 sales',
    blurb:
      'A single card on a patterned ground, the way printed stationery is set. Nothing bleeds off it and nothing runs wider than the card, so every section has to be said briefly.',
    mood: 'Formal, contained, stationery',
    order: ['welcome', 'schedule', 'travel', 'faq', 'gifts'],
    nav: 'none',
    cover: true,
    schedule: 'agenda',
    numbered: false,
  },
  {
    id: 'boxed',
    name: 'Boxed panel',
    sourceName: 'Aimer — Dotrex',
    source: 'https://dotrex.co/theme-preview/aimer-wedding/',
    provenance: 'ThemeForest 4.53 out of 5 from 17 reviews, 543 sales',
    blurb:
      'A bordered panel that scrolls over a ground held still behind it, with each section given a screen of its own and a stacked numbered index down the inside of the panel, so the document reads as a set of pages rather than one run.',
    mood: 'Layered, sectioned, page-like',
    order: ['welcome', 'story', 'schedule', 'party', 'travel', 'things', 'faq', 'gifts'],
    nav: 'anchors',
    cover: true,
    schedule: 'cards',
    story: 'alternating',
    party: 'bands',
    numbered: false,
  },
  {
    id: 'gate',
    name: 'Cover gate',
    sourceName: 'Neela — invite build',
    source: 'https://www.wiselythemes.com/html/neela/index-invite.html',
    provenance:
      'ThemeForest 5.0 out of 5, 706 sales; the same model as veleyross.wedding, an Awwwards Site of the Day scoring 8.00',
    blurb:
      'The first screen is the names, the date, and two links — the details, and the reply. Everything else waits below. The least a wedding site can show and still be one.',
    mood: 'Withheld, minimal, two doors',
    order: ['schedule', 'travel', 'faq', 'gifts'],
    nav: 'none',
    cover: true,
    schedule: 'ledger',
    numbered: false,
  },
];

export const DEFAULT_TEMPLATE = 'classic';

export function getTemplate(id: string | null | undefined): Template {
  return (
    TEMPLATES.find((t) => t.id === id) ?? TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE)!
  );
}

export function isValidTemplate(id: string): boolean {
  return TEMPLATES.some((t) => t.id === id);
}
