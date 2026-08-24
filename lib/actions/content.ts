'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

/**
 * Editing the wedding itself — the settings, the events, and the prose blocks.
 *
 * Until now the only way to change a venue or a time was to edit `scripts/seed.mjs` and reseed the
 * database, which meant a code change and a deploy for a phone call from a caterer. The README
 * already promised otherwise ("no redeploy needed to change a time or a venue"); this is the half
 * of the product that makes that true.
 *
 * Three rules hold everywhere in this file:
 *
 *  1. `isAdmin()` is re-checked inside EVERY action. There is no proxy or middleware in this app,
 *     and Next's own docs warn that route-prefix protection can be silently removed by a refactor.
 *     A Server Action is a public HTTP endpoint; being exported from a page under /admin protects
 *     nothing at all.
 *
 *  2. Every value is parsed and clamped here rather than trusted from the form. The browser's own
 *     `required`, `maxlength` and `type="date"` are conveniences for the person typing, not
 *     constraints on what arrives.
 *
 *  3. Writes call `revalidatePath('/', 'layout')`. Guest pages are `force-dynamic`, so they already
 *     re-read on each request, but the layout caches the theme and settings — without this an owner
 *     changes the date, looks at the site, and sees the old one.
 */

/** Trim, cap, and never return undefined. */
function text(form: FormData, key: string, max = 400): string {
  return String(form.get(key) ?? '').trim().slice(0, max);
}

function bool(form: FormData, key: string): boolean {
  // An unchecked checkbox sends nothing at all, which is the whole reason this is a helper.
  return form.get(key) != null;
}

/** A date input arrives as YYYY-MM-DD, or empty. Anything else becomes null rather than throwing. */
function date(form: FormData, key: string): string | null {
  const v = text(form, key, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** A time input arrives as HH:MM (some browsers add :SS). Empty and malformed both become null. */
function time(form: FormData, key: string): string | null {
  const v = text(form, key, 8);
  return /^\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : null;
}

function int(form: FormData, key: string, min: number, max: number, fallback: number): number {
  const n = Number(form.get(key));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * A URL-safe slug, used in the calendar route (`/i/<token>/calendar/<slug>`) and as the event's
 * stable public name. Derived from the title when the owner has not written one.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** `slug` is UNIQUE, so a second "Mehndi" needs a suffix rather than a 500. */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = base || 'event';
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const clash = await queryOne<{ id: string }>(
      `SELECT id FROM events WHERE slug = $1 ${exceptId ? 'AND id <> $2' : ''} LIMIT 1`,
      exceptId ? [candidate, exceptId] : [candidate],
    );
    if (!clash) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/**
 * Colour swatches, parsed out of one textarea.
 *
 * One line per colour: `#RRGGBB  Label  |  why to avoid it`. A textarea rather than a repeating
 * field set because these are edited rarely, in batches, and usually pasted from a note — and
 * because a JS-driven repeater would stop working in exactly the in-app browsers this project
 * builds for. Lines that carry no valid hex are dropped rather than stored as broken swatches: a
 * malformed hex renders as a transparent dot beside a colour name, which is worse than absent.
 */
function parseSwatches(raw: string, withReason: boolean) {
  const out: { hex: string; label: string; why?: string }[] = [];
  for (const line of raw.split('\n').slice(0, 24)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const hex = trimmed.match(/#[0-9a-fA-F]{6}\b/)?.[0];
    if (!hex) continue;
    const rest = trimmed.replace(hex, '').trim().replace(/^[-–—:,]\s*/, '');
    const [label, why] = rest.split('|').map((p) => p.trim());
    const entry: { hex: string; label: string; why?: string } = {
      hex: hex.toLowerCase(),
      label: (label || 'Colour').slice(0, 60),
    };
    if (withReason && why) entry.why = why.slice(0, 160);
    out.push(entry);
  }
  return out;
}

/** Render swatches back into the textarea format, so the round trip is lossless. */
export async function swatchesToText(
  list: { hex: string; label: string; why?: string }[],
): Promise<string> {
  return (list ?? [])
    .map((s) => `${s.hex} ${s.label}${s.why ? ` | ${s.why}` : ''}`)
    .join('\n');
}

async function gate() {
  if (!(await isAdmin())) redirect('/admin/login');
}

/** Guest pages read settings and theme through the layout, which caches. */
function published() {
  revalidatePath('/', 'layout');
}

/* ------------------------------------------------------------------ Settings */

export async function saveSettings(formData: FormData): Promise<void> {
  await gate();

  const partnerA = text(formData, 'partner_a', 80);
  const partnerB = text(formData, 'partner_b', 80);
  // Kept in step automatically: `couple_names` is what the footer, the page title and the link
  // preview use, and an owner who renames a partner should not have to remember a second field.
  const couple = text(formData, 'couple_names', 160) || [partnerA, partnerB].filter(Boolean).join(' & ');

  await query(
    `UPDATE site_settings SET
       couple_names = $1, partner_a = $2, partner_b = $3, tagline = $4, script_line = $5,
       welcome_note = $6, primary_date = $7, timezone = $8, rsvp_deadline = $9, grace_hours = $10,
       show_deadline = $11, post_deadline_message = $12, owner_email = $13, contact_name = $14,
       contact_phone = $15, contact_email = $16, site_is_public = $17, registry_url = $18,
       registry_note = $19, updated_at = now()
     WHERE id = 1`,
    [
      couple,
      partnerA,
      partnerB,
      text(formData, 'tagline', 160),
      text(formData, 'script_line', 120),
      text(formData, 'welcome_note', 2000),
      date(formData, 'primary_date'),
      text(formData, 'timezone', 60) || 'Asia/Karachi',
      date(formData, 'rsvp_deadline'),
      int(formData, 'grace_hours', 0, 168, 24),
      bool(formData, 'show_deadline'),
      text(formData, 'post_deadline_message', 1000),
      text(formData, 'owner_email', 160),
      text(formData, 'contact_name', 120),
      text(formData, 'contact_phone', 40),
      text(formData, 'contact_email', 160),
      bool(formData, 'site_is_public'),
      text(formData, 'registry_url', 400),
      text(formData, 'registry_note', 1000),
    ],
  );

  published();
  redirect('/admin/content?saved=1');
}

/* -------------------------------------------------------------------- Events */

export async function createEvent(formData: FormData): Promise<void> {
  await gate();
  const name = text(formData, 'name', 120) || 'New event';
  const slug = await uniqueSlug(slugify(name));
  const when = date(formData, 'event_date');

  const row = await queryOne<{ id: string }>(
    `INSERT INTO events (slug, name, event_date, sort_order)
     VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), COALESCE((SELECT max(sort_order) + 1 FROM events), 0))
     RETURNING id`,
    [slug, name, when],
  );

  published();
  redirect(`/admin/events/${row!.id}?created=1`);
}

export async function saveEvent(eventId: string, formData: FormData): Promise<void> {
  await gate();

  const name = text(formData, 'name', 120) || 'Untitled event';
  const typedSlug = text(formData, 'slug', 60);
  const slug = await uniqueSlug(slugify(typedSlug || name), eventId);

  const mode = text(formData, 'time_mode', 12);
  const timeMode = (['start_only', 'start_end', 'tba'] as const).includes(mode as never)
    ? mode
    : 'start_end';

  // A TBA event has no times, and a start-only event has no end. Storing them anyway means the
  // schedule can render a stale end time the moment an owner switches the mode back.
  const start = timeMode === 'tba' ? null : time(formData, 'start_time');
  const end = timeMode === 'start_end' ? time(formData, 'end_time') : null;

  await query(
    `UPDATE events SET
       slug = $2, name = $3, blurb = $4, description = $5, event_date = COALESCE($6::date, event_date),
       time_mode = $7, start_time = $8, end_time = $9, arrive_by = $10, timezone = $11,
       venue_name = $12, venue_address = $13, venue_map_url = $14,
       dress_code = $15, dress_code_note = $16, modesty_note = $17, permission_note = $18,
       swatches = $19::jsonb, avoid_colours = $20::jsonb,
       is_public = $21, rsvp_enabled = $22, is_main = $23, is_unplugged = $24,
       show_map = $25, show_directions = $26, show_add_to_calendar = $27, sort_order = $28
     WHERE id = $1`,
    [
      eventId,
      slug,
      name,
      text(formData, 'blurb', 300),
      text(formData, 'description', 2000),
      date(formData, 'event_date'),
      timeMode,
      start,
      end,
      time(formData, 'arrive_by'),
      text(formData, 'timezone', 60) || 'Asia/Karachi',
      text(formData, 'venue_name', 160),
      text(formData, 'venue_address', 300),
      text(formData, 'venue_map_url', 400),
      text(formData, 'dress_code', 120),
      text(formData, 'dress_code_note', 600),
      text(formData, 'modesty_note', 600),
      text(formData, 'permission_note', 600),
      JSON.stringify(parseSwatches(text(formData, 'swatches', 2000), false)),
      JSON.stringify(parseSwatches(text(formData, 'avoid_colours', 2000), true)),
      bool(formData, 'is_public'),
      bool(formData, 'rsvp_enabled'),
      bool(formData, 'is_main'),
      bool(formData, 'is_unplugged'),
      bool(formData, 'show_map'),
      bool(formData, 'show_directions'),
      bool(formData, 'show_add_to_calendar'),
      int(formData, 'sort_order', 0, 999, 0),
    ],
  );

  // Meal options, replaced wholesale — one per line, `Name | description`.
  const meals = text(formData, 'meals', 2000)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);
  await query(`DELETE FROM meal_options WHERE event_id = $1`, [eventId]);
  for (const [i, line] of meals.entries()) {
    const [mealName, description] = line.split('|').map((p) => p.trim());
    await query(
      `INSERT INTO meal_options (event_id, name, description, sort_order) VALUES ($1,$2,$3,$4)`,
      [eventId, (mealName || 'Option').slice(0, 120), (description ?? '').slice(0, 300), i],
    );
  }

  published();
  redirect(`/admin/events/${eventId}?saved=1`);
}

export async function deleteEvent(eventId: string): Promise<void> {
  await gate();
  // `invite_events` and `meal_options` cascade. Responses reference the event too, so deleting an
  // event a guest has already replied to discards that reply — which is why the button asks first.
  await query(`DELETE FROM events WHERE id = $1`, [eventId]);
  published();
  redirect('/admin/events?deleted=1');
}

/* ------------------------------------------------------------ Content blocks */

const SECTIONS = ['faq', 'travel', 'things_to_do', 'story', 'party'] as const;
export type Section = (typeof SECTIONS)[number];

function section(form: FormData): Section {
  const s = text(form, 'section', 20);
  return (SECTIONS as readonly string[]).includes(s) ? (s as Section) : 'faq';
}

export async function createBlock(formData: FormData): Promise<void> {
  await gate();
  const sec = section(formData);
  await query(
    `INSERT INTO content_blocks (section, title, meta, body, link_url, link_label, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE((SELECT max(sort_order) + 1 FROM content_blocks WHERE section = $1), 0))`,
    [
      sec,
      text(formData, 'title', 200) || 'Untitled',
      text(formData, 'meta', 120),
      text(formData, 'body', 3000),
      text(formData, 'link_url', 400),
      text(formData, 'link_label', 80),
    ],
  );
  published();
  redirect(`/admin/pages?section=${sec}&saved=1`);
}

export async function saveBlock(blockId: string, formData: FormData): Promise<void> {
  await gate();
  const sec = section(formData);
  await query(
    `UPDATE content_blocks SET title = $2, meta = $3, body = $4, link_url = $5, link_label = $6,
       visible = $7, sort_order = $8
     WHERE id = $1`,
    [
      blockId,
      text(formData, 'title', 200) || 'Untitled',
      text(formData, 'meta', 120),
      text(formData, 'body', 3000),
      text(formData, 'link_url', 400),
      text(formData, 'link_label', 80),
      bool(formData, 'visible'),
      int(formData, 'sort_order', 0, 999, 0),
    ],
  );
  published();
  redirect(`/admin/pages?section=${sec}&saved=1`);
}

export async function deleteBlock(blockId: string, sec: string): Promise<void> {
  await gate();
  await query(`DELETE FROM content_blocks WHERE id = $1`, [blockId]);
  published();
  redirect(`/admin/pages?section=${sec}&deleted=1`);
}
