import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { query, queryOne } from '@/lib/db';
import { getInviteByCode, getSettings } from '@/lib/queries';
import { formatCode, hashIp, normaliseCode } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Open your invitation',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true, nocache: true },
};

/**
 * The fallback way in, for somebody who has the printed card but not the link.
 *
 * There is no name lookup here, because there is no guest list to look names up in. That is a
 * feature: name matching is the wedding industry's worst failure mode — a WeddingWire user reported
 * it failing on "about 20% of invites", and both market leaders match strictly enough that "Chris"
 * will never find "Christopher". A code you can read off a card cannot fail that way.
 */
async function openByCode(formData: FormData) {
  'use server';

  // Serverless has no shared memory, so the attempt counter lives in the database.
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const ipHash = hashIp(ip);

  const recent = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM attempts
      WHERE kind = 'code' AND ip_hash = $1 AND at > now() - interval '10 minutes'`,
    [ipHash],
  );
  if (Number(recent?.n ?? 0) >= 8) redirect('/find?e=slow');

  const code = normaliseCode(String(formData.get('code') ?? ''));
  if (code.length !== 10) {
    await query(`INSERT INTO attempts (kind, ip_hash) VALUES ('code', $1)`, [ipHash]);
    redirect('/find?e=bad');
  }

  const invite = await getInviteByCode(code);
  if (!invite) {
    await query(`INSERT INTO attempts (kind, ip_hash) VALUES ('code', $1)`, [ipHash]);
    redirect('/find?e=bad');
  }

  // A correct code clears the slate; only failures should count towards a lockout.
  await query(`DELETE FROM attempts WHERE kind = 'code' AND ip_hash = $1`, [ipHash]);
  redirect(`/i/${invite.token}`);
}

async function sendMessage(formData: FormData) {
  'use server';
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000);
  if (!body) redirect('/find?e=nomessage');
  await query(
    `INSERT INTO messages (from_name, contact, body) VALUES ($1,$2,$3)`,
    [
      String(formData.get('from_name') ?? '').trim().slice(0, 120),
      String(formData.get('contact') ?? '').trim().slice(0, 200),
      body,
    ],
  );
  redirect('/find?sent=1');
}

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; sent?: string }>;
}) {
  const { e, sent } = await searchParams;
  const settings = await getSettings();

  return (
    <main id="main" className="section">
      <div className="shell find-shell">
        <p className="label">
          <Link href="/">&larr; Back</Link>
        </p>

        <h1 className="display display-lg section-title">Open your invitation</h1>

        <p className="prose muted">
          Your invitation has its own link. If you still have the message we sent, open that. If you
          only have the printed card, type the code from it below — capitals and dashes do not
          matter.
        </p>

        <form action={openByCode} className="find-form">
          <p className="field-row">
            <label className="label" htmlFor="code">
              Invitation code
            </label>
            <input
              id="code"
              name="code"
              className="field tnum"
              placeholder={formatCode('ABCDEFGHJK')}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </p>
          <button type="submit" className="btn">
            Open
          </button>
        </form>

        {e === 'bad' ? (
          <p className="notice notice-warn" role="alert">
            That code did not match anything. Check it against the card — the letters I, L and O are
            never used, so if you see something that looks like one it is a 1 or a 0.
          </p>
        ) : null}
        {e === 'slow' ? (
          <p className="notice notice-warn" role="alert">
            That is a few tries in a row. Give it ten minutes, or send us a message below and we will
            resend your link.
          </p>
        ) : null}
        {e === 'expired' ? (
          <p className="notice notice-warn" role="alert">
            That link is no longer active. Send us a message and we will send you a new one.
          </p>
        ) : null}

        {/* The escape hatch is ALWAYS visible, not revealed only after a failure. Nobody should be
            left staring at a dead end wondering whether they were invited at all. */}
        <section className="find-help" aria-labelledby="help-h">
          <hr className="rule" />
          <h2 id="help-h" className="display display-md find-help-title">
            Lost the link?
          </h2>
          <p className="prose muted">
            Send us a note and we will send it straight back. It is no trouble at all.
            {settings.contact_name && settings.contact_phone ? (
              <>
                {' '}
                Or call {settings.contact_name} on{' '}
                <a href={`tel:${settings.contact_phone.replace(/\s/g, '')}`}>
                  {settings.contact_phone}
                </a>
                .
              </>
            ) : null}
          </p>

          {sent ? (
            <p className="notice notice-ok" role="status">
              Thank you — that has reached us and we will come back to you shortly.
            </p>
          ) : (
            <form action={sendMessage} className="find-message">
              <div className="grid-2">
                <p className="field-row">
                  <label className="label" htmlFor="from_name">Your name</label>
                  <input id="from_name" name="from_name" className="field" autoComplete="name" />
                </p>
                <p className="field-row">
                  <label className="label" htmlFor="contact">Email or phone</label>
                  <input id="contact" name="contact" className="field" />
                </p>
              </div>
              <p className="field-row">
                <label className="label" htmlFor="body">Message</label>
                <textarea id="body" name="body" className="field" rows={3} required />
              </p>
              <button type="submit" className="btn btn-ghost">Send</button>
              {settings.contact_email ? (
                <p className="muted find-alt">
                  Or email <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>.
                </p>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
