import 'server-only';
import type { Settings } from '@/lib/queries';

/**
 * Owner notification, behind a one-function adapter.
 *
 * Vendor choice is an env var, not a code change. The research on free tiers was explicitly shaky
 * on the exact sending constraints (Resend's docs say "You must add and verify at least one domain
 * to send emails", which contradicts the widely-repeated claim that the shared onboarding sender
 * works to your own address), so this must stay swappable without touching the call site.
 *
 * With EMAIL_PROVIDER unset it logs and returns — the app is fully functional without email, which
 * is what lets the whole thing run on a free tier with nothing configured.
 */

interface NotifyArgs {
  settings: Settings;
  /** The owner's own label for the link — never shown to the guest. */
  inviteLabel: string;
  /** The names the guest typed in. */
  names: string[];
  attending: number;
  declined: number;
  message?: string;
}

function buildBody(a: NotifyArgs): { subject: string; text: string } {
  const subject = `RSVP: ${a.inviteLabel}`;
  const lines = [
    `${a.inviteLabel} has replied.`,
    '',
    a.names.length ? `Who: ${a.names.join(', ')}` : 'Who: nobody named yet',
    `Attending: ${a.attending} event response(s)`,
    `Declined:  ${a.declined} event response(s)`,
  ];
  if (a.message) lines.push('', 'They left a message:', a.message);
  lines.push('', 'Open the admin dashboard for the full breakdown.');
  return { subject, text: lines.join('\n') };
}

export async function notifyOwnerOfRsvp(args: NotifyArgs): Promise<void> {
  const to = process.env.OWNER_EMAIL || args.settings.owner_email;
  if (!to) return;

  const provider = (process.env.EMAIL_PROVIDER ?? '').toLowerCase();
  const { subject, text } = buildBody(args);

  if (!provider) {
    console.info(`[email] (no provider configured) would notify ${to}: ${subject}`);
    return;
  }

  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  if (provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    // ALWAYS inspect the response. Resend returns a 403 for a recipient it will not send to, and a
    // silent failure here means the couple simply never learns anyone replied.
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return;
  }

  if (provider === 'postmark') {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': process.env.POSTMARK_TOKEN ?? '',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ From: from, To: to, Subject: subject, TextBody: text, MessageStream: 'outbound' }),
    });
    if (!res.ok) throw new Error(`Postmark ${res.status}: ${await res.text()}`);
    return;
  }

  console.warn(`[email] unknown EMAIL_PROVIDER "${provider}" — response was saved, no mail sent.`);
}
