'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { query, queryOne } from '@/lib/db';
import {
  getInviteByToken,
  getRsvpEventsForInvite,
  getSettings,
  isPastDeadline,
} from '@/lib/queries';
import { notifyOwnerOfRsvp } from '@/lib/email';

/**
 * RSVP submission.
 *
 * There is no guest list, so the guest types their own names. The link's `max_guests` is what caps
 * the party — that is what replaces plus-one policing.
 *
 * Ordering rule, and it is not negotiable: PERSIST FIRST, NOTIFY SECOND. If the email provider is
 * down, a failed send must degrade to "the couple didn't get an alert", never to "the guest's reply
 * vanished". A lost reply is indistinguishable from a non-response and is the single most
 * trust-destroying failure this product has.
 *
 * The whole write is idempotent: attendees are rebuilt from the submitted slots each time, so a
 * double submit — or a corporate mail scanner pre-fetching the link — cannot duplicate anybody.
 */

const DIET_TAG_WHITELIST = new Set([
  'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free',
  'Nut allergy', 'Halal only', 'Kosher', 'Jain',
]);

export async function submitRsvp(token: string, formData: FormData): Promise<void> {
  const invite = await getInviteByToken(token);
  if (!invite) redirect('/find?e=expired');

  const settings = await getSettings();
  // Server-side deadline check. Never trust a client clock, and never trust a hidden form field.
  if (isPastDeadline(settings)) redirect(`/i/${token}/rsvp?e=closed`);

  // Re-derive what this link may answer from the DATABASE, never from the submitted form.
  // Otherwise a crafted POST could reply to an event the link never showed.
  const events = await getRsvpEventsForInvite(invite.id);
  if (!events.length) redirect(`/i/${token}/rsvp?e=nothing`);

  const str = (k: string, max = 500) => String(formData.get(k) ?? '').trim().slice(0, max);
  const dateOrNull = (k: string) => {
    const v = str(k, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };
  const boolOrNull = (k: string) => {
    const v = formData.get(k);
    return v === 'yes' ? true : v === 'no' ? false : null;
  };

  // --- The response row. One per link; re-submitting updates it. -------------
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM responses WHERE invite_id = $1`,
    [invite.id],
  );

  const [response] = await query<{ id: string }>(
    `INSERT INTO responses (invite_id, contact_name, contact_email, contact_phone, arrival_date,
        departure_date, travelling_from, needs_shuttle, needs_accommodation, song_request,
        submitted_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())
     ON CONFLICT (invite_id) DO UPDATE SET
       contact_name = EXCLUDED.contact_name,
       contact_email = EXCLUDED.contact_email,
       contact_phone = EXCLUDED.contact_phone,
       arrival_date = EXCLUDED.arrival_date,
       departure_date = EXCLUDED.departure_date,
       travelling_from = EXCLUDED.travelling_from,
       needs_shuttle = EXCLUDED.needs_shuttle,
       needs_accommodation = EXCLUDED.needs_accommodation,
       song_request = EXCLUDED.song_request,
       updated_at = now()
     RETURNING id`,
    [
      invite.id,
      str('contact_name', 120),
      str('contact_email', 200),
      str('contact_phone', 60),
      dateOrNull('arrival_date'),
      dateOrNull('departure_date'),
      str('travelling_from', 200),
      boolOrNull('shuttle'),
      boolOrNull('accommodation'),
      str('song_request', 300),
    ],
  );

  // --- Attendees, rebuilt from the submitted slots. --------------------------
  // Deleting and re-inserting keeps the write idempotent and means a guest who removes a name on a
  // second visit actually removes them. ON DELETE CASCADE clears their attendance rows too.
  await query(`DELETE FROM attendees WHERE response_id = $1`, [response.id]);

  let attending = 0;
  let declined = 0;
  const names: string[] = [];

  for (let slot = 0; slot < invite.max_guests; slot++) {
    const name = str(`name:${slot}`, 120);
    if (!name) continue; // an empty row simply is not a person

    const tags = formData
      .getAll(`diet:${slot}`)
      .filter((v): v is string => typeof v === 'string' && DIET_TAG_WHITELIST.has(v));

    const [attendee] = await query<{ id: string }>(
      `INSERT INTO attendees (response_id, slot, name, is_child, dietary_tags, dietary_medical,
          dietary_preference, accessibility)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING id`,
      [
        response.id,
        slot,
        name,
        formData.get(`child:${slot}`) === 'yes',
        JSON.stringify(tags),
        str(`medical:${slot}`, 1000),
        str(`pref:${slot}`, 1000),
        str(`access:${slot}`, 1000),
      ],
    );
    names.push(name);

    for (const event of events) {
      const raw = formData.get(`attend:${slot}:${event.id}`);
      if (raw !== 'attending' && raw !== 'declined') continue; // unanswered stays unanswered

      let mealId: string | null = null;
      const mealRaw = formData.get(`meal:${slot}:${event.id}`);
      if (raw === 'attending' && typeof mealRaw === 'string' && mealRaw) {
        // Validate the meal belongs to THIS event and suits this person's age band.
        const meal = await queryOne<{ id: string; audience: string }>(
          `SELECT id, audience FROM meal_options WHERE id = $1 AND event_id = $2`,
          [mealRaw, event.id],
        );
        const isChild = formData.get(`child:${slot}`) === 'yes';
        if (meal && !(isChild && meal.audience === 'adult') && !(!isChild && meal.audience === 'child')) {
          mealId = meal.id;
        }
      }

      await query(
        `INSERT INTO attendance (attendee_id, event_id, status, meal_option_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (attendee_id, event_id)
         DO UPDATE SET status = EXCLUDED.status, meal_option_id = EXCLUDED.meal_option_id`,
        [attendee.id, event.id, raw, mealId],
      );

      if (raw === 'attending') attending++;
      else declined++;
    }
  }

  // --- The note goes to a REVIEW QUEUE, never to a headcount. ----------------
  // A free-text box is where guests try to add extra people.
  const message = str('message', 2000);
  if (message) {
    await query(
      `INSERT INTO messages (invite_id, from_name, contact, body) VALUES ($1,$2,$3,$4)`,
      [invite.id, str('contact_name', 120) || invite.label, str('contact_email', 200), message],
    );
    await query(`UPDATE responses SET message = $2 WHERE id = $1`, [response.id, message]);
  }

  await query(
    `INSERT INTO response_log (invite_id, actor, summary) VALUES ($1,'guest',$2)`,
    [
      invite.id,
      `${existing ? 'Updated' : 'Submitted'}: ${names.length} name(s), ${attending} attending, ${declined} declined`,
    ],
  );

  // Everything durable is committed. Only now do we attempt to notify, and a failure is swallowed.
  try {
    await notifyOwnerOfRsvp({
      settings,
      inviteLabel: invite.label,
      names,
      attending,
      declined,
      message,
    });
  } catch (err) {
    console.error('[rsvp] owner notification failed (the reply is safely saved):', err);
  }

  revalidatePath(`/i/${token}`);
  redirect(`/i/${token}/rsvp?saved=1`);
}
