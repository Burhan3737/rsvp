import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { submitRsvp } from '@/lib/actions/rsvp';
import {
  cellKey,
  getInviteByToken,
  getRsvpData,
  getSettings,
  isPastDeadline,
  mealsFor,
} from '@/lib/queries';
import { formatDayHeader, formatTimeSpan, parseDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reply to your invitation',
  robots: { index: false, follow: false, noarchive: true, nosnippet: true, nocache: true },
  openGraph: { title: 'Your invitation', description: 'Open your invitation to reply.' },
};

const DIET_TAGS = [
  'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free',
  'Nut allergy', 'Halal only', 'Kosher', 'Jain',
];

/**
 * The reply form.
 *
 * There is no guest list, so the form gives you `max_guests` name slots and you fill in the ones
 * that apply. Slots rather than a JS "add another person" button keeps the whole thing working with
 * JavaScript disabled — guests open these links inside the Gmail, WhatsApp and Facebook in-app
 * browsers, where JS behaviour is genuinely unpredictable.
 */
export default async function RsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; e?: string }>;
}) {
  const { token } = await params;
  const { saved, e: errorCode } = await searchParams;

  const invite = await getInviteByToken(token);
  if (!invite) notFound();

  const [settings, data] = await Promise.all([getSettings(), getRsvpData(invite.id)]);
  const closed = isPastDeadline(settings);
  const deadline = settings.rsvp_deadline ? parseDate(settings.rsvp_deadline) : null;

  const slots = Array.from({ length: invite.max_guests }, (_, i) => i);
  const bySlot = new Map(data.attendees.map((a) => [a.slot, a]));

  const action = submitRsvp.bind(null, token);

  return (
    <main id="main" className="section">
      <div className="shell">
        <p className="label">
          <a href={`/i/${token}`}>&larr; Back to the schedule</a>
        </p>

        <h1 className="display display-lg section-title rsvp-title">Let us know</h1>

        {saved ? (
          <p className="notice notice-ok" role="status">
            Saved, thank you. You can come back to this same link and change any of it{' '}
            {deadline ? `until ${deadline.day} ${deadline.month}` : 'any time'} — nothing here is final.
          </p>
        ) : null}

        {errorCode === 'closed' ? (
          <p className="notice notice-warn" role="alert">
            The deadline has passed, so the form is closed.
          </p>
        ) : null}

        {closed ? (
          <div className="notice notice-warn">
            <p>
              {settings.post_deadline_message ||
                'Our deadline has passed and we have already given final numbers to the caterer. Please contact us directly if your plans have changed.'}
            </p>
          </div>
        ) : null}

        {!data.events.length ? (
          <p className="prose muted">
            There is nothing to reply to on this invitation yet. We will be in touch as soon as the
            schedule is settled.
          </p>
        ) : (
          <form action={action} className="rsvp-form">
            <fieldset disabled={closed} className="rsvp-fieldset">
              <legend className="visually-hidden">Your reply</legend>

              <p className="prose muted rsvp-lede">
                Fill in a name for everyone coming, then say which events each of you can make.
                {invite.max_guests > 1
                  ? ` This invitation is for up to ${invite.max_guests} people — leave any you don't need blank.`
                  : ' This invitation is for one person.'}
              </p>

              {/* ------------------------------------------------ One block per person */}
              {slots.map((slot) => {
                const existing = bySlot.get(slot);
                const isChild = existing?.is_child ?? false;
                return (
                  <section key={slot} className="rsvp-person" aria-labelledby={`person-${slot}`}>
                    <hr className="rule" />
                    <p className="label section-num" id={`person-${slot}`}>
                      {slot === 0 ? 'You' : `Guest ${slot + 1}`}
                    </p>

                    <p className="field-row">
                      <label className="label" htmlFor={`name-${slot}`}>
                        Full name{slot === 0 ? '' : ' (leave blank if not coming)'}
                      </label>
                      <input
                        id={`name-${slot}`}
                        name={`name:${slot}`}
                        className="field"
                        autoComplete={slot === 0 ? 'name' : 'off'}
                        defaultValue={existing?.name ?? ''}
                        required={slot === 0}
                      />
                    </p>

                    <label className="choice choice-check">
                      <input type="checkbox" name={`child:${slot}`} value="yes" defaultChecked={isChild} />
                      <span>Under 12</span>
                    </label>

                    {/* Per event, for this person */}
                    <div className="rsvp-events">
                      {data.events.map((event) => {
                        const prev = data.attendance.get(cellKey(slot, event.id));
                        const options = mealsFor(event.meals, isChild);
                        const n = `attend:${slot}:${event.id}`;
                        return (
                          <fieldset key={event.id} className="person">
                            <legend className="person-name">
                              {event.name}
                              <span className="muted person-tag">
                                {' '}
                                · {formatDayHeader(event.event_date)}, {formatTimeSpan(event)}
                              </span>
                            </legend>

                            <div className="choices">
                              <label className="choice">
                                <input
                                  type="radio"
                                  name={n}
                                  value="attending"
                                  defaultChecked={prev?.status === 'attending'}
                                />
                                <span>Will be there</span>
                              </label>
                              <label className="choice">
                                <input
                                  type="radio"
                                  name={n}
                                  value="declined"
                                  defaultChecked={prev?.status === 'declined'}
                                />
                                <span>Can&rsquo;t make it</span>
                              </label>
                            </div>

                            {options.length ? (
                              <p className="field-row">
                                <label className="label" htmlFor={`meal-${slot}-${event.id}`}>
                                  Meal
                                </label>
                                <select
                                  id={`meal-${slot}-${event.id}`}
                                  name={`meal:${slot}:${event.id}`}
                                  className="field"
                                  defaultValue={prev?.meal_option_id ?? ''}
                                >
                                  <option value="">No preference</option>
                                  {options.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                      {m.description ? ` — ${m.description}` : ''}
                                    </option>
                                  ))}
                                </select>
                              </p>
                            ) : null}
                          </fieldset>
                        );
                      })}
                    </div>

                    {/* Food and access, once per person */}
                    <div className="checks">
                      {DIET_TAGS.map((tag) => (
                        <label key={tag} className="choice choice-check">
                          <input
                            type="checkbox"
                            name={`diet:${slot}`}
                            value={tag}
                            defaultChecked={
                              Array.isArray(existing?.dietary_tags) &&
                              existing!.dietary_tags.includes(tag)
                            }
                          />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>

                    <p className="field-row">
                      <label className="label" htmlFor={`medical-${slot}`}>
                        Allergy or medical requirement
                      </label>
                      <input
                        id={`medical-${slot}`}
                        name={`medical:${slot}`}
                        className="field"
                        defaultValue={existing?.dietary_medical ?? ''}
                        placeholder="e.g. severe nut allergy"
                      />
                    </p>

                    <div className="grid-2">
                      <p className="field-row">
                        <label className="label" htmlFor={`pref-${slot}`}>
                          Preference (optional)
                        </label>
                        <input
                          id={`pref-${slot}`}
                          name={`pref:${slot}`}
                          className="field"
                          defaultValue={existing?.dietary_preference ?? ''}
                        />
                      </p>
                      <p className="field-row">
                        <label className="label" htmlFor={`access-${slot}`}>
                          Access needs (optional)
                        </label>
                        <input
                          id={`access-${slot}`}
                          name={`access:${slot}`}
                          className="field"
                          defaultValue={existing?.accessibility ?? ''}
                          placeholder="e.g. step-free access"
                        />
                      </p>
                    </div>
                  </section>
                );
              })}

              {/* ------------------------------------------------------ Travel, once */}
              <section className="rsvp-block" aria-labelledby="travel-h">
                <hr className="rule" />
                <p className="label section-num">Travel</p>
                <h2 id="travel-h" className="display display-md">
                  Getting here
                </h2>
                <p className="prose muted rsvp-lede">
                  Only if you are travelling. It helps us plan airport runs and the shuttle.
                </p>

                <div className="grid-2">
                  <p className="field-row">
                    <label className="label" htmlFor="arrival_date">Arriving</label>
                    <input id="arrival_date" name="arrival_date" type="date" className="field"
                      defaultValue={data.response?.arrival_date ? String(data.response.arrival_date).slice(0, 10) : ''} />
                  </p>
                  <p className="field-row">
                    <label className="label" htmlFor="departure_date">Leaving</label>
                    <input id="departure_date" name="departure_date" type="date" className="field"
                      defaultValue={data.response?.departure_date ? String(data.response.departure_date).slice(0, 10) : ''} />
                  </p>
                </div>

                <p className="field-row">
                  <label className="label" htmlFor="travelling_from">Travelling from</label>
                  <input id="travelling_from" name="travelling_from" className="field"
                    defaultValue={data.response?.travelling_from ?? ''} />
                </p>

                <fieldset className="person">
                  <legend className="person-name">Will you use the shuttle?</legend>
                  <div className="choices">
                    <label className="choice">
                      <input type="radio" name="shuttle" value="yes" defaultChecked={data.response?.needs_shuttle === true} />
                      <span>Yes please</span>
                    </label>
                    <label className="choice">
                      <input type="radio" name="shuttle" value="no" defaultChecked={data.response?.needs_shuttle === false} />
                      <span>We&rsquo;ll make our own way</span>
                    </label>
                  </div>
                </fieldset>

                <fieldset className="person">
                  <legend className="person-name">Do you need a room in the hotel block?</legend>
                  <div className="choices">
                    <label className="choice">
                      <input type="radio" name="accommodation" value="yes" defaultChecked={data.response?.needs_accommodation === true} />
                      <span>Yes</span>
                    </label>
                    <label className="choice">
                      <input type="radio" name="accommodation" value="no" defaultChecked={data.response?.needs_accommodation === false} />
                      <span>No</span>
                    </label>
                  </div>
                </fieldset>
              </section>

              {/* ---------------------------------------------------- How to reach you */}
              <section className="rsvp-block" aria-labelledby="extras-h">
                <hr className="rule" />
                <p className="label section-num">Last thing</p>
                <h2 id="extras-h" className="display display-md">
                  How to reach you
                </h2>

                <div className="grid-2">
                  <p className="field-row">
                    <label className="label" htmlFor="contact_email">Email</label>
                    <input id="contact_email" name="contact_email" type="email" className="field"
                      autoComplete="email" defaultValue={data.response?.contact_email ?? ''} />
                  </p>
                  <p className="field-row">
                    <label className="label" htmlFor="contact_phone">Phone</label>
                    <input id="contact_phone" name="contact_phone" type="tel" className="field"
                      autoComplete="tel" defaultValue={data.response?.contact_phone ?? ''} />
                  </p>
                </div>

                <p className="field-row">
                  <label className="label" htmlFor="song_request">A song that will get you dancing</label>
                  <input id="song_request" name="song_request" className="field"
                    defaultValue={data.response?.song_request ?? ''} />
                </p>

                <p className="field-row">
                  <label className="label" htmlFor="message">A note for us (optional)</label>
                  <textarea id="message" name="message" className="field" rows={4} />
                </p>
                <input type="hidden" name="contact_name" value="" />
              </section>

              <div className="rsvp-submit">
                <button type="submit" className="btn">Send our reply</button>
                <p className="muted rsvp-submit-note">
                  You can change any of this later using the same link
                  {deadline && settings.show_deadline ? `, until ${deadline.day} ${deadline.month}` : ''}.
                </p>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </main>
  );
}
