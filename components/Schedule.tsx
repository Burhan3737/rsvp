import type { EventRow } from '@/lib/queries';
import {
  formatTimeSpan,
  groupByDay,
  mapsDirectionsUrl,
  shouldRepeatVenue,
  timeInWords,
  timeSpanInWords,
  timezoneLabel,
} from '@/lib/format';

/**
 * The multi-event schedule.
 *
 * LAYOUT DECISION — two research streams disagreed here, so the conflict is resolved explicitly:
 *
 *   Vendor convention (Joy ships a "Compact" accordion and recommends it for lengthy schedules)
 *   says collapse events behind a tap once there are six or more.
 *
 *   Real guest complaints say the opposite, and more loudly: guests must never have to tap to find
 *   when the ceremony starts, and they routinely screenshot the schedule — which an accordion breaks.
 *
 * Guest evidence wins. Everything renders expanded, always. Legibility at 8+ events comes from
 * sticky day headers and a left-anchored rail instead of from hiding content.
 *
 * The rail is anchored LEFT rather than centre-alternating, so it collapses to mobile with no layout
 * change at all — a centred alternating timeline breaks badly on a 375px screen.
 */

interface Props {
  events: EventRow[];
  /** Rendered on each event when the viewer is identified and may respond. */
  rsvpHref?: string;
  showRsvpHint?: boolean;
  /**
   * Base path for calendar downloads. Scoped to the household when identified, so a .ics can only
   * ever contain events that household can actually see — a per-guest calendar export is an easy
   * leak vector to miss.
   */
  calendarBase?: string;
  /**
   * How the template lays the schedule out. This is the densest thing on any wedding site and it is
   * where the real templates differ most, so it is the template's call rather than the theme's:
   *   list      a plain stack under sticky day headers
   *   timeline  a rule down the middle, events alternating either side
   *   cards     each event a bordered panel
   *   columns   days side by side across the page
   *   agenda    a tight two-column time/detail table, as printed stationery sets it
   */
  layout?: 'list' | 'timeline' | 'cards' | 'columns' | 'agenda' | 'ledger' | 'banded';
}

export function Schedule({
  events,
  rsvpHref,
  showRsvpHint,
  calendarBase = '/calendar',
  layout = 'list',
}: Props) {
  if (!events.length) {
    return (
      <p className="muted" style={{ maxWidth: '46ch' }}>
        The schedule is still being finalised. It will appear here as soon as it is settled.
      </p>
    );
  }

  const days = groupByDay(events);

  /**
   * The timeline lays events out down ONE central rule, alternating sides. That only works if every
   * event is a sibling of every other — and the day-grouped markup opens a fresh `<ol>` per day, so
   * with one event on each day `nth-child(even)` never matched a single element and the alternation,
   * the stagger and the left-hand node were all unreachable code. It rendered as a narrow single
   * column with six stray rule stubs beside it.
   *
   * So the timeline flattens: one list for the whole schedule, with the day carried on the event
   * itself. Every other layout keeps the day grouping, which is what makes the sticky day header
   * work.
   */
  // `cards` flattens for the same reason `timeline` does: the grid is declared on the list, and a
  // list per day holding one event each is a one-up grid with an empty second column, six times
  // over. That is the identical defect the first audit found in the timeline, and it reappeared in
  // `cards` because the fix was applied to one layout rather than to the cause.
  const flat = layout === 'timeline' || layout === 'cards';

  if (flat) {
    return (
      <div className={`schedule schedule-${layout}`}>
        <ol className="schedule-list">
          {events.map((e) => {
            const day = days.find((d) => d.events.includes(e));
            const siblings = day ? day.events : events;
            // The index has to be the one WITHIN the day, not within the flattened list —
            // `shouldRepeatVenue` reads `events[index - 1]`, and a global index against a
            // single-day array walks straight off the end of it.
            const i = siblings.indexOf(e);
            const first = i === 0;
            return (
              <li key={e.id} className={`schedule-item${e.is_main ? ' is-main' : ''}`}>
                <span className="schedule-node" aria-hidden="true" />
                <div className="schedule-body">
                  {first && day ? (
                    <p className="label schedule-daymark">
                      {day.weekday} {day.dayNumber} {day.monthName}
                    </p>
                  ) : null}
                  {renderEvent(e, i, siblings, rsvpHref, showRsvpHint, calendarBase)}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className={`schedule schedule-${layout}`}>
      {days.map((day) => (
        <section key={day.date} className="schedule-day" aria-labelledby={`day-${day.date}`}>
          {/* Weekday and date are separate spans so the break is deterministic. Letting the rail
              wrap on its own produced "Wednesday / 24 / February" beside "Friday 26 / February",
              stranding a lone numeral on its own line. */}
          <h3 id={`day-${day.date}`} className="schedule-day-header display display-md">
            <span className="day-weekday">{day.weekday}</span>{' '}
            <span className="day-date">
              {day.dayNumber} {day.monthName}
            </span>
          </h3>

          <ol className="schedule-list">
            {day.events.map((e, i) => (
              <li key={e.id} className={`schedule-item${e.is_main ? ' is-main' : ''}`}>
                <span className="schedule-node" aria-hidden="true" />

                <div className="schedule-body">
                  {renderEvent(e, i, day.events, rsvpHref, showRsvpHint, calendarBase)}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}


/**
 * One event's body, shared by every layout.
 *
 * Extracted because the timeline renders a single flat list while the others group by day; both
 * need identical content, and duplicating it is how the two drift apart.
 */
function renderEvent(
  e: EventRow,
  i: number,
  siblings: EventRow[],
  rsvpHref: string | undefined,
  showRsvpHint: boolean | undefined,
  calendarBase: string,
) {
  return (
    <>
        {/* Longhand, as the source templates set it: "Five in the Afternoon", never
            "5:00 PM". The numeric time follows so nobody has to decode it. */}
        <p className="label longhand schedule-time">
          {timeSpanInWords(e)}
          <span className="schedule-tz tnum">
            {' '}
            · {formatTimeSpan(e)} {timezoneLabel(e.timezone)}
          </span>
        </p>

        <h4 className="display display-md schedule-name">{e.name}</h4>

        {e.blurb ? <p className="schedule-blurb">{e.blurb}</p> : null}

        {shouldRepeatVenue(siblings, i) && e.venue_name ? (
          <p className="schedule-venue">
            <span className="schedule-venue-name">{e.venue_name}</span>
            {e.venue_address ? <span className="muted"> · {e.venue_address}</span> : null}
          </p>
        ) : (
          <p className="schedule-venue muted schedule-samevenue">Same venue as above</p>
        )}

        {e.arrive_by ? (
          <p className="schedule-arrive">
            <strong>Please arrive by {timeInWords(e.arrive_by)}</strong>
          </p>
        ) : null}

        {e.description ? <p className="schedule-desc muted">{e.description}</p> : null}

        <DressCode event={e} />

        {e.is_unplugged ? (
          <p className="schedule-unplugged">
            An unplugged ceremony — we have asked that phones and cameras stay away for this
            part, so that everyone is actually present for it.
          </p>
        ) : null}

        <div className="schedule-actions">
          {e.show_directions && e.venue_address ? (
            <a
              className="btn btn-ghost btn-sm"
              href={mapsDirectionsUrl(e.venue_address)}
              target="_blank"
              rel="noreferrer noopener"
            >
              Directions
            </a>
          ) : null}
          {e.show_add_to_calendar ? (
            <a className="btn btn-ghost btn-sm" href={`${calendarBase}/${e.slug}`}>
              Add to calendar
            </a>
          ) : null}
          {rsvpHref && e.rsvp_enabled ? (
            <a className="btn btn-ghost btn-sm" href={rsvpHref}>
              Reply
            </a>
          ) : null}
          {!e.rsvp_enabled && showRsvpHint ? (
            <span className="label schedule-norsvp">No reply needed — just come</span>
          ) : null}
        </div>
    </>
  );
}

/**
 * The attire block.
 *
 * Dress code is the single most-asked guest question, and mainstream guides currently tell guests to
 * text the couple about it — every one of those texts is a website failure.
 *
 * Colours are shown as actual swatches, not named in prose, so a guest sees the exact yellow for the
 * mayoun rather than the word "yellow". "Colours to avoid" is as load-bearing as "wear this" and is
 * culture-specific knowledge a guest cannot be expected to have. The permission line is something
 * only the couple can write, and it resolves an anxiety no blog post can.
 */
function DressCode({ event: e }: { event: EventRow }) {
  const swatches = Array.isArray(e.swatches) ? e.swatches : [];
  const avoid = Array.isArray(e.avoid_colours) ? e.avoid_colours : [];
  if (!e.dress_code && !e.dress_code_note && !swatches.length && !avoid.length && !e.modesty_note) return null;

  return (
    <div className="dresscode">
      {e.dress_code ? (
        <p className="dresscode-head">
          <span className="label">Wear</span> <span className="dresscode-label">{e.dress_code}</span>
        </p>
      ) : null}

      {e.dress_code_note ? <p className="dresscode-note">{e.dress_code_note}</p> : null}

      {swatches.length ? (
        <ul className="swatches" aria-label="Suggested colours">
          {swatches.map((s) => (
            <li key={s.hex} className="swatch">
              <span className="swatch-dot" style={{ background: s.hex }} aria-hidden="true" />
              <span className="swatch-label">{s.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {avoid.length ? (
        <ul className="swatches swatches-avoid" aria-label="Colours to avoid">
          {avoid.map((s) => (
            <li key={s.hex} className="swatch">
              <span className="swatch-dot swatch-dot-avoid" style={{ background: s.hex }} aria-hidden="true" />
              <span className="swatch-label">
                Not {s.label}
                {/* The reason is a quieter second line, not another em dash. Three consecutive
                    dashed lines in one block is a named tell of generated copy. */}
                {s.why ? <span className="swatch-why">{s.why}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {e.modesty_note ? <p className="dresscode-modesty">{e.modesty_note}</p> : null}
      {e.permission_note ? <p className="dresscode-permission">{e.permission_note}</p> : null}
    </div>
  );
}
