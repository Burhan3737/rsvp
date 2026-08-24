import { WeddingPage } from '@/components/WeddingPage';
import { activeTemplate } from '@/lib/active';
import { getContent, getPublicEvents, getSettings } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * The public front door.
 *
 * Anyone arriving without an invitation link sees only the events explicitly marked public. This
 * page must stay genuinely useful on its own — an anonymous visitor is usually a real guest who
 * lost their link, not an intruder.
 */
export default async function Home() {
  const [settings, events, faqs, travel, story, party, things] = await Promise.all([
    getSettings(),
    getPublicEvents(),
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
      story={story}
      party={party}
      things={things}
      template={template}
    />
  );
}
