import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin, isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAllEvents, getInviteSummaries, getSettings } from '@/lib/queries';
import { formatCode, newCode, newToken } from '@/lib/tokens';
import { AdminNav } from '../AdminNav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invite links', robots: { index: false, follow: false } };

/**
 * The link manager — the whole point of the product.
 *
 * You make a link, tick the events it shows, and send it to whoever you like. There is no guest
 * list to maintain and nobody has to be matched by name. Two links to the same family with
 * different events ticked is a perfectly normal thing to do.
 */
async function createInvite(formData: FormData) {
  'use server';
  // Re-verified inside the action. Next's own docs warn that a refactor can silently remove proxy
  // coverage, so the gate is never left to the proxy alone.
  if (!(await isAdmin())) redirect('/admin/login');

  const label = String(formData.get('label') ?? '').trim().slice(0, 120);
  if (!label) redirect('/admin/invites?e=label');

  const maxGuests = Math.min(20, Math.max(1, Number(formData.get('max_guests') ?? 2) || 2));
  const eventIds = formData.getAll('event').filter((v): v is string => typeof v === 'string');

  const [invite] = await query<{ id: string }>(
    `INSERT INTO invites (label, note, token, code, max_guests) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [label, String(formData.get('note') ?? '').trim().slice(0, 300), newToken(), newCode(), maxGuests],
  );

  for (const id of eventIds) {
    await query(
      `INSERT INTO invite_events (invite_id, event_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [invite.id, id],
    );
  }

  redirect(`/admin/invites/${invite.id}?created=1`);
}

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; deleted?: string }>;
}) {
  await requireAdmin();
  const { e, deleted } = await searchParams;

  const [invites, events, settings] = await Promise.all([
    getInviteSummaries(),
    getAllEvents(),
    getSettings(),
  ]);

  const base = process.env.SITE_URL ?? '';

  return (
    <main id="main" className="admin">
      <AdminNav active="invites" />

      <div className="wide admin-body">
        <h1 className="display display-md admin-h1">Invite links</h1>
        <p className="admin-note">
          Each link shows only the events you tick for it. Send it however you like — WhatsApp, SMS,
          email, or the printed code on a card. Nobody signs in and nobody has to be found by name.
        </p>
        <p className="admin-note admin-warn">
          A link is a key: anyone holding it sees that link&rsquo;s events and can reply on it. That
          is the point of a shared household invitation. What matters is that a forwarded link can
          never reveal an event you did not tick, and that you can revoke any link at any time.
        </p>

        {e === 'label' ? (
          <p className="notice notice-warn" role="alert">Give the link a label so you can tell them apart.</p>
        ) : null}
        {deleted ? (
          <p className="notice notice-ok" role="status">Link deleted.</p>
        ) : null}

        {/* ------------------------------------------------------------- New link */}
        <section className="admin-section" aria-labelledby="new-h">
          <h2 id="new-h" className="admin-h2">Make a new link</h2>

          <form action={createInvite} className="invite-form">
            <div className="grid-2">
              <p className="field-row">
                <label className="label" htmlFor="label">
                  Who is it for? (only you see this)
                </label>
                <input id="label" name="label" className="field" placeholder="e.g. Khan family" required />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="max_guests">How many people may it bring?</label>
                <input id="max_guests" name="max_guests" type="number" min={1} max={20}
                  defaultValue={2} className="field tnum" />
              </p>
            </div>

            <fieldset className="person">
              <legend className="person-name">Which events does this link show?</legend>
              <div className="checks checks-events">
                {events.map((ev) => (
                  <label key={ev.id} className="choice choice-check">
                    <input type="checkbox" name="event" value={ev.id} defaultChecked={ev.is_public} />
                    <span>
                      {ev.name}
                      {ev.is_public ? <span className="muted"> · public anyway</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="field-row">
              <label className="label" htmlFor="note">Note to yourself (optional)</label>
              <input id="note" name="note" className="field" placeholder="e.g. sent on WhatsApp 3 Jan" />
            </p>

            <button className="btn" type="submit">Create link</button>
          </form>
        </section>

        {/* --------------------------------------------------------- Existing links */}
        <section className="admin-section" aria-labelledby="list-h">
          <h2 id="list-h" className="admin-h2">
            All links <span className="tnum admin-count">{invites.length}</span>
          </h2>

          {!invites.length ? (
            <p className="admin-empty">
              No links yet. Make one above, or run <code>node scripts/seed.mjs --reset</code> for the demo.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Shows</th>
                    <th className="num">Seats</th>
                    <th>Replied</th>
                    <th>Link &amp; code</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => (
                    <tr key={inv.id} className={inv.revoked_at ? 'is-revoked' : undefined}>
                      <td>
                        {inv.label}
                        {inv.revoked_at ? <span className="chip chip-warn">revoked</span> : null}
                        {inv.note ? <div className="muted small">{inv.note}</div> : null}
                      </td>
                      <td className="small">
                        {inv.event_names.length ? (
                          <span className="event-chips">
                            {inv.event_names.map((n) => (
                              <span key={n} className="chip">{n}</span>
                            ))}
                          </span>
                        ) : (
                          <span className="chip chip-warn">nothing ticked</span>
                        )}
                      </td>
                      <td className="num tnum">{inv.max_guests}</td>
                      <td className="small">
                        {inv.responded ? (
                          <>
                            <strong className="tnum">{inv.head_count}</strong> coming
                            {inv.contact_email ? <div className="muted">{inv.contact_email}</div> : null}
                          </>
                        ) : (
                          <span className="muted">{inv.opened_at ? 'opened, no reply' : 'not opened'}</span>
                        )}
                      </td>
                      <td className="small">
                        <code className="token">{base}/i/{inv.token}</code>
                        <div className="tnum muted">{formatCode(inv.code)}</div>
                      </td>
                      <td>
                        <a className="btn btn-ghost btn-sm" href={`/admin/invites/${inv.id}`}>
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="admin-note">
          Site is currently{' '}
          {settings.site_is_public ? 'visible to search engines' : 'hidden from search engines'}.
        </p>
      </div>
    </main>
  );
}
