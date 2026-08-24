import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import type { ContentBlock } from '@/lib/queries';
import { createBlock, deleteBlock, saveBlock } from '@/lib/actions/content';
import { AdminNav } from '../AdminNav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sections', robots: { index: false, follow: false } };

/**
 * The prose sections.
 *
 * All five are the same shape in the database — a title, a short line above it, a body, an optional
 * link — so they are one editor with five tabs rather than five near-identical pages. What differs
 * is only what each field MEANS, and that is carried in the labels: on a story beat the short line
 * is a date, on a wedding party member it is a role. Zola and The Knot both key those two sections
 * off exactly those two fields, which is why one table serves all five.
 */
const SECTIONS = [
  {
    id: 'faq',
    label: 'Questions',
    blurb: 'The things guests ask. Answer them here and they will not text you.',
    titleLabel: 'Question',
    bodyLabel: 'Answer',
    metaLabel: '',
  },
  {
    id: 'travel',
    label: 'Travel and stay',
    blurb: 'Airports, roads, hotels, parking.',
    titleLabel: 'Heading',
    bodyLabel: 'Details',
    metaLabel: 'Short line above (optional)',
  },
  {
    id: 'things_to_do',
    label: 'Things to do',
    blurb: 'For guests who arrive early or stay on.',
    titleLabel: 'Heading',
    bodyLabel: 'Details',
    metaLabel: 'Short line above (optional)',
  },
  {
    id: 'story',
    label: 'Our story',
    blurb: 'Told in dated beats rather than one block of prose — that is what the real builders do.',
    titleLabel: 'What happened',
    bodyLabel: 'The story',
    metaLabel: 'When (e.g. June 2019)',
  },
  {
    id: 'party',
    label: 'Wedding party',
    blurb: 'One entry per person.',
    titleLabel: 'Name',
    bodyLabel: 'A line about them',
    metaLabel: 'Their role (e.g. Maid of Honour)',
  },
] as const;

export default async function PagesEditor({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; saved?: string; deleted?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const active = SECTIONS.find((s) => s.id === sp.section) ?? SECTIONS[0];

  // Includes hidden blocks — this is the editor, so an owner has to be able to see what they have
  // switched off in order to switch it back on.
  const blocks = await query<ContentBlock & { visible: boolean }>(
    `SELECT id, section, title, meta, body, link_url, link_label, visible, sort_order
       FROM content_blocks WHERE section = $1 ORDER BY sort_order, title`,
    [active.id],
  );

  return (
    <main id="main" className="admin">
      <AdminNav active="pages" />

      <div className="wide admin-body">
        <h1 className="display display-md admin-h1">Sections</h1>
        <p className="admin-note">
          A section with nothing in it does not appear on the site at all, so you never have to
          switch anything off to hide an empty heading.
        </p>

        <nav className="admin-tabs" aria-label="Section">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`/admin/pages?section=${s.id}`}
              className={`admin-tab${s.id === active.id ? ' is-active' : ''}`}
              aria-current={s.id === active.id ? 'page' : undefined}
            >
              {s.label}
            </a>
          ))}
        </nav>

        {sp.saved ? <p className="notice notice-ok" role="status">Saved.</p> : null}
        {sp.deleted ? <p className="notice notice-ok" role="status">Deleted.</p> : null}

        <p className="admin-note">{active.blurb}</p>

        <div className="admin-section">
          <h2 className="admin-h2">
            {active.label}
            <span className="admin-count">{blocks.length}</span>
          </h2>

          {blocks.length === 0 ? (
            <p className="admin-empty">Nothing here yet.</p>
          ) : (
            <ul className="admin-list">
              {blocks.map((b) => {
                const save = saveBlock.bind(null, b.id);
                const remove = deleteBlock.bind(null, b.id, active.id);
                return (
                  <li key={b.id} className="admin-block">
                    <form action={save} className="admin-form">
                      <input type="hidden" name="section" value={active.id} />

                      {active.metaLabel ? (
                        <p className="field-row">
                          <label className="label" htmlFor={`meta-${b.id}`}>{active.metaLabel}</label>
                          <input className="field" id={`meta-${b.id}`} name="meta" defaultValue={b.meta} maxLength={120} />
                        </p>
                      ) : (
                        <input type="hidden" name="meta" value={b.meta} />
                      )}

                      <p className="field-row">
                        <label className="label" htmlFor={`title-${b.id}`}>{active.titleLabel}</label>
                        <input className="field" id={`title-${b.id}`} name="title" defaultValue={b.title} maxLength={200} required />
                      </p>

                      <p className="field-row">
                        <label className="label" htmlFor={`body-${b.id}`}>{active.bodyLabel}</label>
                        <textarea className="field" id={`body-${b.id}`} name="body" defaultValue={b.body} maxLength={3000} rows={4} />
                      </p>

                      <div className="admin-grid">
                        <p className="field-row">
                          <label className="label" htmlFor={`url-${b.id}`}>Link</label>
                          <input className="field" id={`url-${b.id}`} name="link_url" type="url" defaultValue={b.link_url} maxLength={400} placeholder="https://" />
                        </p>
                        <p className="field-row">
                          <label className="label" htmlFor={`label-${b.id}`}>Link text</label>
                          <input className="field" id={`label-${b.id}`} name="link_label" defaultValue={b.link_label} maxLength={80} placeholder="More details" />
                        </p>
                      </div>

                      <div className="admin-grid">
                        <p className="field-row">
                          <label className="label" htmlFor={`order-${b.id}`}>Position</label>
                          <input className="field" id={`order-${b.id}`} name="sort_order" type="number" min={0} max={999} defaultValue={b.sort_order} />
                        </p>
                        <p className="admin-check admin-check-inline">
                          <input type="checkbox" id={`visible-${b.id}`} name="visible" defaultChecked={b.visible} />
                          <label htmlFor={`visible-${b.id}`}>Show on the site</label>
                        </p>
                      </div>

                      <p className="admin-actions">
                        <button className="btn btn-sm" type="submit">Save</button>
                      </p>
                    </form>

                    <details className="admin-confirm admin-block-delete">
                      <summary className="btn btn-ghost btn-sm">Delete</summary>
                      <div className="admin-confirm-body">
                        <p className="admin-confirm-text">
                          Removed for good. To take it off the site without losing what it says,
                          untick <strong>Show on the site</strong> above and save instead.
                        </p>
                        <form action={remove}>
                          <button className="btn btn-sm" type="submit">Yes, delete it</button>
                        </form>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="admin-section">
          <h2 className="admin-h2">Add to {active.label.toLowerCase()}</h2>
          <form action={createBlock} className="admin-form admin-block">
            <input type="hidden" name="section" value={active.id} />

            {active.metaLabel ? (
              <p className="field-row">
                <label className="label" htmlFor="new-meta">{active.metaLabel}</label>
                <input className="field" id="new-meta" name="meta" maxLength={120} />
              </p>
            ) : null}

            <p className="field-row">
              <label className="label" htmlFor="new-title">{active.titleLabel}</label>
              <input className="field" id="new-title" name="title" maxLength={200} required />
            </p>

            <p className="field-row">
              <label className="label" htmlFor="new-body">{active.bodyLabel}</label>
              <textarea className="field" id="new-body" name="body" maxLength={3000} rows={4} />
            </p>

            <p className="admin-actions">
              <button className="btn" type="submit">Add</button>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
