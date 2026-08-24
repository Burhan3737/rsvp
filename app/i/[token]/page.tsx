import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WeddingPage } from '@/components/WeddingPage';
import { activeTemplate } from '@/lib/active';
import {
  getContent,
  getEventsForInvite,
  getInviteByToken,
  getSettings,
  markInviteOpened,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * A GENERIC preview card, deliberately.
 *
 * WhatsApp, iMessage, Slack and Signal all fetch a link server-side to build a preview. Without
 * this, forwarding an invitation into a family group chat would render the couple's own label for
 * that link — which is exactly the sort of thing that should not leak. The card says nothing.
 *
 * `noindex` is set explicitly rather than via a robots.txt Disallow, which would stop the crawler
 * ever seeing the noindex at all.
 */
export const metadata: Metadata = {
  title: 'Your invitation',
  description: 'Open your invitation for the schedule and to reply.',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true, nocache: true },
  openGraph: {
    title: 'Your invitation',
    description: 'Open your invitation for the schedule and to reply.',
  },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  // Unknown, revoked and expired links are indistinguishable from here, so probing teaches nothing.
  if (!invite) notFound();

  await markInviteOpened(invite.id);

  const [settings, events, faqs, travel, story, party, things] = await Promise.all([
    getSettings(),
    getEventsForInvite(invite.id),
    getContent('faq'),
    getContent('travel'),
    getContent('story'),
    getContent('party'),
    getContent('things_to_do'),
  ]);
  const template = await activeTemplate(settings.template);

  return (
    <WeddingPage
      settings={settings}
      events={events}
      faqs={faqs}
      travel={travel}
      template={template}
      story={story}
      party={party}
      things={things}
      identified
      rsvpHref={`/i/${token}/rsvp`}
      calendarBase={`/i/${token}/calendar`}
    />
  );
}
