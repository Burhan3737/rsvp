import { getEventsForInvite, getInviteByToken, getSettings } from '@/lib/queries';
import { toIcsCalendar } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Per-link calendar.
 *
 * Scoped through the same visibility query as the schedule page, so a .ics can never contain an
 * event the link does not show. Calendar export is an easy place to leak a private event without
 * anyone noticing, because nobody opens the file to check.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; slug: string }> },
) {
  const { token, slug } = await params;
  const invite = await getInviteByToken(token);
  if (!invite) return new Response('Not found', { status: 404 });

  const [settings, events] = await Promise.all([getSettings(), getEventsForInvite(invite.id)]);
  const event = events.find((e) => e.slug === slug);
  if (!event) return new Response('Not found', { status: 404 });

  return new Response(toIcsCalendar([event], settings.couple_names), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
