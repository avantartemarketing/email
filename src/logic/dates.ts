/**
 * Calendar-day helpers. All day-level values in the app are ISO `YYYY-MM-DD`
 * strings; arithmetic goes through UTC noon so DST and timezone offsets can
 * never shift a date across midnight.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse `YYYY-MM-DD` (or a full ISO datetime) to a Date pinned at UTC noon. */
export function parseDay(iso: string): Date {
  const day = iso.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

/** Format a Date as `YYYY-MM-DD` using its UTC calendar day. */
export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return toDay(new Date(parseDay(day).getTime() + days * DAY_MS));
}

/** Whole days from `a` to `b`; positive when `b` is later. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY_MS);
}

/** Today as `YYYY-MM-DD` in the local timezone. */
export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** "12 March 2026" — the format used in email copy and the UI. */
export function formatDay(day: string | null | undefined): string {
  if (!day) return '—';
  const d = parseDay(day);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "12 Mar 2026" — compact table format. */
export function formatDayShort(day: string | null | undefined): string {
  if (!day) return '—';
  const d = parseDay(day);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Full timestamp for history entries, e.g. "12 Mar 2026, 14:05". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
