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
  story?: 'stack' | 'panels' | 'timeline';
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
  party?: 'grid' | 'list' | 'rows' | 'bands';
  /**
   * How the prose sections — travel, things to do, gifts — are laid out.
   *
   * These four sections are between 30% and 57% of the scrolled length of every document here, and
   * until now all seven templates rendered them as one identical single-track grid of centred
   * blocks. A guest who scrolled past the schedule saw the same page whichever template they were
   * looking at, which is most of the page.
   */
  blocks: 'stack' | 'twoUp' | 'tiles' | 'spine' | 'banded' | 'framed' | 'gutter';
  /**
   * How the FAQ is set. Same reasoning as `blocks`: it was one `display:block` list in all seven.
   *   rows     question and answer stacked, a rule between
   *   gutter   question in its own left column, answer beside it
   *   twoUp    two columns of questions
   *   inline   question and answer share a line
   *   numbered a counter down the left, answers indented from it
   *   panels   each question a bordered panel
   *   ledger   uniform rows, question right-set against the answer
   */
  faq: 'rows' | 'gutter' | 'twoUp' | 'inline' | 'numbered' | 'panels' | 'ledger';
  /**
   * Which sections are painted on the theme's deep ground.
   *
   * This used to be `main > section.section:nth-of-type(even)` in the theme layer — a DOM index,
   * counting the splash and the hero. So the single largest surface on the page was decided by how
   * many sections a template happened to carry, not by any decision a template made: delete a
   * welcome note and classic's schedule flipped from cream to maroon. Two templates with the same
   * section count got the same banding for free, and that banding is the first thing anyone sees.
   *
   * Naming the sections instead makes the rhythm the template's own and makes it stable — removing
   * a section above the schedule no longer repaints the schedule.
   */
  band: SectionId[];
  /**
   * Section headings, where this template names a section differently.
   *
   * Not decoration. Every one of the seven used to print the same eight headings in the same order,
   * so the words on the page carried no information about which structure you were reading. The
   * real builders do vary this — Zola's default is "Schedule", The Knot's is "Wedding Events", Joy
   * ships "Itinerary" — and the heading is the one part of a section a guest actually reads.
   */
  copy?: Partial<Record<SectionId, string>>;
  /** Nav labels, where this template shortens or renames them. */
  navCopy?: Partial<Record<SectionId, string>>;
  /**
   * The label on the reply button.
   *
   * All seven said "Reply to your invitation" in the same words. A stationery card and a timeline
   * do not ask the same way, and this is the single most-pressed control on the page.
   */
  cta?: { identified: string; anonymous: string };
  /**
   * How the closing footer is set.
   *
   * Round 6: "seven identical 283px footers under seven different documents is the single largest
   * shared surface left". It was one `.site-footer` with one `display:block` and one `text-align`
   * in all seven, sitting under structures that agree about nothing else.
   *   centred   names over contact, centred — the plain one
   *   split     names left, contact right, across a rule
   *   rail      a left label column against the contact, matching the section rows
   *   plate     boxed and ruled, the way the card sets everything
   *   ledger    hairline rows, right-set label
   *   spine     hung off the same rule the schedule runs down
   *   panel     inset to the panel's own width rather than the window's
   */
  footer: 'centred' | 'split' | 'rail' | 'plate' | 'ledger' | 'spine' | 'panel';
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
    // The quietest rhythm in the set: two bands late in the document and nothing else, so classic
    // reads as one long unbroken scroll the way Zola's default site does.
    //
    // Not zero bands, which was the first attempt. Several of the eighteen themes are identified BY
    // their banding — kelsey is a rust page with light blocks set into it, and with no bands to set
    // them into it stopped being kelsey — and classic is the default template, so a theme that
    // cannot show itself on classic cannot show itself at all.
    band: ['travel', 'things'],
    blocks: 'stack',
    faq: 'rows',
    copy: {
      welcome: 'A note from us',
      schedule: 'The weekend, hour by hour',
      gifts: 'On the subject of gifts',
    },
    cta: { identified: 'Reply to your invitation', anonymous: 'Open your invitation' },
    footer: 'centred',
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
    // Full-width rows with the role held in the same left column the travel blocks use. `grid` was
    // shared with classic — same registry value, same class, same CSS, and at 390px both resolved
    // to a single track, which is not a grid at all.
    party: 'rows',
    numbered: false,
    // Eternity's whole idea: alternate sections tinted so the bands read as separate. Pinned to
    // the sections themselves rather than to their position, so it is still a band rhythm when an
    // owner has no story to tell.
    band: ['story', 'party', 'faq'],
    blocks: 'banded',
    faq: 'gutter',
    copy: {
      welcome: 'Welcome',
      story: 'Our story',
      schedule: 'The celebration',
      party: 'The wedding party',
      travel: 'Travel and stay',
      faq: 'Good to know',
      gifts: 'The registry',
    },
    navCopy: { welcome: 'Home', faq: 'Good to know', gifts: 'Registry' },
    cta: { identified: 'Send your reply', anonymous: 'Find your invitation' },
    footer: 'rail',
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
    // One deep section only, and it is the schedule — the spine runs down a dark field and the
    // rest of the document stays light, so the eye goes to the sequence.
    band: ['schedule'],
    blocks: 'spine',
    faq: 'numbered',
    copy: {
      welcome: 'Before anything else',
      schedule: 'The order of the days',
      travel: 'Getting to us',
      things: 'If you have an afternoon spare',
      faq: 'Asked and answered',
      gifts: 'Last of all, the registry',
    },
    navCopy: { schedule: 'The days', things: 'Spare time', faq: 'Answers' },
    cta: { identified: 'Take me to my reply', anonymous: 'Find your invitation' },
    footer: 'spine',
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
    band: ['welcome', 'party', 'gifts'],
    blocks: 'twoUp',
    faq: 'twoUp',
    copy: {
      welcome: 'A note',
      schedule: 'When and where',
      party: 'Standing with us',
      travel: 'Arriving, and staying',
      faq: 'Questions',
      gifts: 'A registry, if you would like one',
    },
    navCopy: { schedule: 'When', travel: 'Arriving' },
    cta: { identified: 'Your reply', anonymous: 'Your invitation' },
    footer: 'split',
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
    band: ['welcome', 'faq'],
    blocks: 'framed',
    faq: 'inline',
    // Stationery copy: short, formal, and set the way an invitation card sets it.
    copy: {
      welcome: 'With pleasure',
      schedule: 'The order of the day',
      travel: 'Travel',
      faq: 'Particulars',
      gifts: 'With regard to gifts',
    },
    cta: { identified: 'Kindly reply', anonymous: 'Kindly find your invitation' },
    footer: 'plate',
  },
  {
    id: 'boxed',
    name: 'Boxed panel',
    sourceName: 'Aimer — Dotrex',
    source: 'https://dotrex.co/theme-preview/aimer-wedding/',
    provenance: 'ThemeForest 4.53 out of 5 from 17 reviews, 543 sales',
    blurb:
      'A bordered panel that scrolls over a ground held still behind it, opening on a numbered contents page, with everything inside it set as bordered tiles — the story, the events, the travel notes and the questions — so the document reads as a set of pages rather than one run.',
    mood: 'Layered, tiled, page-like',
    order: ['welcome', 'story', 'schedule', 'party', 'travel', 'things', 'faq', 'gifts'],
    nav: 'anchors',
    cover: true,
    schedule: 'cards',
    story: 'panels',
    party: 'bands',
    numbered: false,
    band: ['story', 'travel', 'faq'],
    blocks: 'tiles',
    faq: 'panels',
    copy: {
      welcome: 'Read this first',
      story: 'The long version',
      schedule: 'Every event',
      party: 'Who is standing where',
      travel: 'Beds, roads and airports',
      things: 'An afternoon to fill',
      faq: 'Everything else',
      gifts: 'If you were going to ask about gifts',
    },
    navCopy: { welcome: 'Start', story: 'Story', travel: 'Beds and roads', faq: 'Everything else' },
    cta: { identified: 'Open your reply', anonymous: 'Open your invitation' },
    footer: 'panel',
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
    // The whole document sits on the deep ground. Nothing is withheld once you are past the gate,
    // but nothing is bright either — it reads as one continuous dark card.
    band: ['schedule', 'travel', 'faq', 'gifts'],
    blocks: 'gutter',
    faq: 'ledger',
    copy: {
      schedule: 'The details',
      travel: 'Getting there',
      faq: 'If you are wondering',
      gifts: 'No gifts, but if you insist',
    },
    cta: { identified: 'Reply', anonymous: 'Open' },
    footer: 'ledger',
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
