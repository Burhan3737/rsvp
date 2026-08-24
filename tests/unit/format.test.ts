import { describe, expect, it } from 'vitest';
import type { EventRow } from '@/lib/queries';
import {
  formatDayHeader,
  formatTime,
  formatTimeSpan,
  groupByDay,
  shouldRepeatVenue,
  timezoneLabel,
  toClockTime,
  toIcsCalendar,
  toIsoDate,
} from '@/lib/format';

const ev = (over: Partial<EventRow>): EventRow =>
  ({
    id: 'e1', slug: 's', name: 'Event', blurb: '', description: '',
    event_date: '2027-02-27', start_time: '18:00:00', end_time: '23:30:00', arrive_by: null,
    timezone: 'Asia/Karachi', venue_name: 'V', venue_address: 'A', venue_map_url: '',
    dress_code: '', dress_code_note: '', modesty_note: '', permission_note: '',
    swatches: [], avoid_colours: [], is_public: true, listed_on_schedule: true, rsvp_enabled: true,
    is_main: false, is_unplugged: false, show_map: false, show_directions: true,
    show_add_to_calendar: true, time_mode: 'start_end', audience_mode: 'all', accent_hex: '',
    sort_order: 0, ...over,
  }) as EventRow;

describe('toIsoDate — the Postgres Date regression', () => {
  it('handles a plain ISO string', () => {
    expect(toIsoDate('2027-02-27')).toBe('2027-02-27');
    expect(toIsoDate('2027-02-27T00:00:00.000Z')).toBe('2027-02-27');
  });

  it('handles a JS Date, which is what the driver actually returns for a `date` column', () => {
    // This is the bug that shipped "undefined undefined undefined NaN" to the hero.
    expect(toIsoDate(new Date(Date.UTC(2027, 1, 27)))).toBe('2027-02-27');
  });

  it('does not shift the calendar day regardless of the runner timezone', () => {
    // 00:30 UTC would be the PREVIOUS day under a negative local offset if local getters were used.
    expect(toIsoDate(new Date('2027-02-27T00:30:00.000Z'))).toBe('2027-02-27');
    expect(toIsoDate(new Date('2027-02-27T23:30:00.000Z'))).toBe('2027-02-27');
  });

  it('is safe on null/undefined', () => {
    expect(toIsoDate(null)).toBe('');
    expect(toIsoDate(undefined)).toBe('');
  });
});

describe('toClockTime', () => {
  it('normalises postgres time strings', () => {
    expect(toClockTime('18:00:00')).toBe('18:00');
    expect(toClockTime('09:05')).toBe('09:05');
    expect(toClockTime('9:05:00')).toBe('09:05');
  });
  it('is safe on null', () => {
    expect(toClockTime(null)).toBe('');
  });
});

describe('formatTime', () => {
  it('renders 12-hour wall clock', () => {
    expect(formatTime('18:00:00')).toBe('6:00 pm');
    expect(formatTime('09:30:00')).toBe('9:30 am');
    expect(formatTime('00:15:00')).toBe('12:15 am');
    expect(formatTime('12:00:00')).toBe('12:00 pm');
    expect(formatTime('23:59:00')).toBe('11:59 pm');
  });
  it('returns empty for null', () => {
    expect(formatTime(null)).toBe('');
  });
});

describe('formatTimeSpan honours time_mode rather than inventing a time', () => {
  it('renders a span', () => {
    expect(formatTimeSpan(ev({}))).toBe('6:00 pm – 11:30 pm');
  });
  it('renders start only', () => {
    expect(formatTimeSpan(ev({ time_mode: 'start_only' }))).toBe('6:00 pm');
  });
  it('says TBA rather than faking a time', () => {
    expect(formatTimeSpan(ev({ time_mode: 'tba', start_time: null }))).toBe('Time to be confirmed');
    // Even with a stray stored time, TBA wins — the couple explicitly marked it unconfirmed.
    expect(formatTimeSpan(ev({ time_mode: 'tba' }))).toBe('Time to be confirmed');
  });
});

describe('timezoneLabel', () => {
  it('renders a human city label rather than converting', () => {
    expect(timezoneLabel('Asia/Karachi')).toBe('Karachi time');
    expect(timezoneLabel('America/New_York')).toBe('New York time');
  });
});

describe('formatDayHeader', () => {
  it('formats a weekday header', () => {
    expect(formatDayHeader('2027-02-27')).toBe('Saturday 27 February');
  });
  it('works from a Date object too', () => {
    expect(formatDayHeader(new Date(Date.UTC(2027, 1, 26)) as unknown as string)).toBe('Friday 26 February');
  });
});

describe('groupByDay', () => {
  it('groups consecutive events under one day', () => {
    const groups = groupByDay([
      ev({ id: 'a', event_date: '2027-02-26' }),
      ev({ id: 'b', event_date: '2027-02-26' }),
      ev({ id: 'c', event_date: '2027-02-27' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(groups[1].header).toBe('Saturday 27 February');
  });

  it('groups correctly when the driver returns Date objects', () => {
    const groups = groupByDay([
      ev({ id: 'a', event_date: new Date(Date.UTC(2027, 1, 26)) as unknown as string }),
      ev({ id: 'b', event_date: new Date(Date.UTC(2027, 1, 26)) as unknown as string }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('returns nothing for no events', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('shouldRepeatVenue', () => {
  it('states the address once per venue run', () => {
    const list = [
      ev({ id: 'a', venue_name: 'Palace', venue_address: '1 Road' }),
      ev({ id: 'b', venue_name: 'Palace', venue_address: '1 Road' }),
      ev({ id: 'c', venue_name: 'Hotel', venue_address: '2 Road' }),
    ];
    expect(shouldRepeatVenue(list, 0)).toBe(true);
    expect(shouldRepeatVenue(list, 1)).toBe(false);
    expect(shouldRepeatVenue(list, 2)).toBe(true);
  });
});

describe('ICS export', () => {
  it('emits a valid calendar anchored to the venue timezone, not UTC', () => {
    const ics = toIcsCalendar([ev({})], 'Ayesha & Imran');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('DTSTART;TZID=Asia/Karachi:20270227T180000');
    expect(ics).toContain('DTEND;TZID=Asia/Karachi:20270227T233000');
    expect(ics).toContain('\r\n');
  });

  it('emits a whole-day entry for a TBA event instead of guessing a time', () => {
    const ics = toIcsCalendar([ev({ time_mode: 'tba', start_time: null, end_time: null })], 'X');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270227');
    expect(ics).not.toContain('DTEND');
  });

  it('escapes commas and semicolons that would otherwise corrupt the file', () => {
    const ics = toIcsCalendar([ev({ venue_name: 'Ivy House, Lawn', venue_address: 'A; B' })], 'X');
    expect(ics).toContain('Ivy House\\, Lawn');
    expect(ics).toContain('A\\; B');
  });
});
