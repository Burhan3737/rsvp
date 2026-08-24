import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isAdmin, requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import {
  getAllEvents,
  getEventsForInvite,
  getInviteWithEvents,
  getRsvpData,
  cellKey,
  mealsFor,
} from '@/lib/queries';
import { formatCode } from '@/lib/tokens';
import { formatDayHeader } from '@/lib/format';
import { AdminNav } from '../../AdminNav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Invite link', robots: { index: false, follow: false } };

async function saveInvite(inviteId: string, formData: FormData) {
  'use server';
  if (!(await isAdmin())) redirect('/admin/login');

  const label = String(formData.get('label') ?? '').trim().slice(0, 120);
  const maxGuests = Math.min(20, Math.max(1, Number(formData.get('max_guests') ?? 2) || 2));

  await query(
    `UPDATE invites SET label = $2, note = $3, max_guests = $4 WHERE id = $1`,
    [inviteId, label || 'Untitled', String(formData.get('note') ?? '').trim().slice(0, 300), maxGuests],
  );

  const wanted = new Set(formData.getAll('event').filter((v): v is string => typeof v === 'string'));
  await query(`DELETE FROM invite_events WHERE invite_id = $1`, [inviteId]);
  for (const id of wanted) {
    await query(`INSERT INTO invite_events (invite_id, event_id) VALUES ($1,$2)`, [inviteId, id]);
  }

  redirect(`/admin/invites/${inviteId}?saved=1`);
}

async function toggleRevoke(inviteId: string, revoke: boolean) {
  'use server';
  if (!(await isAdmin())) redirect('/admin/login');
  // One UPDATE kills a forwarded link. This is exactly why tokens are random rows in the database
  // and not signed tokens, which cannot be revoked without rotating a key for everybody.
  await query(
    `UPDATE invites SET revoked_at = ${revoke ? 'now()' : 'NULL'} WHERE id = $1`,
    [inviteId],
  );
  redirect(`/admin/invites/${inviteId}?saved=1`);
}

async function deleteInvite(inviteId: string) {
  'use server';
  if (!(await isAdmin())) redirect('/admin/login');
  await query(`DELETE FROM invites WHERE id = $1`, [inviteId]);
  redirect('/admin/invites?deleted=1');
}

export default async function InviteDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { saved, created } = await searchParams;

  const found = await getInviteWithEvents(id);
  if (!found) notFound();
  const { invite, eventIds } = found;

  const [allEvents, shows, rsvp] = await Promise.all([
    getAllEvents(),
    getEventsForInvite(invite.id),
    getRsvpData(invite.id),
  ]);

  const base = process.env.SITE_URL ?? '';
  const url = `${base}/i/${invite.token}`;
  const save = saveInvite.bind(null, invite.id);
  const revoke = toggleRevoke.bind(null, invite.id, !invite.revoked_at);
  const remove = deleteInvite.bind(null, invite.id);

  return (
    <main id="main" className="admin">
      <AdminNav active="invites" />

      <div className="wide admin-body" style={{ maxWidth: 900 }}>
        <p className="label">
          <Link href="/admin/invites">&larr; All links</Link>
        </p>
        <h1 className="display display-md admin-h1">{invite.label}</h1>

        {created ? <p className="notice notice-ok" role="status">Link created. Share it below.</p> : null}
        {saved ? <p className="notice notice-ok" role="status">Saved.</p> : null}
        {invite.revoked_at ? (
          <p className="notice notice-warn">
            This link is revoked. Anyone opening it now gets a &ldquo;not found&rdquo; page.
          </p>
        ) : null}

        {/* ------------------------------------------------------------ Share it */}
        <section className="admin-section" aria-labelledby="share-h">
          <h2 id="share-h" className="admin-h2">Share this</h2>
          <p className="share-url">
            <code className="token">{url}</code>
          </p>
          <p className="admin-note">
            Printed code: <code className="tnum">{formatCode(invite.code)}</code> — for the card, if
            somebody would rather type than scan. It never uses I, L, O or U, so there is nothing to
            mistake for a 1 or a 0.
          </p>
          <p className="theme-actions">
            <a className="btn btn-ghost btn-sm" href={`/i/${invite.token}`} target="_blank" rel="noreferrer">
              Open it as the guest sees it
            </a>
          </p>
        </section>

        {/* ------------------------------------------------- Exactly what it shows */}
        <section className="admin-section" aria-labelledby="sees-h">
          <hr className="rule" />
          <h2 id="sees-h" className="admin-h2">What this link shows</h2>
          <p className="admin-note">
            Read straight from the same query the guest page runs, so this cannot drift from reality.
          </p>
          <ul className="sees-list">
            {shows.map((ev) => (
              <li key={ev.id} className="sees-item">
                <strong>{ev.name}</strong>
                <span className="muted">{formatDayHeader(ev.event_date)}</span>
                {ev.is_public ? <span className="chip">public to everyone</span> : null}
                {!ev.rsvp_enabled ? <span className="chip">no reply needed</span> : null}
              </li>
            ))}
          </ul>
          {!shows.length ? (
            <p className="admin-empty">
              Nothing at all. They would see an empty schedule — almost certainly not what you meant.
            </p>
          ) : null}
        </section>

        {/* -------------------------------------------------------------- Edit it */}
        <section className="admin-section" aria-labelledby="edit-h">
          <hr className="rule" />
          <h2 id="edit-h" className="admin-h2">Settings</h2>

          <form action={save} className="invite-form">
            <div className="grid-2">
              <p className="field-row">
                <label className="label" htmlFor="label">Label (only you see this)</label>
                <input id="label" name="label" className="field" defaultValue={invite.label} required />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="max_guests">Seats</label>
                <input id="max_guests" name="max_guests" type="number" min={1} max={20}
                  className="field tnum" defaultValue={invite.max_guests} />
              </p>
            </div>

            <fieldset className="person">
              <legend className="person-name">Events this link shows</legend>
              <div className="checks checks-events">
                {allEvents.map((ev) => (
                  <label key={ev.id} className="choice choice-check">
                    <input type="checkbox" name="event" value={ev.id} defaultChecked={eventIds.has(ev.id)} />
                    <span>
                      {ev.name}
                      {ev.is_public ? <span className="muted"> · public anyway</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="field-row">
              <label className="label" htmlFor="note">Note to yourself</label>
              <input id="note" name="note" className="field" defaultValue={invite.note} />
            </p>

            <button className="btn" type="submit">Save</button>
          </form>

          <div className="danger-row">
            <form action={revoke}>
              <button className="btn btn-ghost btn-sm" type="submit">
                {invite.revoked_at ? 'Un-revoke this link' : 'Revoke this link'}
              </button>
            </form>
            <form action={remove}>
              <button className="btn btn-ghost btn-sm" type="submit">Delete permanently</button>
            </form>
          </div>
        </section>

        {/* --------------------------------------------------------- Their reply */}
        <section className="admin-section" aria-labelledby="reply-h">
          <hr className="rule" />
          <h2 id="reply-h" className="admin-h2">Their reply</h2>

          {!rsvp.response ? (
            <p className="admin-empty">
              No reply yet.{' '}
              {invite.opened_at ? 'They have opened the link at least once.' : 'They have not opened it yet.'}
            </p>
          ) : (
            <>
              <p className="admin-note">
                {rsvp.response.contact_email || rsvp.response.contact_phone ? (
                  <>
                    Contact: {rsvp.response.contact_email} {rsvp.response.contact_phone}
                    <br />
                  </>
                ) : null}
                {rsvp.response.travelling_from ? <>Travelling from {rsvp.response.travelling_from}. </> : null}
                {rsvp.response.needs_shuttle === true ? 'Wants the shuttle. ' : ''}
                {rsvp.response.needs_accommodation === true ? 'Wants a hotel room. ' : ''}
              </p>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      {rsvp.events.map((ev) => (
                        <th key={ev.id}>{ev.name}</th>
                      ))}
                      <th>Food &amp; access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rsvp.attendees.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {a.name}
                          {a.is_child ? <span className="muted small"> · child</span> : null}
                        </td>
                        {rsvp.events.map((ev) => {
                          const cell = rsvp.attendance.get(cellKey(a.slot, ev.id));
                          const meal = mealsFor(ev.meals, a.is_child).find(
                            (m) => m.id === cell?.meal_option_id,
                          );
                          return (
                            <td key={ev.id} className="small">
                              {cell ? (
                                <>
                                  {cell.status === 'attending' ? 'Yes' : 'No'}
                                  {meal ? <div className="muted">{meal.name}</div> : null}
                                </>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="small">
                          {(a.dietary_tags ?? []).join(', ')}
                          {a.dietary_medical ? <div><strong>{a.dietary_medical}</strong></div> : null}
                          {a.dietary_preference ? <div className="muted">{a.dietary_preference}</div> : null}
                          {a.accessibility ? <div className="muted">{a.accessibility}</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rsvp.response.message ? (
                <p className="admin-note">
                  <strong>They wrote:</strong> {rsvp.response.message}
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
