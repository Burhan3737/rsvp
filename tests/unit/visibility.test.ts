/**
 * The visibility model is the whole product, so it gets the most thorough test in the suite.
 *
 * The rule under test: **a link shows exactly the events ticked for it, plus anything public.**
 *
 * Getting this wrong is asymmetrically catastrophic in both directions:
 *   - too permissive -> a private event leaks to someone who was not invited (irreversible)
 *   - too strict     -> an invited guest silently cannot see or answer their own event (looks like a bug)
 *
 * Runs against real Postgres via PGlite in memory, so it exercises the actual SQL, not a mock.
 */
process.env.PGLITE_DIR = 'memory://';

import { beforeAll, describe, expect, it } from 'vitest';
import { migrate, query } from '@/lib/db';
import {
  getEventsForInvite,
  getInviteByCode,
  getInviteByToken,
  getPublicEvents,
  getRsvpEventsForInvite,
  inviteHasEvent,
  isPastDeadline,
  type Settings,
} from '@/lib/queries';

const ids: Record<string, string> = {};

beforeAll(async () => {
  await migrate();

  const ev = async (
    slug: string,
    opts: Partial<{ is_public: boolean; rsvp_enabled: boolean; date: string }> = {},
  ) => {
    const [r] = await query<{ id: string }>(
      `INSERT INTO events (slug, name, event_date, is_public, rsvp_enabled)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [slug, slug, opts.date ?? '2027-02-27', opts.is_public ?? false, opts.rsvp_enabled ?? true],
    );
    return r.id;
  };

  // The four legitimate combinations of "can anyone see it" x "does it collect a reply".
  ids.evReception = await ev('reception', { is_public: true, rsvp_enabled: true, date: '2027-02-28' });
  ids.evCeremony = await ev('ceremony', { is_public: true, rsvp_enabled: false, date: '2027-02-27' });
  ids.evMehndi = await ev('mehndi', { is_public: false, rsvp_enabled: true, date: '2027-02-26' });
  ids.evDholki = await ev('dholki', { is_public: false, rsvp_enabled: true, date: '2027-02-24' });
  ids.evBrunch = await ev('brunch', { is_public: false, rsvp_enabled: false, date: '2027-03-01' });

  const invite = async (label: string, token: string, code: string, events: string[], seats = 2) => {
    const [r] = await query<{ id: string }>(
      `INSERT INTO invites (label, token, code, max_guests) VALUES ($1,$2,$3,$4) RETURNING id`,
      [label, token, code, seats],
    );
    for (const e of events) {
      await query(`INSERT INTO invite_events (invite_id, event_id) VALUES ($1,$2)`, [r.id, e]);
    }
    return r.id;
  };

  // Everything ticked.
  ids.inFamily = await invite('Family', 'tok-family-aaaaaaaaaaaa', 'CODEFAMILY', [
    ids.evDholki, ids.evMehndi, ids.evCeremony, ids.evReception, ids.evBrunch,
  ], 4);

  // Only the loud one plus the public events.
  ids.inFriend = await invite('Friend', 'tok-friend-aaaaaaaaaaaa', 'CODEFRIEND', [
    ids.evMehndi, ids.evCeremony, ids.evReception,
  ]);

  // Nothing private ticked at all.
  ids.inWork = await invite('Colleague', 'tok-work-aaaaaaaaaaaaaa', 'CODEWORKAA', [ids.evReception], 1);

  // A revoked link, and an expired one.
  ids.inRevoked = await invite('Revoked', 'tok-revoked-aaaaaaaaaa', 'CODEREVOKE', [ids.evReception]);
  await query(`UPDATE invites SET revoked_at = now() WHERE id = $1`, [ids.inRevoked]);

  ids.inExpired = await invite('Expired', 'tok-expired-aaaaaaaaaa', 'CODEEXPIRE', [ids.evReception]);
  await query(`UPDATE invites SET expires_at = now() - interval '1 day' WHERE id = $1`, [ids.inExpired]);
});

const slugs = (rows: { slug: string }[]) => rows.map((r) => r.slug).sort();

describe('the public page', () => {
  it('shows only events explicitly marked public', async () => {
    expect(slugs(await getPublicEvents())).toEqual(['ceremony', 'reception']);
  });

  it('leaks nothing private', async () => {
    const s = slugs(await getPublicEvents());
    for (const secret of ['dholki', 'mehndi', 'brunch']) expect(s).not.toContain(secret);
  });
});

describe('a link shows exactly what was ticked for it', () => {
  it('the family link shows everything', async () => {
    expect(slugs(await getEventsForInvite(ids.inFamily))).toEqual(
      ['brunch', 'ceremony', 'dholki', 'mehndi', 'reception'],
    );
  });

  it('the friend link shows the mehndi but NOT the family-only events', async () => {
    const s = slugs(await getEventsForInvite(ids.inFriend));
    expect(s).toContain('mehndi');
    expect(s).not.toContain('dholki');
    expect(s).not.toContain('brunch');
  });

  it('a link with nothing private ticked still gets the public events', async () => {
    expect(slugs(await getEventsForInvite(ids.inWork))).toEqual(['ceremony', 'reception']);
  });

  it('orders chronologically, interleaving private among public', async () => {
    const rows = await getEventsForInvite(ids.inFamily);
    expect(rows.map((r) => r.slug)).toEqual(['dholki', 'mehndi', 'ceremony', 'reception', 'brunch']);
  });

  it('untickng an event removes it immediately, with no stale copy left behind', async () => {
    expect(slugs(await getEventsForInvite(ids.inFriend))).toContain('mehndi');
    await query(`DELETE FROM invite_events WHERE invite_id = $1 AND event_id = $2`,
      [ids.inFriend, ids.evMehndi]);
    expect(slugs(await getEventsForInvite(ids.inFriend))).not.toContain('mehndi');
    // ...and re-ticking restores it just as immediately.
    await query(`INSERT INTO invite_events (invite_id, event_id) VALUES ($1,$2)`,
      [ids.inFriend, ids.evMehndi]);
    expect(slugs(await getEventsForInvite(ids.inFriend))).toContain('mehndi');
  });
});

describe('replying is separate from seeing', () => {
  it('a public event with rsvp_enabled=false is visible but not answerable', async () => {
    expect(slugs(await getEventsForInvite(ids.inFamily))).toContain('ceremony');
    expect(slugs(await getRsvpEventsForInvite(ids.inFamily))).not.toContain('ceremony');
  });

  it('only ticked, reply-collecting events are answerable', async () => {
    expect(slugs(await getRsvpEventsForInvite(ids.inFamily))).toEqual(['dholki', 'mehndi', 'reception']);
  });

  it('a public event NOT ticked on the link is not answerable from it', async () => {
    // The colleague link only ticks the reception, so that is all it can answer.
    expect(slugs(await getRsvpEventsForInvite(ids.inWork))).toEqual(['reception']);
  });

  it('inviteHasEvent gates a crafted form submission', async () => {
    expect(await inviteHasEvent(ids.inWork, ids.evReception)).toBe(true);
    // Somebody POSTing this event id against the colleague link must be rejected.
    expect(await inviteHasEvent(ids.inWork, ids.evDholki)).toBe(false);
  });
});

describe('link resolution', () => {
  it('resolves a good token and a good code', async () => {
    expect((await getInviteByToken('tok-family-aaaaaaaaaaaa'))?.label).toBe('Family');
    expect((await getInviteByCode('CODEFAMILY'))?.label).toBe('Family');
  });

  it('refuses a revoked link — one UPDATE kills a forwarded link', async () => {
    expect(await getInviteByToken('tok-revoked-aaaaaaaaaa')).toBeNull();
    expect(await getInviteByCode('CODEREVOKE')).toBeNull();
  });

  it('refuses an expired link', async () => {
    expect(await getInviteByToken('tok-expired-aaaaaaaaaa')).toBeNull();
  });

  it('refuses nonsense without distinguishing it from revoked or expired', async () => {
    // A probe must not be able to tell "never existed" from "was killed".
    expect(await getInviteByToken('definitely-not-real-xx')).toBeNull();
    expect(await getInviteByToken('')).toBeNull();
    expect(await getInviteByToken('short')).toBeNull();
  });

  it('carries the seat cap that replaces plus-one policing', async () => {
    expect((await getInviteByToken('tok-family-aaaaaaaaaaaa'))?.max_guests).toBe(4);
    expect((await getInviteByToken('tok-work-aaaaaaaaaaaaaa'))?.max_guests).toBe(1);
  });
});

describe('deadline enforcement', () => {
  const base = { rsvp_deadline: '2027-01-15', grace_hours: 24 } as Settings;

  it('is open before the deadline', () => {
    expect(isPastDeadline(base, new Date('2027-01-14T12:00:00Z'))).toBe(false);
  });

  it('is still open inside the grace period', () => {
    expect(isPastDeadline(base, new Date('2027-01-16T12:00:00Z'))).toBe(false);
  });

  it('is closed after the grace period', () => {
    expect(isPastDeadline(base, new Date('2027-01-17T12:00:00Z'))).toBe(true);
  });

  it('never closes when no deadline is set', () => {
    expect(isPastDeadline({ rsvp_deadline: null, grace_hours: 0 } as Settings, new Date('2099-01-01'))).toBe(false);
  });
});
