import { isAdmin } from '@/lib/auth';
import { getExportRows } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * The caterer handoff.
 *
 * One row per person per event, fully denormalised, with attendance, meal, dietary and access in
 * their own columns. This is deliberately the shape a caterer or planner can use directly — the
 * documented failure of at least one commercial product is an export where per-person meal choices
 * do not land in clean columns, which makes the whole feature useless at the moment it matters.
 */

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = Array.isArray(value) ? value.join('; ') : String(value);
  // Excel interprets a leading =, +, - or @ as a formula. Prefix with a quote to neutralise it.
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export async function GET() {
  // Re-verified here: a route handler is not covered by any page-level gate.
  if (!(await isAdmin())) {
    return new Response('Not found', { status: 404 });
  }

  const rows = await getExportRows();

  const header = [
    'Invite', 'Name', 'Child', 'Event', 'Status', 'Meal',
    'Dietary tags', 'Allergy / medical', 'Preference', 'Access needs', 'Email', 'Phone',
  ];

  const body = rows.map((r) =>
    [
      r.invite_label, r.attendee_name, r.is_child ? 'yes' : '', r.event_name, r.status,
      r.meal ?? '', r.dietary_tags, r.dietary_medical, r.dietary_preference, r.accessibility,
      r.contact_email, r.contact_phone,
    ]
      .map(csvEscape)
      .join(','),
  );

  // A UTF-8 BOM so Excel on Windows renders accented names correctly instead of mojibake.
  const csv = '﻿' + [header.map(csvEscape).join(','), ...body].join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="guest-list.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
