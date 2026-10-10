/** Date/time helpers — all business dates are YYYY-MM-DD strings, device-local. */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time date string for a Date (never UTC-shifted). */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a YYYY-MM-DD business date into a local Date (no UTC shift). */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toMonthStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1 + delta, 1);
  return toMonthStr(d);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

/** "12 Oct 2026" from a YYYY-MM-DD business date. */
export function formatDateStr(s: string): string {
  const d = parseDateStr(s);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "12 Oct" from a YYYY-MM-DD business date. */
export function formatDateShort(s: string): string {
  const d = parseDateStr(s);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function formatWeekday(s: string): string {
  return parseDateStr(s).toLocaleDateString(undefined, { weekday: 'short' });
}

/** "14:05" from a full ISO timestamp. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "12 Oct, 14:05" from a full ISO timestamp. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}, ${formatTime(iso)}`;
}

/** Minutes → "7h 20m". */
export function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Relative "3h ago" / "2d ago" for notification timestamps. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(iso);
}

export function daysBetweenInclusive(from: string, to: string): number {
  const a = parseDateStr(from).getTime();
  const b = parseDateStr(to).getTime();
  return Math.round((b - a) / 86400000) + 1;
}
