import { getPublicEvents, getSettings } from '@/lib/queries';
import { toIcsCalendar } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Public calendar: only ever the events any visitor may already see. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [settings, events] = await Promise.all([getSettings(), getPublicEvents()]);
  const event = events.find((e) => e.slug === slug);
  if (!event) return new Response('Not found', { status: 404 });

  return new Response(toIcsCalendar([event], settings.couple_names), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
