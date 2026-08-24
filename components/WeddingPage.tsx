import type { ContentBlock, EventRow, Settings } from '@/lib/queries';
import type { SectionId, Template } from '@/lib/templates';
import { getTemplate } from '@/lib/templates';
import { dateInWords, parseDate } from '@/lib/format';
import { Schedule } from '@/components/Schedule';
import {
  AnchorNav,
  FaqSection,
  PartySection,
  StorySection,
  ThingsSection,
  TravelSection,
} from '@/components/Sections';

/**
 * The whole guest-facing page, rendered identically for an anonymous visitor and an identified
 * household. The ONLY difference is the `events` array handed in, which is filtered server-side.
 *
 * We never ship every event to the client and hide the private ones with CSS — that would put the
 * full schedule in view-source for anyone who looks.
 */

interface Props {
  settings: Settings;
  events: EventRow[];
  faqs: ContentBlock[];
  travel: ContentBlock[];
  story?: ContentBlock[];
  party?: ContentBlock[];
  things?: ContentBlock[];
  /** The structure to render with. Resolved by the page so the preview cookie applies. */
  template?: Template;
  identified?: boolean;
  rsvpHref?: string;
  calendarBase?: string;
}

/**
 * The fallback headings.
 *
 * These used to be the ONLY headings: one map, seven templates, so every structure printed the
 * same eight sentences in the same order and the words on the page said nothing about which
 * document you were reading. A template may now override any of them (`Template.copy`), and most
 * do — a stationery card says "The order of the day" where a timeline says "The order of the
 * days" and a side rail says "The celebration".
 */
const TITLES: Record<SectionId, string> = {
  welcome: 'A note from us',
  story: 'How we got here',
  schedule: 'Where you need to be',
  party: 'The people beside us',
  travel: 'Getting here, and where to sleep',
  things: 'While you are in town',
  faq: 'Things people have asked',
  gifts: 'On the subject of gifts',
};

/** Fallback nav labels, overridable per template via `Template.navCopy`. */
const NAV_LABELS: Record<SectionId, string> = {
  welcome: 'Welcome',
  story: 'Our story',
  schedule: 'Schedule',
  party: 'Party',
  travel: 'Travel',
  things: 'Things to do',
  faq: 'Questions',
  gifts: 'Gifts',
};

export function WeddingPage({
  settings,
  events,
  faqs,
  travel,
  story = [],
  party = [],
  things = [],
  template,
  identified,
  rsvpHref,
  calendarBase,
}: Props) {
  const date = settings.primary_date ? parseDate(settings.primary_date) : null;
  const tpl = template ?? getTemplate(settings.template);

  /** What a section has to show before it earns a place in the order. */
  const has: Record<SectionId, boolean> = {
    welcome: Boolean(settings.welcome_note),
    story: story.length > 0,
    schedule: true,
    party: party.length > 0,
    travel: travel.length > 0,
    things: things.length > 0,
    faq: faqs.length > 0,
    gifts: Boolean(settings.registry_note || settings.registry_url),
  };

  // Only sections that exist are ordered, and only those are numbered — so an owner who has not
  // written a story does not get a gap where 02 should be.
  const present = tpl.order.filter((id) => has[id]);
  const numberOf = (id: SectionId) => String(present.indexOf(id) + 1).padStart(2, '0');

  /** The template's own word for a section, falling back to the shared one. */
  const titleOf = (id: SectionId) => tpl.copy?.[id] ?? TITLES[id];
  const navLabelOf = (id: SectionId) => tpl.navCopy?.[id] ?? NAV_LABELS[id];

  /**
   * Which ground a section sits on.
   *
   * Named sections, not `:nth-of-type(even)`. The parity version counted the splash and the hero
   * along with the sections, so the largest surface on the page was decided by how many sections
   * an owner happened to have filled in — deleting a welcome note repainted the schedule — and any
   * two templates carrying the same number of sections banded identically for free.
   */
  const bandOf = (id: SectionId) => {
    const at = tpl.band.indexOf(id);
    // Three tones, because three themes (kelsey, alessia, aspen) paint their bands in three block
    // colours rather than one and that was audited into them deliberately. Keyed on the position
    // in the template's DECLARED band list, not in the rendered page, so an owner who leaves a
    // section empty never shifts the tone of the sections after it.
    return at === -1 ? undefined : (['a', 'b', 'c'][at % 3] as string);
  };

  return (
    <>
      {identified ? (
        <div className="viewing-bar no-print">
          <div className="wide viewing-bar-inner">
            {/* Deliberately says nothing about WHO. The owner's label for a link is private, and a
                forwarded link must not reveal it. */}
            <p className="label">Your invitation</p>
            <a className="viewing-switch" href="/find">
              Not your link?
            </a>
          </div>
        </div>
      ) : null}

      {/* Templates whose source carries a fixed nav get one; the rest do not. The links are
          anchors rather than routes — the whole invitation is one document, and a guest who taps
          "Travel" should not lose their place in it. */}
      {tpl.nav !== 'none' ? (
        <AnchorNav
          variant={tpl.nav}
          monogram={[settings.partner_a, settings.partner_b]
            .filter(Boolean)
            .map((n) => n.trim().charAt(0))
            .join(' + ')}
          items={present.map((id) => ({ id, label: navLabelOf(id) }))}
        />
      ) : null}

      <main id="main" className={identified ? 'has-bar' : undefined}>
        {/* Aspen's source opens on a full-screen gate carrying only the names, then reveals the
            site beneath it. Hidden in every other theme. */}
        {/* The cover. For most templates it carries the names alone and is decorative, so it is
            hidden from assistive tech — the same names follow in the hero as a real heading.
            `gate` is the exception: its whole claim is that the first screen is the names, the
            date and two links, so there it carries all three and is NOT hidden. */}
        {/* A cover template's cover carries the names and the date, and then the hero carried
            them AGAIN one scroll below — split, card and boxed each printed the couple's names
            twice and the date twice inside the first two screens. gate was the only one that
            suppressed the repeat, and it did it in CSS by hiding the `h1`, which left the page
            with no accessible heading at all.

            So the cover becomes the real title when a template has one: it holds the `h1`, it is
            no longer hidden from assistive tech, and the hero below drops its eyebrow and its
            names and keeps only what the cover does not say. */}
        <section className="splash" aria-hidden={tpl.cover ? undefined : true}>
          {tpl.cover ? (
            <h1 className="splash-names display">
              {settings.partner_a || settings.couple_names}
              {settings.partner_b ? (
                <>
                  <span className="splash-amp">&amp;</span>
                  {settings.partner_b}
                </>
              ) : null}
            </h1>
          ) : (
            <p className="splash-names display">
              {settings.partner_a || settings.couple_names}
              {settings.partner_b ? (
                <>
                  <span className="splash-amp">&amp;</span>
                  {settings.partner_b}
                </>
              ) : null}
            </p>
          )}

          {/* Every cover carries the date, not only gate's.
              split, card and boxed each spent a full screen on the names alone and then repeated
              them in the hero one scroll below, which is why all three had to be collapsed to a
              thin band on a phone — a cover that says nothing cannot justify its height. With the
              date on it the cover is worth having at any width, and the cover/hero distinction —
              the main first-screen difference between these templates — survives onto the device
              most guests use. */}
          {tpl.cover && settings.script_line ? (
            <span className="splash-indic" aria-hidden="true">
              {settings.script_line}
            </span>
          ) : null}

          {tpl.cover && settings.primary_date ? (
            <p className={`label splash-date${tpl.id === 'gate' ? ' gate-date' : ''}`}>
              {dateInWords(settings.primary_date)}
            </p>
          ) : null}

          {tpl.id === 'gate' ? (
            <>
              <p className="gate-doors">
                <a className="btn btn-ghost" href="#schedule">
                  The details
                </a>
                <a className="btn" href={rsvpHref ?? '/find'}>
                  {rsvpHref
                    ? (tpl.cta?.identified ?? 'Reply to your invitation')
                    : (tpl.cta?.anonymous ?? 'Open your invitation')}
                </a>
              </p>
            </>
          ) : null}
        </section>

        {/* ---------------------------------------------------------------- Hero */}
        <header className="hero section">
          <div className="shell hero-inner">
            {/* The date is on the cover already for a cover template. */}
            {tpl.cover ? null : (
              <p className="label rise hero-eyebrow">
                {settings.primary_date ? dateInWords(settings.primary_date) : 'Save the date'}
              </p>
            )}

            {/* Anvaya's signature: the names set in a non-Latin script above the Latin ones. */}
            {settings.script_line && !tpl.cover ? (
              <span className="hero-indic rise" aria-hidden="true">
                {settings.script_line}
              </span>
            ) : null}

            {tpl.cover ? null : (
              <h1 className="display display-xl rise hero-names">
                {settings.partner_a || settings.couple_names}
                {settings.partner_b ? (
                  <>
                    <span className="amp">&amp;</span>
                    {settings.partner_b}
                  </>
                ) : null}
              </h1>
            )}

            {/* Veley + Ross set the date twice — once in words, once as huge numerals. */}
            {date && !tpl.cover ? (
              <span className="hero-numeric rise" aria-hidden="true">
                {/* All numerals, as the source sets it (10 / 14 / 19). A three-letter month makes
                    the string too wide for 22.22vw and pushes the year off the screen. */}
                {String(date.day).padStart(2, '0')} / {String(date.monthNumber).padStart(2, '0')} /{' '}
                {String(date.year).slice(2)}
              </span>
            ) : null}

            {settings.tagline ? <p className="hero-tagline rise">{settings.tagline}</p> : null}

            {/* The RSVP is the most-used feature on a wedding site. It goes above the fold, on
                mobile, with no hero-scroll gauntlet in front of it. */}
            {rsvpHref ? (
              <p className="hero-cta rise">
                <a className="btn" href={rsvpHref}>
                  {tpl.cta?.identified ?? 'Reply to your invitation'}
                </a>
              </p>
            ) : (
              <p className="hero-cta rise">
                <a className="btn" href="/find">
                  {tpl.cta?.anonymous ?? 'Open your invitation'}
                </a>
              </p>
            )}
          </div>
        </header>

        {/* --------------------------------------------------- The ordered sections

            The template decides which sections appear and in what order; each section decides how
            it presents its own content. Three audit rounds said the same thing about the eighteen
            themes — "one skeleton, six paint jobs" — and this is the answer to it: structure is a
            separate axis from paint, so a palette can arrive as a long scroll, a timeline, an
            invitation card or a set of panels. */}
        {present.map((id) => {
          const num = numberOf(id);

          if (id === 'welcome') {
            return (
              // `id` matters: rail, timeline and boxed all put "Welcome" in their nav, and without
              // it every one of those links scrolled nowhere.
              <section
                className={`section section-welcome welcome-${tpl.blocks}`}
                key={id}
                id="welcome"
                data-band={bandOf(id)}
                aria-labelledby="welcome-h"
              >
                <div className="shell">
                  <hr className="rule" />
                  {/* The number was computed for this section and then thrown away, so every
                      numbered template visibly began at 02. */}
                  {tpl.numbered ? <p className="label section-num">{num}</p> : null}
                  {/* Visible, not `visually-hidden`.
                      Six templates carry their own word for this section — "A note", "With
                      pleasure", "Read this first", "Before anything else" — and every one of them
                      rendered zero pixels, because the heading was hidden from sight and left only
                      for screen readers. Registry strings that reach nobody are the pattern this
                      whole axis exists to catch. */}
                  <h2 id="welcome-h" className="display display-lg section-title">
                    {titleOf('welcome')}
                  </h2>
                  <p className="welcome-note prose">{settings.welcome_note}</p>
                </div>
              </section>
            );
          }

          if (id === 'schedule') {
            return (
              <section
                className="section"
                key={id}
                id="schedule"
                data-band={bandOf(id)}
                aria-labelledby="schedule-h"
              >
                <div className="shell">
                  <hr className="rule" />
                  {tpl.numbered ? <p className="label section-num">{num}</p> : null}
                  <h2 id="schedule-h" className="display display-lg section-title">
                    {identified ? titleOf('schedule') : 'The weekend'}
                  </h2>

                  {!identified ? (
                    <p className="prose muted section-lede">
                      These are the events open to everyone. If you have your invitation link, open
                      it to see your own schedule — some events are smaller, and yours may include
                      more than this.
                    </p>
                  ) : null}

                  <Schedule
                    events={events}
                    rsvpHref={rsvpHref}
                    showRsvpHint={identified}
                    calendarBase={calendarBase}
                    layout={tpl.schedule}
                  />

                  {!identified ? (
                    <p className="unlock no-print">
                      <a className="btn btn-ghost" href="/find">
                        Unlock your full schedule
                      </a>
                    </p>
                  ) : null}
                </div>
              </section>
            );
          }

          if (id === 'story') {
            return <StorySection key={id} blocks={story} template={tpl} num={num} title={titleOf('story')} band={bandOf('story')} />;
          }
          if (id === 'party') {
            return <PartySection key={id} blocks={party} template={tpl} num={num} title={titleOf('party')} band={bandOf('party')} />;
          }
          if (id === 'travel') {
            return <TravelSection key={id} blocks={travel} template={tpl} num={num} title={titleOf('travel')} band={bandOf('travel')} />;
          }
          if (id === 'things') {
            return <ThingsSection key={id} blocks={things} template={tpl} num={num} title={titleOf('things')} band={bandOf('things')} />;
          }
          if (id === 'faq') {
            return <FaqSection key={id} blocks={faqs} template={tpl} num={num} title={titleOf('faq')} band={bandOf('faq')} />;
          }

          // gifts
          return (
            // Gifts was the one prose section never given a treatment: a heading and a
            // paragraph, identical in all seven, and it is the last thing every guest reads.
            <section
              className={`section section-gifts gifts-${tpl.blocks}`}
              key={id}
              id="gifts"
              data-band={bandOf(id)}
              aria-labelledby="gifts-h"
            >
              <div className="shell">
                <hr className="rule" />
                {tpl.numbered ? <p className="label section-num">{num}</p> : null}
                <h2 id="gifts-h" className="display display-lg section-title">
                  {titleOf('gifts')}
                </h2>
                {/* Registry is pull, not push: its own section, never the homepage hero, and never
                    appended to an RSVP confirmation. */}
                <div className={`gifts-body${settings.registry_url ? ' gifts-paired' : ''}`}>
                  <p className="prose gifts-note">{settings.registry_note}</p>
                  {settings.registry_url ? (
                    <p className="gifts-link">
                      <a
                        className="btn btn-ghost"
                        href={settings.registry_url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        The registry
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </main>

      {/* Pinned to the bottom of the window. Only Marry Monday shows it; the others leave it
          hidden, exactly as its source template does and the others do not. */}
      <div className="footer-rail no-print" aria-hidden="true">
        <span className="label">{settings.couple_names}</span>
        <span className="label">{settings.tagline}</span>
      </div>

      <footer className={`site-footer footer-set-${tpl.footer}`}>
        <div className="shell">
          <hr className="rule" />
          <div className="footer-inner">
            <p className="label">
              {settings.couple_names}
              {date ? ` · ${date.day} ${date.month} ${date.year}` : ''}
            </p>
            {settings.contact_name ? (
              <p className="footer-contact muted">
                Questions on the day, or any day before it — {settings.contact_name}
                {settings.contact_phone ? (
                  <>
                    {' '}
                    on <a href={`tel:${settings.contact_phone.replace(/\s/g, '')}`}>{settings.contact_phone}</a>
                  </>
                ) : null}
                {settings.contact_email ? (
                  <>
                    {' '}
                    or <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
                  </>
                ) : null}
                .
              </p>
            ) : null}
          </div>
        </div>
      </footer>
    </>
  );
}
