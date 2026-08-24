import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getAllEvents } from '@/lib/queries';
import { createEvent, deleteEvent } from '@/lib/actions/content';
import { formatDayHeader, formatTimeSpan } from '@/lib/format';
import { AdminNav } from '../AdminNav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Events', robots: { index: false, follow: false } };

export default async function EventsList({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireAdmin();
  const { deleted } = await searchParams;
  const events = await getAllEvents();

  return (
    <main id="main" className="admin">
      <AdminNav active="events" />

      <div className="wide admin-body">
        <h1 className="display display-md admin-h1">Events</h1>
        <p className="admin-note">
          Every event in the wedding, whether or not any particular guest can see it. Who sees what
          is decided per invitation link, over on <Link href="/admin/invites">Invite links</Link>.
        </p>

        {deleted ? (
          <p className="notice notice-ok" role="status">Event deleted.</p>
        ) : null}

        <form action={createEvent} className="admin-inline-form">
          <p className="field-row">
            <label className="label" htmlFor="name">Add an event</label>
            <input className="field" id="name" name="name" placeholder="Mehndi" maxLength={120} required />
          </p>
          <p className="field-row">
            <label className="label" htmlFor="event_date">On</label>
            <input className="field" id="event_date" name="event_date" type="date" />
          </p>
          <p className="admin-actions">
            <button className="btn" type="submit">Add</button>
          </p>
        </form>

        <div className="admin-section">
          <h2 className="admin-h2">
            In order<span className="admin-count">{events.length}</span>
          </h2>

          {events.length === 0 ? (
            <p className="admin-empty">No events yet. Add the first one above.</p>
          ) : (
            <ul className="admin-list">
              {events.map((e) => (
                <li key={e.id} className="admin-row">
                  <div className="admin-row-main">
                    <Link href={`/admin/events/${e.id}`} className="admin-row-title">
                      {e.name}
                    </Link>
                    <p className="admin-row-meta">
                      {formatDayHeader(e.event_date)}
                      {e.time_mode === 'tba' ? ' · Time to be announced' : ` · ${formatTimeSpan(e)}`}
                      {e.venue_name ? ` · ${e.venue_name}` : ''}
                    </p>
                    <div className="admin-row-tags">
                      {e.is_main ? <span className="tag tag-on">Main event</span> : null}
                      <span className={`tag ${e.is_public ? 'tag-on' : ''}`}>
                        {e.is_public ? 'On the public page' : 'By link only'}
                      </span>
                      <span className={`tag ${e.rsvp_enabled ? 'tag-on' : ''}`}>
                        {e.rsvp_enabled ? 'Collecting replies' : 'No reply needed'}
                      </span>
                    </div>
                  </div>

                  {/* Named controls, not a linked heading.
                      The editor and the delete both existed from the start, but the only way to
                      reach either was to work out that the event's NAME was a link — which reads as
                      a title, not as a button. An action nobody can find is an action that is not
                      there. */}
                  <div className="admin-row-actions">
                    <Link className="btn btn-ghost btn-sm" href={`/admin/events/${e.id}`}>
                      Edit
                    </Link>

                    {/* Native disclosure, so the confirmation costs no JavaScript and cannot be
                        skipped by a stray double-click on a list of eight similar rows. Deleting an
                        event throws away replies guests have already given for it. */}
                    <details className="admin-confirm">
                      <summary className="btn btn-ghost btn-sm">Delete</summary>
                      <div className="admin-confirm-body">
                        <p className="admin-confirm-text">
                          Deleting <strong>{e.name}</strong> removes it from every invitation link and
                          discards any replies already given for it. There is no undo.
                        </p>
                        <form action={deleteEvent.bind(null, e.id)}>
                          <button className="btn btn-sm" type="submit">
                            Yes, delete it
                          </button>
                        </form>
                      </div>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
