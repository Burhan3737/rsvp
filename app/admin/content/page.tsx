import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/queries';
import { toIsoDate } from '@/lib/format';
import { saveSettings } from '@/lib/actions/content';
import { AdminNav } from '../AdminNav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'The wedding', robots: { index: false, follow: false } };

/**
 * The wedding itself: who, when, and the things every guest reads first.
 *
 * One long form rather than a wizard. An owner comes here to change one thing — a phone number, a
 * deadline — and a multi-step flow would make the common case slower than the rare one. It posts
 * as a plain form so it works with JavaScript off, like every other form in this project.
 */
export default async function ContentSettings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;
  const s = await getSettings();

  // Belt and braces on top of the cast in `getSettings`. A `date` input silently renders blank for
  // anything that is not exactly YYYY-MM-DD, and a blank date input saves as an empty string — so
  // the failure mode for getting this wrong is not a visible error, it is the wedding date quietly
  // disappearing the next time somebody saves this form.
  const weddingDate = toIsoDate(s.primary_date);
  const replyDeadline = toIsoDate(s.rsvp_deadline);

  return (
    <main id="main" className="admin">
      <AdminNav active="content" />

      <div className="wide admin-body">
        <h1 className="display display-md admin-h1">The wedding</h1>
        <p className="admin-note">
          Everything here appears on the guest-facing site the moment you save it. Nothing needs
          redeploying.
        </p>

        {saved ? (
          <p className="notice notice-ok" role="status">
            Saved. The site is showing this now.
          </p>
        ) : null}

        <form action={saveSettings} className="admin-form">
          <fieldset className="admin-fieldset">
            <legend className="admin-h2">The couple</legend>

            <div className="admin-grid">
              <p className="field-row">
                <label className="label" htmlFor="partner_a">First name</label>
                <input className="field" id="partner_a" name="partner_a" defaultValue={s.partner_a} maxLength={80} />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="partner_b">Second name</label>
                <input className="field" id="partner_b" name="partner_b" defaultValue={s.partner_b} maxLength={80} />
              </p>
            </div>

            <p className="field-row">
              <label className="label" htmlFor="couple_names">Both together</label>
              <input className="field" id="couple_names" name="couple_names" defaultValue={s.couple_names} maxLength={160} />
              <span className="field-hint">
                Used in the footer and the page title. Leave it empty and it becomes
                &ldquo;{[s.partner_a, s.partner_b].filter(Boolean).join(' & ') || 'the two names'}&rdquo;.
              </span>
            </p>

            <p className="field-row">
              <label className="label" htmlFor="script_line">Names in another script</label>
              <input className="field" id="script_line" name="script_line" defaultValue={s.script_line} maxLength={120} dir="auto" />
              <span className="field-hint">
                Set above the Latin names, decoratively. Optional — leave it empty and nothing is shown.
              </span>
            </p>

            <p className="field-row">
              <label className="label" htmlFor="tagline">Tagline</label>
              <input className="field" id="tagline" name="tagline" defaultValue={s.tagline} maxLength={160} />
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">When</legend>

            <div className="admin-grid">
              <p className="field-row">
                <label className="label" htmlFor="primary_date">The date</label>
                <input className="field" id="primary_date" name="primary_date" type="date" defaultValue={weddingDate} />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="timezone">Timezone</label>
                <input className="field" id="timezone" name="timezone" defaultValue={s.timezone} maxLength={60} />
                <span className="field-hint">An IANA name, e.g. Asia/Karachi.</span>
              </p>
            </div>

            <div className="admin-grid">
              <p className="field-row">
                <label className="label" htmlFor="rsvp_deadline">Replies close</label>
                <input className="field" id="rsvp_deadline" name="rsvp_deadline" type="date" defaultValue={replyDeadline} />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="grace_hours">Grace period (hours)</label>
                <input className="field" id="grace_hours" name="grace_hours" type="number" min={0} max={168} defaultValue={s.grace_hours} />
                <span className="field-hint">
                  Absorbs a guest replying &ldquo;on the last day&rdquo; from a timezone where the date has
                  already rolled over.
                </span>
              </p>
            </div>

            <p className="admin-check">
              <input type="checkbox" id="show_deadline" name="show_deadline" defaultChecked={s.show_deadline} />
              <label htmlFor="show_deadline">Show the deadline to guests</label>
            </p>

            <p className="field-row">
              <label className="label" htmlFor="post_deadline_message">After the deadline, say</label>
              <textarea className="field" id="post_deadline_message" name="post_deadline_message" defaultValue={s.post_deadline_message} maxLength={1000} rows={3} />
              <span className="field-hint">
                Shown in place of the reply form. Give people a way to reach you — plans change after
                a deadline, and a dead end turns into a phone call anyway.
              </span>
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">The note on the front</legend>
            <p className="field-row">
              <label className="label" htmlFor="welcome_note">Welcome note</label>
              <textarea className="field" id="welcome_note" name="welcome_note" defaultValue={s.welcome_note} maxLength={2000} rows={6} />
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">Who to ask</legend>
            <p className="admin-note">
              Shown at the bottom of every page. Name somebody who is not the couple: on the week of
              a wedding this is the number that stops the phone ringing.
            </p>

            <div className="admin-grid">
              <p className="field-row">
                <label className="label" htmlFor="contact_name">Name</label>
                <input className="field" id="contact_name" name="contact_name" defaultValue={s.contact_name} maxLength={120} />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="contact_phone">Phone</label>
                <input className="field" id="contact_phone" name="contact_phone" type="tel" defaultValue={s.contact_phone} maxLength={40} />
              </p>
            </div>

            <div className="admin-grid">
              <p className="field-row">
                <label className="label" htmlFor="contact_email">Email shown to guests</label>
                <input className="field" id="contact_email" name="contact_email" type="email" defaultValue={s.contact_email} maxLength={160} />
              </p>
              <p className="field-row">
                <label className="label" htmlFor="owner_email">Where replies are notified</label>
                <input className="field" id="owner_email" name="owner_email" type="email" defaultValue={s.owner_email} maxLength={160} />
                <span className="field-hint">Never shown to guests.</span>
              </p>
            </div>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">Gifts</legend>
            <p className="field-row">
              <label className="label" htmlFor="registry_note">What to say</label>
              <textarea className="field" id="registry_note" name="registry_note" defaultValue={s.registry_note} maxLength={1000} rows={3} />
            </p>
            <p className="field-row">
              <label className="label" htmlFor="registry_url">Registry link</label>
              <input className="field" id="registry_url" name="registry_url" type="url" defaultValue={s.registry_url} maxLength={400} placeholder="https://" />
              <span className="field-hint">
                Link out to an external registry. Do not add a cash-gift or honeymoon-fund widget to
                this site — the free hosting tier counts asking for donations as commercial use.
              </span>
            </p>
          </fieldset>

          <fieldset className="admin-fieldset">
            <legend className="admin-h2">Visibility</legend>
            <p className="admin-check">
              <input type="checkbox" id="site_is_public" name="site_is_public" defaultChecked={s.site_is_public} />
              <label htmlFor="site_is_public">Let search engines index the front page</label>
            </p>
            <p className="admin-note admin-warn">
              Invitation links are never indexed whatever this says. This only affects the public
              front page, and off is the safer default.
            </p>
          </fieldset>

          <p className="admin-actions">
            <button className="btn" type="submit">Save</button>
          </p>
        </form>
      </div>
    </main>
  );
}
