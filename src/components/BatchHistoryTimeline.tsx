import type { ReactElement } from 'react';
import type { BatchEvent } from '../types';
import { formatDay } from '../logic/dates';
import { Empty } from '../ui/rd';

/**
 * Immutable batch history, newest first, in the kit's activity vocabulary:
 * one rail down the left, a dot per entry, days as headings, and the time and
 * the person who did it held out to the right.
 *
 * Grouped by day rather than stamped per row, because a batch's story is read
 * as "what happened on the 26th" and eleven rows each repeating their own date
 * is eleven copies of one fact. The rail is what makes the grouping legible
 * without a second rule between the days.
 *
 * A reschedule says its two dates in the row itself: it is the one event whose
 * description ("4 orders split out to Framed 3") does not carry the thing that
 * actually changed.
 */
export function BatchHistoryTimeline({ events }: { events: BatchEvent[] }): ReactElement {
  if (events.length === 0) {
    return <Empty>Nothing has happened to this batch yet.</Empty>;
  }

  // Newest first, and each day's entries under one heading.
  const days: { day: string; entries: BatchEvent[] }[] = [];
  for (const event of events) {
    const day = event.at.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.day === day) last.entries.push(event);
    else days.push({ day, entries: [event] });
  }

  return (
    <div className="rd-log">
      <div className="rd-lograil" aria-hidden />
      {days.map(({ day, entries }) => (
        <div key={day}>
          <div className="rd-logday">{formatDay(day)}</div>
          {entries.map((event) => (
            <div className="rd-logrow" key={event.id}>
              <span className="rd-logdot" aria-hidden />
              <span>
                {event.type === 'reschedule' ? <b>{event.description}</b> : event.description}
                {event.type === 'reschedule' ? (
                  <> — {formatDay(event.data.oldDate ?? null)} → {formatDay(event.data.newDate)}</>
                ) : null}
              </span>
              <span className="rd-logwhen">
                {new Date(event.at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {event.byName}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
