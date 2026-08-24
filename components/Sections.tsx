import type { ContentBlock } from '@/lib/queries';
import type { Template } from '@/lib/templates';

/**
 * The sections a template can order.
 *
 * Each one owns its own markup and takes the template as a prop, because the same content is
 * presented differently depending on the structure chosen — the story beats stack, alternate, or
 * run down a timeline; the wedding party is a grid or a list. Paint is not involved here at all:
 * that is the theme's job, and every one of these renders under all eighteen.
 *
 * The vocabulary — story beats keyed on a date, party members keyed on a role — is what the real
 * builders use. Zola and The Knot both break the couple's story into named, dated beats rather than
 * one prose block, and both key a party member off a role rather than a free-text bio alone.
 */

interface SectionProps {
  blocks: ContentBlock[];
  template: Template;
  num?: string;
  title: string;
  /** Which ground this section sits on. Decided by the template, not by the section's DOM index. */
  band?: string;
}

/** A section's eyebrow: the number, if this template numbers its sections. */
function Eyebrow({ num, template }: { num?: string; template: Template }) {
  if (!num || !template.numbered) return null;
  return <p className="label section-num">{num}</p>;
}

/* -------------------------------------------------------------------- Story */

export function StorySection({ blocks, template, num, title, band }: SectionProps) {
  if (!blocks.length) return null;
  return (
    <section className="section section-story" data-band={band} aria-labelledby="story-h" id="story">
      <div className="shell">
        <hr className="rule" />
        <Eyebrow num={num} template={template} />
        <h2 id="story-h" className="display display-lg section-title">
          {title}
        </h2>
        <ol className={`story story-${template.story ?? 'stack'}`}>
          {blocks.map((b, i) => (
            <li key={b.id} className="story-beat" data-beat={i % 2 === 0 ? 'a' : 'b'}>
              {/* The date is the thing that makes a beat a beat rather than a paragraph. */}
              {b.meta ? <p className="label story-when">{b.meta}</p> : null}
              <h3 className="display display-md story-title">{b.title}</h3>
              <p className="story-body">{b.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Wedding party */

export function PartySection({ blocks, template, num, title, band }: SectionProps) {
  if (!blocks.length) return null;
  return (
    <section className="section section-party" data-band={band} aria-labelledby="party-h" id="party">
      <div className="shell">
        <hr className="rule" />
        <Eyebrow num={num} template={template} />
        <h2 id="party-h" className="display display-lg section-title">
          {title}
        </h2>
        <ul className={`party party-${template.party ?? 'grid'}`}>
          {blocks.map((b) => (
            <li key={b.id} className="party-member">
              {/* Role above name, which is the order both Zola and The Knot use. */}
              {b.meta ? <p className="label party-role">{b.meta}</p> : null}
              <h3 className="display display-md party-name">{b.title}</h3>
              {b.body ? <p className="party-bio">{b.body}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Things to do */

export function ThingsSection({ blocks, template, num, title, band }: SectionProps) {
  if (!blocks.length) return null;
  return (
    <section className="section section-things" data-band={band} aria-labelledby="things-h" id="things">
      <div className="shell">
        <hr className="rule" />
        <Eyebrow num={num} template={template} />
        <h2 id="things-h" className="display display-lg section-title">
          {title}
        </h2>
        <div className={`blocks blocks-${template.blocks} things`}>
          {blocks.map((b) => (
            <article key={b.id} className="block">
              {b.meta ? <p className="label">{b.meta}</p> : null}
              <h3 className="block-title">{b.title}</h3>
              <p className="block-body">{b.body}</p>
              {b.link_url ? (
                <p>
                  <a className="block-link" href={b.link_url} target="_blank" rel="noreferrer noopener">
                    {b.link_label || 'More details'}
                  </a>
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- Travel */

export function TravelSection({ blocks, template, num, title, band }: SectionProps) {
  if (!blocks.length) return null;
  return (
    <section className="section section-travel" data-band={band} aria-labelledby="travel-h" id="travel">
      <div className="shell">
        <hr className="rule" />
        <Eyebrow num={num} template={template} />
        <h2 id="travel-h" className="display display-lg section-title">
          {title}
        </h2>
        <div className={`blocks blocks-${template.blocks}`}>
          {blocks.map((b) => (
            <article key={b.id} className="block">
              <h3 className="block-title">{b.title}</h3>
              <p className="block-body">{b.body}</p>
              {b.link_url ? (
                <p>
                  <a className="block-link" href={b.link_url} target="_blank" rel="noreferrer noopener">
                    {b.link_label || 'More details'}
                  </a>
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- FAQ */

export function FaqSection({ blocks, template, num, title, band }: SectionProps) {
  if (!blocks.length) return null;
  return (
    <section className="section section-faq" data-band={band} aria-labelledby="faq-h" id="faq">
      <div className="shell">
        <hr className="rule" />
        <Eyebrow num={num} template={template} />
        <h2 id="faq-h" className="display display-lg section-title">
          {title}
        </h2>
        <dl className={`faq faq-${template.faq}`}>
          {blocks.map((f) => (
            <div key={f.id} className="faq-item">
              <dt className="faq-q">{f.title}</dt>
              <dd className="faq-a">{f.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- Anchors */

/**
 * Section navigation.
 *
 * `anchors` is a bar across the top; `rail` is Eternity's model — a monogram and a vertical list
 * pinned down the left quarter of the screen that never scrolls away, with the content in the
 * remaining three quarters. Same markup, different geometry, so the choice stays in CSS.
 */
export function AnchorNav({
  items,
  variant = 'anchors',
  monogram,
}: {
  items: { id: string; label: string }[];
  variant?: 'anchors' | 'rail';
  monogram?: string;
}) {
  if (!items.length) return null;
  return (
    <nav className={`anchor-nav anchor-nav-${variant} no-print`} aria-label="Sections">
      {variant === 'rail' && monogram ? (
        <p className="rail-monogram display display-md" aria-hidden="true">
          {monogram}
        </p>
      ) : null}
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`}>{i.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
