import type { EventRow } from '@/lib/queries';

/**
 * Wall-clock formatting.
 *
 * Times are stored as a plain `time` plus the venue's IANA timezone and are rendered EXACTLY as
 * stored, with the zone named alongside. We deliberately never convert to the viewer's local time:
 * a guest reading from London will physically be in Karachi on the day, so converting would show
 * them a time they must then convert back. Labelling is correct; converting is actively dangerous.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


/**
 * Normalise a Postgres `date`/`time` value to a plain string.
 *
 * Both drivers hand back a JS Date for `date` columns, so a naive `String(v).slice(0,10)` yields
 * "Fri Feb 26" rather than "2027-02-26". Formatting via UTC getters avoids the other trap: using
 * local getters would shift the calendar day for anyone west of UTC.
 */
export function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value ?? '').slice(0, 10);
}

/** Normalise a Postgres `time` value ("18:00:00", or a Date on some drivers) to "HH:MM". */
export function toClockTime(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) {
    return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
  }
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** "18:00:00" -> "6:00 pm". Returns '' for null. */
export function formatTime(t: string | null | undefined): string {
  if (!t) return '';
  const [hRaw, mRaw] = toClockTime(t).split(':');
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (Number.isNaN(h)) return '';
  const suffix = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Render an event's time span, honouring the TBA state rather than inventing a time. */
export function formatTimeSpan(e: Pick<EventRow, 'time_mode' | 'start_time' | 'end_time'>): string {
  if (e.time_mode === 'tba') return 'Time to be confirmed';
  const start = formatTime(e.start_time);
  if (!start) return 'Time to be confirmed';
  if (e.time_mode === 'start_only' || !e.end_time) return start;
  return `${start} – ${formatTime(e.end_time)}`;
}

/** A short, human timezone label: "Asia/Karachi" -> "Karachi time". */
export function timezoneLabel(tz: string): string {
  const city = tz.split('/').pop()?.replace(/_/g, ' ');
  return city ? `${city} time` : tz;
}

/** "2027-02-27" -> { weekday: "Saturday", day: 27, month: "February", year: 2027 } */
export function parseDate(dateStr: string) {
  const iso = toIsoDate(dateStr);
  const [y, m, d] = iso.split('-').map(Number);
  // Construct in UTC so the calendar date never shifts under the runner's local zone.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    iso,
    weekday: DAYS[dt.getUTCDay()],
    day: d,
    month: MONTHS[m - 1],
    monthNumber: m,
    year: y,
  };
}

export function formatDayHeader(dateStr: string): string {
  const { weekday, day, month } = parseDate(dateStr);
  return `${weekday} ${day} ${month}`;
}

/** The day rail, longhand: "Saturday" / "February Twenty Seventh". */
export function dayPartsInWords(dateStr: unknown) {
  const { weekday, day, month } = parseDate(String(toIsoDate(dateStr)));
  return { weekday, dateWords: `${month} ${ORDINALS[day] ?? day}` };
}

export interface DayGroup {
  date: string;
  header: string;
  /** Split parts, so the rail can break deterministically rather than wherever it happens to fit. */
  weekday: string;
  dayNumber: number;
  monthName: string;
  events: EventRow[];
}

/**
 * Group events by calendar day, preserving the incoming order within each day.
 *
 * Day headers are the scanning anchors that make a 3-8 event weekend legible. They are also what
 * lets us avoid day tabs: no verified wedding-site builder uses tabs, and tabs hide the shape of
 * the weekend, which is precisely what a multi-day guest needs to understand.
 */
export function groupByDay(events: EventRow[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of events) {
    const iso = toIsoDate(e.event_date);
    const last = groups[groups.length - 1];
    if (last && last.date === iso) {
      last.events.push(e);
    } else {
      const { weekday, day, month } = parseDate(iso);
      groups.push({
        date: iso,
        header: formatDayHeader(iso),
        weekday,
        dayNumber: day,
        monthName: month,
        events: [e],
      });
    }
  }
  return groups;
}

/**
 * Collapse a run of consecutive events at the same venue so the address is stated once.
 * Real multi-event sites frequently hold every event at one venue; repeating the address six times
 * is noise that pushes the useful content off the screen.
 */
export function shouldRepeatVenue(events: EventRow[], index: number): boolean {
  if (index === 0) return true;
  const prev = events[index - 1];
  const cur = events[index];
  return !(prev.venue_name === cur.venue_name && prev.venue_address === cur.venue_address);
}

/** Google Maps deep link, per the documented URL API. */
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function mapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/**
 * Build an .ics calendar entry for one event.
 *
 * The floating-time form (no Z, no TZID offset maths) plus an explicit VTIMEZONE-free DTSTART means
 * the entry lands at the venue's wall-clock time in every calendar client, which is what we want.
 */
export function toIcsEvent(e: EventRow, coupleNames: string): string {
  const iso = toIsoDate(e.event_date).replace(/-/g, '');
  const t = (time: string | null) => {
    const hhmm = toClockTime(time);
    return hhmm ? hhmm.replace(':', '') + '00' : '090000';
  };
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VEVENT',
    `UID:${e.id}@wedding`,
    `DTSTAMP:${iso}T000000Z`,
    e.time_mode === 'tba' ? `DTSTART;VALUE=DATE:${iso}` : `DTSTART;TZID=${e.timezone}:${iso}T${t(e.start_time)}`,
  ];
  if (e.time_mode !== 'tba' && e.end_time) lines.push(`DTEND;TZID=${e.timezone}:${iso}T${t(e.end_time)}`);
  lines.push(
    `SUMMARY:${esc(`${e.name} — ${coupleNames}`)}`,
    `LOCATION:${esc([e.venue_name, e.venue_address].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${esc([e.blurb, e.dress_code && `Dress code: ${e.dress_code}`].filter(Boolean).join('\n\n'))}`,
    'END:VEVENT',
  );
  return lines.join('\r\n');
}

export function toIcsCalendar(events: EventRow[], coupleNames: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wedding-rsvp//EN',
    'CALSCALE:GREGORIAN',
    ...events.map((e) => toIcsEvent(e, coupleNames)),
    'END:VCALENDAR',
  ].join('\r\n');
}

/* ---------------------------------------------------------------------------
   Longhand dates and times.

   This is the single most distinctive thing about the Bliss & Bone templates, and it is copied
   deliberately. Their published sites never print a numeral in an event block:

     h3: "August Fifteenth Two Thousand Twenty Four"
     h4: "Five in the Afternoon  ·  Formal Attire"
     h4: "Saturday, October Sixth Twenty Twenty Seven"

   Harvested from myblissandbone.com/kelsey, /avril and /aspen.
   --------------------------------------------------------------------------- */

const ORDINALS = [
  '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
  'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth',
  'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth', 'Twenty First', 'Twenty Second',
  'Twenty Third', 'Twenty Fourth', 'Twenty Fifth', 'Twenty Sixth', 'Twenty Seventh',
  'Twenty Eighth', 'Twenty Ninth', 'Thirtieth', 'Thirty First',
];

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty'];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

/** 2027 -> "Two Thousand Twenty Seven". */
export function yearInWords(year: number): string {
  if (year < 2000 || year > 2099) return String(year);
  const rest = year - 2000;
  if (rest === 0) return 'Two Thousand';
  return `Two Thousand ${twoDigitWords(rest)}`;
}

/** "2027-02-27" -> "Saturday, February Twenty Seventh Two Thousand Twenty Seven". */
export function dateInWords(dateStr: unknown, withWeekday = true): string {
  const { weekday, day, month, year } = parseDate(String(toIsoDate(dateStr)));
  if (!month) return '';
  const core = `${month} ${ORDINALS[day] ?? day} ${yearInWords(year)}`;
  return withWeekday ? `${weekday}, ${core}` : core;
}

/**
 * "18:00" -> "Six in the Evening". "17:30" -> "Half Past Five in the Afternoon".
 * On the hour it reads as the templates do; off the hour it stays readable rather than contorted.
 */
export function timeInWords(value: unknown): string {
  const hhmm = toClockTime(value);
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);

  const partOfDay =
    h < 12 ? 'in the Morning' : h < 17 ? 'in the Afternoon' : h < 21 ? 'in the Evening' : 'at Night';

  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const hourWord = hour12 === 12 && h === 12 ? 'Noon' : hour12 === 12 && h === 0 ? 'Midnight' : ONES[hour12];

  if (hourWord === 'Noon' || hourWord === 'Midnight') return hourWord;
  if (m === 0) return `${hourWord} ${partOfDay}`;
  if (m === 30) return `Half Past ${hourWord} ${partOfDay}`;
  if (m === 15) return `Quarter Past ${hourWord} ${partOfDay}`;
  if (m === 45) {
    const next = (hour12 % 12) + 1;
    return `Quarter To ${ONES[next]} ${partOfDay}`;
  }
  return `${hourWord} ${twoDigitWords(m)} ${partOfDay}`;
}

/** The whole event line, as the source templates set it. */
export function timeSpanInWords(e: Pick<EventRow, 'time_mode' | 'start_time' | 'end_time'>): string {
  if (e.time_mode === 'tba') return 'Time to be Confirmed';
  const start = timeInWords(e.start_time);
  return start || 'Time to be Confirmed';
}
