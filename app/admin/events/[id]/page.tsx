import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { queryOne, query } from '@/lib/db';
import type { EventRow, MealOption } from '@/lib/queries';
import { deleteEvent, saveEvent, swatchesToText } from '@/lib/actions/content';
import { AdminNav } from '../../AdminNav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Event', robots: { index: false, follow: false } };

export default async function EventEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { saved, created } = await searchParams;

  const e = await queryOne<EventRow>(
    `SELECT id, slug, name, blurb, description, event_date::text AS event_date,
            start_time::text AS start_time, end_time::text AS end_time, arrive_by::text AS arrive_by,
            timezone, venue_name, venue_address, venue_map_url,
            dress_code, dress_code_note, modesty_note, permission_note, swatches, avoid_colours,
            is_public, rsvp_enabled, is_main, is_unplugged, show_map, show_directions,
            show_add_to_calendar, time_mode, accent_hex, sort_order
       FROM events WHERE id = $1`,
    [id],
  );
  if (!e) notFound();

  const meals = await query<MealOption>(
    `SELECT id, event_id, name, description, audience, sort_order
       FROM meal_options WHERE event_id = $1 ORDER BY sort_order`,
    [id],
  );

  const save = saveEvent.bind(null, id);
  const remove = deleteEvent.bind(null, id);

  // `time` inputs want HH:MM. Postgres hands back HH:MM:SS.
  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

  // Resolved here rather than inline in `defaultValue={await ...}`: an await inside a JSX prop is
  // valid but static analysis cannot follow it, and it reads worse than a named value.
  const wearText = await swatchesToText(e.swatches);
  const avoidText = await swatchesToText(e.avoid_colours);

  return (
    <main id="main" className="admin">
      <AdminNav active="events" />

      <div className="wide admin-body">
        <p className="label">
          <Link href="/admin/events">&larr; All events</Link>
        </p>
        <h1 className="display display-md admin-h1">{e.name}</h1>

        {created ? <p className="notice notice-ok" role="status">Event created. Fill in the rest below.</p> : null}
        {saved ? <p className="notice notice-ok" role="status">Saved. The site is showing this now.</p> : null}

        <form action={save} className="admin-form">
          <fieldset className="admin-fieldset">
            <legend className="admin-h2">What it is</legend>

            <p className="field-row">
              <label className="label" htmlFor="name">Name</label>
              <input className="field" id="name" name="name" defaultValue={e.name} maxLength={120} required />
            </p>

            <p className="field-row">
              <label className="label" htmlFor="blurb">One line explaining it</label>
              <input className="field" id="blurb" name="blurb" defaultValue={e.blurb} maxLength={300} />
              <span className="field-hint">
                Essential where a ceremony is unfamiliar to some of the people invited. Assume
                nothing about what a guest already knows.
              </span>
            </p>

            <p className="field-row">
              <label className="label" htmlFor="description">Anything longer</label>
              <textarea className="field" id="description" name="description" defaultValue={e.description} maxLength={2000} rows={4} />
            </p>

            <p className="field-row">
              <label className="label" htmlFor="slug">Web name</label>
              <input className="field" id="slug" name="slug" defaultValue={e.slug} maxLength={60} />
              <span className="field-hint">
                Used in the calendar download link. Leave it and it follows the event name.
              </span>
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">When</legend>

            <div className="admin-grid">
              <p className="field-row">
                <label className="label" htmlFor="event_date">Date</label>
                <input className="field" id="event_date" name="event_date" type="date" defaultValue={e.event_date} required />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="time_mode">Times</label>
                <select className="field" id="time_mode" name="time_mode" defaultValue={e.time_mode}>
                  <option value="start_end">Start and end</option>
                  <option value="start_only">Start only</option>
                  <option value="tba">To be announced</option>
                </select>
                <span className="field-hint">
                  &ldquo;To be announced&rdquo; is a real state, not a blank. It sorts into its own
                  bucket rather than pretending to be midnight.
                </span>
              </p>
            </div>

            <div className="admin-grid admin-grid-3">
              <p className="field-row">
                <label className="label" htmlFor="start_time">Starts</label>
                <input className="field" id="start_time" name="start_time" type="time" defaultValue={hhmm(e.start_time)} />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="end_time">Ends</label>
                <input className="field" id="end_time" name="end_time" type="time" defaultValue={hhmm(e.end_time)} />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="arrive_by">Please arrive by</label>
                <input className="field" id="arrive_by" name="arrive_by" type="time" defaultValue={hhmm(e.arrive_by)} />
              </p>
            </div>

            <p className="field-row">
              <label className="label" htmlFor="timezone">Timezone</label>
              <input className="field" id="timezone" name="timezone" defaultValue={e.timezone} maxLength={60} />
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">Where</legend>

            <p className="field-row">
              <label className="label" htmlFor="venue_name">Venue</label>
              <input className="field" id="venue_name" name="venue_name" defaultValue={e.venue_name} maxLength={160} />
            </p>
            <p className="field-row">
              <label className="label" htmlFor="venue_address">Address</label>
              <input className="field" id="venue_address" name="venue_address" defaultValue={e.venue_address} maxLength={300} />
              <span className="field-hint">The Directions button is built from this.</span>
            </p>
            <p className="field-row">
              <label className="label" htmlFor="venue_map_url">Map link</label>
              <input className="field" id="venue_map_url" name="venue_map_url" type="url" defaultValue={e.venue_map_url} maxLength={400} placeholder="https://" />
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">What to wear</legend>
            <p className="admin-note">
              The most-asked question a wedding guest has, and the one they will text you about if it
              is not here.
            </p>

            <p className="field-row">
              <label className="label" htmlFor="dress_code">Dress code</label>
              <input className="field" id="dress_code" name="dress_code" defaultValue={e.dress_code} maxLength={120} placeholder="Formal, shalwar kameez" />
            </p>

            <p className="field-row">
              <label className="label" htmlFor="dress_code_note">In your own words</label>
              <textarea className="field" id="dress_code_note" name="dress_code_note" defaultValue={e.dress_code_note} maxLength={600} rows={2} />
            </p>

            <p className="field-row">
              <label className="label" htmlFor="swatches">Colours to wear</label>
              <textarea
                className="field admin-mono"
                id="swatches"
                name="swatches"
                defaultValue={wearText}
                rows={4}
                placeholder="#f4c430 Marigold"
              />
              <span className="field-hint">
                One per line: a hex colour then a name. Guests see the actual colour, not the word —
                &ldquo;yellow&rdquo; covers a lot of ground.
              </span>
            </p>

            <p className="field-row">
              <label className="label" htmlFor="avoid_colours">Colours to avoid</label>
              <textarea
                className="field admin-mono"
                id="avoid_colours"
                name="avoid_colours"
                defaultValue={avoidText}
                rows={4}
                placeholder="#ffffff White | the bride wears white at the nikkah"
              />
              <span className="field-hint">
                Same format, with an optional reason after a <code>|</code>. This is culture-specific
                knowledge a guest cannot be expected to have, so say why.
              </span>
            </p>

            <p className="field-row">
              <label className="label" htmlFor="modesty_note">Anything about covering up</label>
              <textarea className="field" id="modesty_note" name="modesty_note" defaultValue={e.modesty_note} maxLength={600} rows={2} />
              <span className="field-hint">A separate thing from the dress code, and just as load-bearing.</span>
            </p>

            <p className="field-row">
              <label className="label" htmlFor="permission_note">Permission to relax</label>
              <textarea className="field" id="permission_note" name="permission_note" defaultValue={e.permission_note} maxLength={600} rows={2} placeholder="Truly, wear what you already own." />
              <span className="field-hint">
                Only the couple can write this, and it settles an anxiety no dress code can.
              </span>
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">Food</legend>
            <p className="field-row">
              <label className="label" htmlFor="meals">Meal choices</label>
              <textarea
                className="field admin-mono"
                id="meals"
                name="meals"
                defaultValue={meals.map((m) => `${m.name}${m.description ? ` | ${m.description}` : ''}`).join('\n')}
                rows={4}
                placeholder="Chicken karahi | boneless, mild"
              />
              <span className="field-hint">
                One per line, with an optional description. Leave empty if there is no choice to make.
              </span>
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">Who sees it, and how</legend>

            <p className="admin-check">
              <input type="checkbox" id="is_public" name="is_public" defaultChecked={e.is_public} />
              <label htmlFor="is_public">Show on the public page, to anyone with no link</label>
            </p>
            <p className="admin-note admin-warn">
              Off by default and it should usually stay off. The etiquette failure here is
              over-exposure: discussing an event in front of people who are not invited to it.
            </p>

            <p className="admin-check">
              <input type="checkbox" id="rsvp_enabled" name="rsvp_enabled" defaultChecked={e.rsvp_enabled} />
              <label htmlFor="rsvp_enabled">Collect replies for this event</label>
            </p>
            <p className="admin-check">
              <input type="checkbox" id="is_main" name="is_main" defaultChecked={e.is_main} />
              <label htmlFor="is_main">This is the main event</label>
            </p>
            <p className="admin-check">
              <input type="checkbox" id="is_unplugged" name="is_unplugged" defaultChecked={e.is_unplugged} />
              <label htmlFor="is_unplugged">Unplugged — ask guests to put phones away</label>
            </p>
            <p className="admin-check">
              <input type="checkbox" id="show_directions" name="show_directions" defaultChecked={e.show_directions} />
              <label htmlFor="show_directions">Offer a Directions button</label>
            </p>
            <p className="admin-check">
              <input type="checkbox" id="show_add_to_calendar" name="show_add_to_calendar" defaultChecked={e.show_add_to_calendar} />
              <label htmlFor="show_add_to_calendar">Offer Add to calendar</label>
            </p>
            <p className="admin-check">
              <input type="checkbox" id="show_map" name="show_map" defaultChecked={e.show_map} />
              <label htmlFor="show_map">Embed a map</label>
            </p>

            <p className="field-row">
              <label className="label" htmlFor="sort_order">Order within the day</label>
              <input className="field" id="sort_order" name="sort_order" type="number" min={0} max={999} defaultValue={e.sort_order} />
              <span className="field-hint">Only used when two events share a date and a start time.</span>
            </p>
          </fieldset>

          <p className="admin-actions">
            <button className="btn" type="submit">Save</button>
          </p>
        </form>

        <div className="admin-section">
          <h2 className="admin-h2">Delete</h2>
          <details className="admin-confirm">
            <summary className="btn btn-ghost">Delete this event</summary>
            <div className="admin-confirm-body">
              <p className="admin-confirm-text">
                This removes <strong>{e.name}</strong> from every invitation link, and discards any
                replies guests have already given for it. There is no undo.
              </p>
              <form action={remove}>
                <button className="btn" type="submit">Yes, delete it</button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}
