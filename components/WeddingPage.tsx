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

/** Section titles. The copy differs by section, not by template — a structure changes where a
 *  section sits and how it looks, not what it is called. */
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
          items={present.map((id) => ({ id, label: NAV_LABELS[id] }))}
        />
      ) : null}

      <main id="main" className={identified ? 'has-bar' : undefined}>
        {/* Aspen's source opens on a full-screen gate carrying only the names, then reveals the
            site beneath it. Hidden in every other theme. */}
        {/* The cover. For most templates it carries the names alone and is decorative, so it is
            hidden from assistive tech — the same names follow in the hero as a real heading.
            `gate` is the exception: its whole claim is that the first screen is the names, the
            date and two links, so there it carries all three and is NOT hidden. */}
        <section className="splash" aria-hidden={tpl.id === 'gate' ? undefined : true}>
          <p className="splash-names display">
            {settings.partner_a || settings.couple_names}
            {settings.partner_b ? (
              <>
                <span className="splash-amp">&amp;</span>
                {settings.partner_b}
              </>
            ) : null}
          </p>

          {tpl.id === 'gate' ? (
            <>
              {settings.primary_date ? (
                <p className="label gate-date">{dateInWords(settings.primary_date)}</p>
              ) : null}
              <p className="gate-doors">
                <a className="btn btn-ghost" href="#schedule">
                  The details
                </a>
                <a className="btn" href={rsvpHref ?? '/find'}>
                  {rsvpHref ? 'Reply to your invitation' : 'Open your invitation'}
                </a>
              </p>
            </>
          ) : null}
        </section>

        {/* ---------------------------------------------------------------- Hero */}
        <header className="hero section">
          <div className="shell hero-inner">
            <p className="label rise hero-eyebrow">
              {settings.primary_date ? dateInWords(settings.primary_date) : 'Save the date'}
            </p>

            {/* Anvaya's signature: the names set in a non-Latin script above the Latin ones. */}
            {settings.script_line ? (
              <span className="hero-indic rise" aria-hidden="true">
                {settings.script_line}
              </span>
            ) : null}

            <h1 className="display display-xl rise hero-names">
              {settings.partner_a || settings.couple_names}
              {settings.partner_b ? (
                <>
                  <span className="amp">&amp;</span>
                  {settings.partner_b}
                </>
              ) : null}
            </h1>

            {/* Veley + Ross set the date twice — once in words, once as huge numerals. */}
            {date ? (
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
                  Reply to your invitation
                </a>
              </p>
            ) : (
              <p className="hero-cta rise">
                <a className="btn" href="/find">
                  Open your invitation
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
              <section className="section" key={id} aria-labelledby="welcome-h">
                <div className="shell">
                  <hr className="rule" />
                  <h2 id="welcome-h" className="visually-hidden">
                    {TITLES.welcome}
                  </h2>
                  <p className="welcome-note prose">{settings.welcome_note}</p>
                </div>
              </section>
            );
          }

          if (id === 'schedule') {
            return (
              <section className="section" key={id} aria-labelledby="schedule-h" id="schedule">
                <div className="shell">
                  <hr className="rule" />
                  {tpl.numbered ? <p className="label section-num">{num}</p> : null}
                  <h2 id="schedule-h" className="display display-lg section-title">
                    {identified ? TITLES.schedule : 'The weekend'}
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
            return <StorySection key={id} blocks={story} template={tpl} num={num} title={TITLES.story} />;
          }
          if (id === 'party') {
            return <PartySection key={id} blocks={party} template={tpl} num={num} title={TITLES.party} />;
          }
          if (id === 'travel') {
            return <TravelSection key={id} blocks={travel} template={tpl} num={num} title={TITLES.travel} />;
          }
          if (id === 'things') {
            return <ThingsSection key={id} blocks={things} template={tpl} num={num} title={TITLES.things} />;
          }
          if (id === 'faq') {
            return <FaqSection key={id} blocks={faqs} template={tpl} num={num} title={TITLES.faq} />;
          }

          // gifts
          return (
            <section className="section" key={id} aria-labelledby="gifts-h" id="gifts">
              <div className="shell">
                <hr className="rule" />
                {tpl.numbered ? <p className="label section-num">{num}</p> : null}
                <h2 id="gifts-h" className="display display-lg section-title">
                  {TITLES.gifts}
                </h2>
                {/* Registry is pull, not push: its own section, never the homepage hero, and never
                    appended to an RSVP confirmation. */}
                <p className="prose">{settings.registry_note}</p>
                {settings.registry_url ? (
                  <p>
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

      <footer className="site-footer">
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
