import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { THEMES, isValidTheme } from '@/lib/themes';
import { TEMPLATES, isValidTemplate } from '@/lib/templates';
import { getSettings } from '@/lib/queries';
import { query } from '@/lib/db';
import { isAdmin, requireAdmin } from '@/lib/auth';
import { AdminNav } from '../AdminNav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Themes', robots: { index: false, follow: false } };

async function preview(formData: FormData) {
  'use server';
  const id = String(formData.get('theme') ?? '');
  if (!isValidTheme(id)) redirect('/admin/themes');
  (await cookies()).set('preview_theme', id, { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  redirect('/admin/themes');
}

async function commit(formData: FormData) {
  'use server';
  // Re-verified inside the action: proxy coverage is an optimistic gate only.
  if (!(await isAdmin())) redirect('/admin/login');
  const id = String(formData.get('theme') ?? '');
  if (!isValidTheme(id)) redirect('/admin/themes');
  await query(`UPDATE site_settings SET theme = $1, updated_at = now() WHERE id = 1`, [id]);
  (await cookies()).delete('preview_theme');
  revalidatePath('/', 'layout');
  redirect('/admin/themes?saved=1');
}

async function previewTemplate(formData: FormData) {
  'use server';
  const id = String(formData.get('template') ?? '');
  if (!isValidTemplate(id)) redirect('/admin/themes');
  (await cookies()).set('preview_template', id, { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  redirect('/admin/themes');
}

async function commitTemplate(formData: FormData) {
  'use server';
  if (!(await isAdmin())) redirect('/admin/login');
  const id = String(formData.get('template') ?? '');
  if (!isValidTemplate(id)) redirect('/admin/themes');
  await query(`UPDATE site_settings SET template = $1, updated_at = now() WHERE id = 1`, [id]);
  (await cookies()).delete('preview_template');
  revalidatePath('/', 'layout');
  redirect('/admin/themes?saved=1');
}

async function clearPreview() {
  'use server';
  const jar = await cookies();
  jar.delete('preview_theme');
  jar.delete('preview_template');
  redirect('/admin/themes');
}

export default async function ThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  // The picker moved from a public `/themes` to `/admin/themes`. Choosing the look of the wedding
  // is an owner's decision, and the page was previously reachable by anyone who guessed the URL —
  // it only gated the "Use this" buttons, so a guest could still browse the whole catalogue and
  // set a preview cookie on themselves.
  //
  // Re-checked here rather than trusted from a route prefix: there is no proxy or middleware in
  // this app, and every admin page and Server Action verifies for itself.
  await requireAdmin();

  const { saved } = await searchParams;
  const settings = await getSettings();
  const jar = await cookies();
  const previewing = jar.get('preview_theme')?.value;
  const previewingTemplate = jar.get('preview_template')?.value;
  const liveTemplate = settings.template || 'classic';

  return (
    <main id="main" className="section">
      <div className="wide">
        <AdminNav active="themes" />
        <p className="label"><Link href="/">&larr; Back to the site</Link></p>
        <h1 className="display display-lg section-title">Choose a look</h1>
        <p className="prose muted">
          Eighteen copies of real, published wedding templates — six from Bliss &amp; Bone and two
          individual sites, six from Zola, six from The Knot. Each link below opens the original so
          you can compare. Nothing here was approximated by eye: the Bliss &amp; Bone palettes were
          harvested from those sites&rsquo; own stylesheets, and the Zola and Knot values are those
          platforms&rsquo; own theme tokens, read out of live published weddings.
        </p>

        {saved ? <p className="notice notice-ok" role="status">Saved. That is now the live theme.</p> : null}
        {previewing || previewingTemplate ? (
          <div className="notice notice-warn">
            <p>
              You are previewing{' '}
              <strong>{THEMES.find((t) => t.id === previewing)?.name ?? 'the live look'}</strong>
              {previewingTemplate ? (
                <>
                  {' '}in{' '}
                  <strong>{TEMPLATES.find((t) => t.id === previewingTemplate)?.name}</strong>
                </>
              ) : null}
              . Browse the whole site to see it properly.
            </p>
            <form action={clearPreview}>
              <button className="btn btn-ghost btn-sm" type="submit">Stop previewing</button>
            </form>
          </div>
        ) : null}

        {/* ------------------------------------------------------------- Templates */}
        <section aria-labelledby="tpl-h">
          <h2 id="tpl-h" className="display display-md admin-h2">Structure</h2>
          <p className="prose muted">
            Which sections appear, in what order, and how each one is laid out. This is a separate
            choice from the palette — every look below works with every structure, so pick one of
            each. Eighteen themes over one structure is eighteen paint jobs; this is the other axis.
          </p>
          <div className="theme-grid">
            {TEMPLATES.map((t) => {
              const isLive = liveTemplate === t.id;
              const isPreview = previewingTemplate === t.id;
              return (
                <article
                  key={t.id}
                  data-template-id={t.id}
                  className={`theme-card${isLive ? ' is-live' : ''}`}
                >
                  <h3 className="theme-name display display-md">{t.name}</h3>
                  <p className="label theme-mood">{t.mood}</p>
                  <p className="theme-blurb">{t.blurb}</p>
                  <p className="theme-ref">
                    <span className="muted">Structure from </span>
                    <a href={t.source} target="_blank" rel="noreferrer noopener">{t.sourceName}</a>
                    <span className="muted"> · {t.provenance}</span>
                  </p>
                  <div className="theme-actions">
                    <form action={previewTemplate}>
                      <input type="hidden" name="template" value={t.id} />
                      <button className="btn btn-ghost btn-sm" type="submit">
                        {isPreview ? 'Previewing' : 'Preview'}
                      </button>
                    </form>
                    <form action={commitTemplate}>
                      <input type="hidden" name="template" value={t.id} />
                      <button className="btn btn-sm" type="submit" disabled={isLive}>
                        {isLive ? 'Live' : 'Use this'}
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <hr className="rule" />

        <h2 id="theme-h" className="display display-md admin-h2">Look</h2>
        <p className="prose muted">
          Palette and type. Each is copied from a specific published template, with the original
          linked so you can compare.
        </p>
        <div className="theme-grid">
          {THEMES.map((t) => {
            const isLive = settings.theme === t.id;
            return (
              <article key={t.id} data-theme-id={t.id} className={`theme-card${isLive ? ' is-live' : ''}`}>
                <div className="theme-swatches" aria-hidden="true">
                  {t.preview.map((hex, i) => (
                    <span key={hex + i} className="theme-swatch" style={{ background: hex }} />
                  ))}
                </div>
                <h2 className="theme-name display display-md">{t.name}</h2>
                <p className="label theme-mood">{t.mood}</p>
                <p className="theme-blurb">{t.blurb}</p>
                {/* The whole point: every theme is a copy of a real, live, reviewed template, and
                    you can open the original and compare. */}
                <p className="theme-ref">
                  <span className="muted">Copied from </span>
                  <a href={t.source} target="_blank" rel="noreferrer noopener">
                    {t.sourceName}
                  </a>
                  <span className="muted"> · {t.provenance}</span>
                </p>

                <div className="theme-actions">
                  <form action={preview}>
                    <input type="hidden" name="theme" value={t.id} />
                    <button className="btn btn-ghost btn-sm" type="submit">Preview</button>
                  </form>
                  <form action={commit}>
                    <input type="hidden" name="theme" value={t.id} />
                    <button className="btn btn-sm" type="submit" disabled={isLive}>
                      {isLive ? 'Live' : 'Use this'}
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>

      </div>
    </main>
  );
}
