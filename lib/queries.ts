import 'server-only';
import { query, queryOne } from '@/lib/db';

/**
 * Data access.
 *
 * Visibility rule, in full: **an invite link shows exactly the events listed in `invite_events`,
 * plus any event flagged `is_public`.** There is no guest list, no tags, and no name matching —
 * which is why there is no fuzzy-matching code anywhere in this file.
 */

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  description: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  arrive_by: string | null;
  timezone: string;
  venue_name: string;
  venue_address: string;
  venue_map_url: string;
  dress_code: string;
  dress_code_note: string;
  modesty_note: string;
  permission_note: string;
  swatches: { hex: string; label: string }[];
  avoid_colours: { hex: string; label: string; why?: string }[];
  is_public: boolean;
  rsvp_enabled: boolean;
  is_main: boolean;
  is_unplugged: boolean;
  show_map: boolean;
  show_directions: boolean;
  show_add_to_calendar: boolean;
  time_mode: 'start_only' | 'start_end' | 'tba';
  accent_hex: string;
  sort_order: number;
}

export interface InviteRow {
  id: string;
  label: string;
  note: string;
  token: string;
  code: string;
  max_guests: number;
  revoked_at: string | null;
  expires_at: string | null;
}

const EVENT_COLUMNS = `e.id, e.slug, e.name, e.blurb, e.description, e.event_date, e.start_time,
  e.end_time, e.arrive_by, e.timezone, e.venue_name, e.venue_address, e.venue_map_url, e.dress_code,
  e.dress_code_note, e.modesty_note, e.permission_note, e.swatches, e.avoid_colours, e.is_public,
  e.rsvp_enabled, e.is_main, e.is_unplugged, e.show_map, e.show_directions,
  e.show_add_to_calendar, e.time_mode, e.accent_hex, e.sort_order`;

// TBA sorts last within its day. We never invent a timestamp to make an unscheduled event sort.
const EVENT_ORDER = `ORDER BY e.event_date,
  CASE WHEN e.time_mode = 'tba' THEN 1 ELSE 0 END,
  e.start_time NULLS LAST, e.sort_order, e.name`;

/** Events a visitor with no link may see. */
export async function getPublicEvents(): Promise<EventRow[]> {
  return query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events e WHERE e.is_public = true ${EVENT_ORDER}`,
  );
}

/** Every event, for the admin. */
export async function getAllEvents(): Promise<EventRow[]> {
  return query<EventRow>(`SELECT ${EVENT_COLUMNS} FROM events e ${EVENT_ORDER}`);
}

/**
 * Resolve a link.
 * Unknown, revoked and expired tokens are indistinguishable from here, so probing learns nothing.
 */
export async function getInviteByToken(token: string): Promise<InviteRow | null> {
  if (!token || token.length < 16 || token.length > 64) return null;
  return queryOne<InviteRow>(
    `SELECT id, label, note, token, code, max_guests, revoked_at, expires_at
       FROM invites
      WHERE token = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
    [token],
  );
}

export async function getInviteByCode(code: string): Promise<InviteRow | null> {
  if (!code) return null;
  return queryOne<InviteRow>(
    `SELECT id, label, note, token, code, max_guests, revoked_at, expires_at
       FROM invites
      WHERE code = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
    [code],
  );
}

/** Record that a link has been opened at least once. Useful when chasing non-responders. */
export async function markInviteOpened(inviteId: string): Promise<void> {
  await query(`UPDATE invites SET opened_at = COALESCE(opened_at, now()) WHERE id = $1`, [inviteId]);
}

/**
 * What this link shows: its own events, plus anything public.
 *
 * Filtered SERVER-SIDE. We never ship every event to the client and hide the private ones with
 * CSS — that would put the full schedule in view-source for anyone who looks.
 */
export async function getEventsForInvite(inviteId: string): Promise<EventRow[]> {
  return query<EventRow>(
    `SELECT ${EVENT_COLUMNS}
       FROM events e
      WHERE e.is_public = true
         OR EXISTS (SELECT 1 FROM invite_events ie WHERE ie.event_id = e.id AND ie.invite_id = $1)
      ${EVENT_ORDER}`,
    [inviteId],
  );
}

/** Events this link may actually reply to: on the link, and collecting replies. */
export async function getRsvpEventsForInvite(inviteId: string): Promise<EventRow[]> {
  return query<EventRow>(
    `SELECT ${EVENT_COLUMNS}
       FROM events e
       JOIN invite_events ie ON ie.event_id = e.id AND ie.invite_id = $1
      WHERE e.rsvp_enabled = true
      ${EVENT_ORDER}`,
    [inviteId],
  );
}

/** Is this event on this link? Used to validate a submitted form against the database. */
export async function inviteHasEvent(inviteId: string, eventId: string): Promise<boolean> {
  const row = await queryOne<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM invite_events WHERE invite_id = $1 AND event_id = $2) AS ok`,
    [inviteId, eventId],
  );
  return Boolean(row?.ok);
}

// ---------------------------------------------------------------------------
// The reply
// ---------------------------------------------------------------------------

export interface MealOption {
  id: string;
  event_id: string;
  name: string;
  description: string;
  audience: 'adult' | 'child' | 'any';
}

export interface AttendeeRow {
  id: string;
  slot: number;
  name: string;
  is_child: boolean;
  dietary_tags: string[];
  dietary_medical: string;
  dietary_preference: string;
  accessibility: string;
}

export interface ResponseRow {
  id: string;
  invite_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  arrival_date: string | null;
  departure_date: string | null;
  travelling_from: string;
  needs_shuttle: boolean | null;
  needs_accommodation: boolean | null;
  song_request: string;
  message: string;
  submitted_at: string;
}

export interface AttendanceCell {
  attendee_id: string;
  event_id: string;
  status: 'attending' | 'declined';
  meal_option_id: string | null;
}

export interface RsvpData {
  events: (EventRow & { meals: MealOption[] })[];
  response: ResponseRow | null;
  attendees: AttendeeRow[];
  attendance: Map<string, AttendanceCell>;
}

export const cellKey = (attendeeSlotOrId: string | number, eventId: string) =>
  `${attendeeSlotOrId}:${eventId}`;

export async function getRsvpData(inviteId: string): Promise<RsvpData> {
  const events = await getRsvpEventsForInvite(inviteId);
  const eventIds = events.map((e) => e.id);

  const meals = eventIds.length
    ? await query<MealOption>(
        `SELECT id, event_id, name, description, audience FROM meal_options
          WHERE event_id = ANY($1::uuid[]) ORDER BY sort_order, name`,
        [eventIds],
      )
    : [];

  const response = await queryOne<ResponseRow>(
    `SELECT id, invite_id, contact_name, contact_email, contact_phone, arrival_date, departure_date,
            travelling_from, needs_shuttle, needs_accommodation, song_request, message, submitted_at
       FROM responses WHERE invite_id = $1`,
    [inviteId],
  );

  const attendees = response
    ? await query<AttendeeRow>(
        `SELECT id, slot, name, is_child, dietary_tags, dietary_medical, dietary_preference,
                accessibility
           FROM attendees WHERE response_id = $1 ORDER BY slot`,
        [response.id],
      )
    : [];

  const attendance = attendees.length
    ? await query<AttendanceCell>(
        `SELECT attendee_id, event_id, status, meal_option_id
           FROM attendance WHERE attendee_id = ANY($1::uuid[])`,
        [attendees.map((a) => a.id)],
      )
    : [];

  // Keyed by SLOT, not attendee id: the form is a fixed grid of slots and the attendee rows are
  // rebuilt on every submission, so slot is the stable identifier across a re-render.
  const bySlot = new Map(attendees.map((a) => [a.id, a.slot]));

  return {
    events: events.map((e) => ({ ...e, meals: meals.filter((m) => m.event_id === e.id) })),
    response,
    attendees,
    attendance: new Map(
      attendance.map((c) => [cellKey(bySlot.get(c.attendee_id) ?? -1, c.event_id), c]),
    ),
  };
}

/** Meal options appropriate to an attendee's age band. */
export function mealsFor(meals: MealOption[], isChild: boolean): MealOption[] {
  return meals.filter(
    (m) => m.audience === 'any' || (isChild ? m.audience === 'child' : m.audience === 'adult'),
  );
}

// ---------------------------------------------------------------------------
// Settings and content
// ---------------------------------------------------------------------------

export interface Settings {
  couple_names: string;
  partner_a: string;
  partner_b: string;
  tagline: string;
  script_line: string;
  welcome_note: string;
  theme: string;
  /** Structure, chosen independently of the theme. See lib/templates.ts. */
  template: string;
  primary_date: string | null;
  timezone: string;
  rsvp_deadline: string | null;
  grace_hours: number;
  show_deadline: boolean;
  post_deadline_message: string;
  owner_email: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  site_is_public: boolean;
  show_our_story: boolean;
  registry_url: string;
  registry_note: string;
}

/**
 * The two `date` columns are cast to text rather than coming back through `SELECT *`.
 *
 * Both drivers hand a Postgres `date` back as a JS Date object, so the declared
 * `primary_date: string | null` above was simply untrue at runtime. Guest-facing code never
 * noticed because it all routes through `toIsoDate()`, which was written to absorb exactly this —
 * but anything reading the value directly gets a Date, and `String()` on a Date renders it in the
 * RUNNER'S timezone. A wedding stored as 2027-02-27 stringifies to "Fri Feb 26 2027" anywhere west
 * of UTC, one day early.
 *
 * That is what an `<input type="date">` in the admin was handed. It rejects anything that is not
 * `YYYY-MM-DD`, rendered blank, and the next save wrote the blank back — silently clearing the
 * wedding date and the reply deadline. Casting here makes the type honest at the boundary and
 * leaves `toIsoDate()` as a harmless no-op for these two fields.
 */
const SETTINGS_COLUMNS = `
  couple_names, partner_a, partner_b, tagline, script_line, welcome_note, theme, template,
  primary_date::text AS primary_date, timezone, rsvp_deadline::text AS rsvp_deadline,
  grace_hours, show_deadline, post_deadline_message, owner_email, contact_name, contact_phone,
  contact_email, site_is_public, show_our_story, registry_url, registry_note`;

export async function getSettings(): Promise<Settings> {
  const row = await queryOne<Settings>(
    `SELECT ${SETTINGS_COLUMNS} FROM site_settings WHERE id = 1`,
  );
  if (row) return row;
  await query(`INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  return (await queryOne<Settings>(
    `SELECT ${SETTINGS_COLUMNS} FROM site_settings WHERE id = 1`,
  ))!;
}

export interface ContentBlock {
  id: string;
  section: string;
  title: string;
  /** A short line above the title: a date on a story beat, a role on a party member. */
  meta: string;
  body: string;
  link_url: string;
  link_label: string;
  sort_order: number;
}

export async function getContent(section: string): Promise<ContentBlock[]> {
  return query<ContentBlock>(
    `SELECT id, section, title, meta, body, link_url, link_label, sort_order
       FROM content_blocks WHERE section = $1 AND visible = true ORDER BY sort_order, title`,
    [section],
  );
}

/**
 * Deadline check, server-side only. Never trust the client clock.
 * The deadline ends at midnight in the WEDDING's timezone, then a grace period absorbs guests
 * replying "on the last day" from somewhere the date has already rolled over.
 */
export function isPastDeadline(settings: Settings, now: Date = new Date()): boolean {
  if (!settings.rsvp_deadline) return false;
  const deadline = new Date(`${String(settings.rsvp_deadline).slice(0, 10)}T23:59:59Z`);
  deadline.setUTCHours(deadline.getUTCHours() + (settings.grace_hours ?? 0));
  return now > deadline;
}

// ---------------------------------------------------------------------------
// Admin reporting
// ---------------------------------------------------------------------------

export interface EventTally {
  id: string;
  name: string;
  event_date: string;
  is_public: boolean;
  rsvp_enabled: boolean;
  links: number;
  attending: number;
  declined: number;
  awaiting: number;
}

/**
 * Attending / Declined / Awaiting, per event.
 *
 * "Awaiting" is the number that matters — chasing non-responders is described in every real account
 * as the worst part of planning a wedding. It counts LINKS, because until somebody replies we
 * genuinely do not know how many people are behind a link.
 */
export async function getEventTallies(): Promise<EventTally[]> {
  return query<EventTally>(
    `SELECT e.id, e.name, e.event_date, e.is_public, e.rsvp_enabled,
       (SELECT count(*)::int FROM invite_events ie WHERE ie.event_id = e.id) AS links,
       (SELECT count(*)::int FROM attendance a WHERE a.event_id = e.id AND a.status = 'attending') AS attending,
       (SELECT count(*)::int FROM attendance a WHERE a.event_id = e.id AND a.status = 'declined') AS declined,
       (SELECT count(*)::int FROM invite_events ie
          WHERE ie.event_id = e.id
            AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.invite_id = ie.invite_id)) AS awaiting
     FROM events e
     ${EVENT_ORDER}`,
  );
}

export interface MealTally {
  event_name: string;
  meal_name: string;
  n: number;
}

/** Meal counts an owner can read to a caterer over the phone. */
export async function getMealTallies(): Promise<MealTally[]> {
  return query<MealTally>(
    `SELECT e.name AS event_name, m.name AS meal_name, count(*)::int AS n
       FROM attendance a
       JOIN meal_options m ON m.id = a.meal_option_id
       JOIN events e ON e.id = a.event_id
      WHERE a.status = 'attending'
      GROUP BY e.name, m.name, m.sort_order, e.event_date
      ORDER BY e.event_date, m.sort_order`,
  );
}

export interface InviteSummary {
  id: string;
  label: string;
  note: string;
  token: string;
  code: string;
  max_guests: number;
  revoked_at: string | null;
  opened_at: string | null;
  event_count: number;
  event_names: string[];
  responded: boolean;
  head_count: number;
  contact_name: string | null;
  contact_email: string | null;
}

/** The admin's main table: every link, what it shows, and whether it has replied. */
export async function getInviteSummaries(): Promise<InviteSummary[]> {
  return query<InviteSummary>(
    `SELECT i.id, i.label, i.note, i.token, i.code, i.max_guests, i.revoked_at, i.opened_at,
       (SELECT count(*)::int FROM invite_events ie WHERE ie.invite_id = i.id) AS event_count,
       ARRAY(SELECT e.name FROM invite_events ie JOIN events e ON e.id = ie.event_id
              WHERE ie.invite_id = i.id ORDER BY e.event_date, e.sort_order) AS event_names,
       (r.id IS NOT NULL) AS responded,
       COALESCE((SELECT count(DISTINCT at.id)::int FROM attendees at
                   JOIN attendance an ON an.attendee_id = at.id AND an.status = 'attending'
                  WHERE at.response_id = r.id), 0) AS head_count,
       r.contact_name, r.contact_email
     FROM invites i
     LEFT JOIN responses r ON r.invite_id = i.id
     ORDER BY i.created_at`,
  );
}

export async function getInviteWithEvents(inviteId: string) {
  const invite = await queryOne<InviteRow & { opened_at: string | null }>(
    `SELECT id, label, note, token, code, max_guests, revoked_at, expires_at, opened_at
       FROM invites WHERE id = $1`,
    [inviteId],
  );
  if (!invite) return null;
  const rows = await query<{ event_id: string }>(
    `SELECT event_id FROM invite_events WHERE invite_id = $1`,
    [inviteId],
  );
  return { invite, eventIds: new Set(rows.map((r) => r.event_id)) };
}

export interface ExportRow {
  invite_label: string;
  attendee_name: string;
  is_child: boolean;
  event_name: string;
  status: string;
  meal: string | null;
  dietary_tags: string[];
  dietary_medical: string;
  dietary_preference: string;
  accessibility: string;
  contact_email: string;
  contact_phone: string;
}

/**
 * The caterer handoff: one row per person per event, fully denormalised.
 * At least one commercial product is reviewed as failing to export per-person meal choices into
 * clean columns, which makes the whole feature useless at the moment it matters.
 */
export async function getExportRows(): Promise<ExportRow[]> {
  return query<ExportRow>(
    `SELECT i.label AS invite_label, at.name AS attendee_name, at.is_child,
            e.name AS event_name, an.status, m.name AS meal,
            at.dietary_tags, at.dietary_medical, at.dietary_preference, at.accessibility,
            r.contact_email, r.contact_phone
       FROM attendees at
       JOIN responses r ON r.id = at.response_id
       JOIN invites i ON i.id = r.invite_id
       JOIN attendance an ON an.attendee_id = at.id
       JOIN events e ON e.id = an.event_id
       LEFT JOIN meal_options m ON m.id = an.meal_option_id
      ORDER BY i.label, at.slot, e.event_date`,
  );
}

export interface MessageRow {
  id: string;
  invite_id: string | null;
  from_name: string;
  contact: string;
  body: string;
  status: string;
  created_at: string;
}

export async function getMessages(): Promise<MessageRow[]> {
  return query<MessageRow>(
    `SELECT id, invite_id, from_name, contact, body, status, created_at
       FROM messages ORDER BY created_at DESC LIMIT 200`,
  );
}
