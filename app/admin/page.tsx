import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import {
  getEventTallies,
  getInviteSummaries,
  getMealTallies,
  getMessages,
  getSettings,
} from '@/lib/queries';
import { formatDayHeader } from '@/lib/format';
import { AdminNav } from './AdminNav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default async function AdminDashboard() {
  // Re-checked here and inside every Server Action. Proxy coverage is an optimistic gate only —
  // Next's own docs warn that a refactor can silently remove it.
  await requireAdmin();

  const [settings, tallies, meals, invites, messages] = await Promise.all([
    getSettings(),
    getEventTallies(),
    getMealTallies(),
    getInviteSummaries(),
    getMessages(),
  ]);

  const outstanding = invites.filter((i) => !i.responded && !i.revoked_at);
  const newMessages = messages.filter((m) => m.status === 'new');
  const totalComing = invites.reduce((n, i) => n + i.head_count, 0);

  const mealsByEvent = meals.reduce<Record<string, typeof meals>>((acc, m) => {
    (acc[m.event_name] ??= []).push(m);
    return acc;
  }, {});

  return (
    <main id="main" className="admin">
      <AdminNav active="dashboard" />

      <div className="wide admin-body">
        <h1 className="display display-md admin-h1">{settings.couple_names}</h1>

        <p className="admin-note">
          <strong className="tnum">{totalComing}</strong> people confirmed across{' '}
          <strong className="tnum">{invites.length}</strong> invite links.
        </p>

        {/* ------------------------------------------------ The three-bucket view */}
        <section aria-labelledby="tallies-h">
          <h2 id="tallies-h" className="admin-h2">Replies by event</h2>
          <p className="admin-note">
            &ldquo;Awaiting&rdquo; counts links that show the event and have not replied at all. It
            is the only number that still needs work.
          </p>

          <div className="tally-grid">
            {tallies.map((t) => (
              <article key={t.id} className="tally">
                <p className="label">{formatDayHeader(t.event_date)}</p>
                <h3 className="tally-name">{t.name}</h3>

                <p className="tally-audience">
                  <span className="chip">
                    on <span className="tnum">{t.links}</span> link{t.links === 1 ? '' : 's'}
                  </span>
                  {t.is_public ? <span className="chip chip-all">public</span> : <span className="chip chip-private">private</span>}
                  {!t.rsvp_enabled ? <span className="chip">no reply needed</span> : null}
                </p>

                <dl className="buckets">
                  <div className="bucket">
                    <dt>Attending</dt>
                    <dd className="tnum bucket-yes">{t.attending}</dd>
                  </div>
                  <div className="bucket">
                    <dt>Declined</dt>
                    <dd className="tnum">{t.declined}</dd>
                  </div>
                  <div className="bucket">
                    <dt>Awaiting</dt>
                    <dd className="tnum bucket-wait">{t.awaiting}</dd>
                  </div>
                </dl>

                {mealsByEvent[t.name]?.length ? (
                  <ul className="meals">
                    {mealsByEvent[t.name].map((m) => (
                      <li key={m.meal_name}>
                        <span>{m.meal_name}</span>
                        <span className="tnum">{m.n}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------- The chase-up worklist */}
        <section aria-labelledby="outstanding-h" className="admin-section">
          <h2 id="outstanding-h" className="admin-h2">
            Still to reply <span className="tnum admin-count">{outstanding.length}</span>
          </h2>
          <p className="admin-note">
            The worst part of planning a wedding, made into a list. Their link is right here so you
            can resend it.
          </p>

          {!outstanding.length ? (
            <p className="admin-empty">Everyone has replied. Genuinely, that never happens.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th className="num">Seats</th>
                    <th>Opened?</th>
                    <th>Their link</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.label}</td>
                      <td className="num tnum">{inv.max_guests}</td>
                      <td className="small">
                        {inv.opened_at ? (
                          <span>opened</span>
                        ) : (
                          <span className="muted">never opened</span>
                        )}
                      </td>
                      <td className="small">
                        <code className="token">/i/{inv.token}</code>
                      </td>
                      <td>
                        <a className="btn btn-ghost btn-sm" href={`/admin/invites/${inv.id}`}>
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------ The review queue */}
        <section aria-labelledby="messages-h" className="admin-section">
          <h2 id="messages-h" className="admin-h2">
            Messages <span className="tnum admin-count">{newMessages.length}</span>
          </h2>
          <p className="admin-note">
            Notes from guests, and anyone who could not open their link. These never affect a
            headcount — a free-text box is where people try to add an extra guest.
          </p>

          {!messages.length ? (
            <p className="admin-empty">Nothing yet.</p>
          ) : (
            <ul className="messages">
              {messages.slice(0, 25).map((m) => (
                <li key={m.id} className="message">
                  <p className="message-meta label">
                    {m.from_name || 'Someone'}
                    {m.contact ? ` · ${m.contact}` : ''}
                  </p>
                  <p className="message-body">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
