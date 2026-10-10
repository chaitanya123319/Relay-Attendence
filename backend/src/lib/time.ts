/**
 * Timezone-aware date helpers.
 *
 * The company works in one business timezone (COMPANY_TZ, default Asia/Kolkata).
 * Business dates ("YYYY-MM-DD") are always derived from the SERVER clock in that
 * timezone — never from client-supplied timestamps (anti-fraud requirement).
 */
import { env } from '../config/env';

/** "YYYY-MM-DD" for a Date, in the company timezone. */
export function dateStrInTZ(d: Date, tz: string = env.COMPANY_TZ): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Minutes since midnight for a Date, in the company timezone. */
export function minutesOfDayInTZ(d: Date, tz: string = env.COMPANY_TZ): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

/** Today's business date string. */
export function todayStr(tz: string = env.COMPANY_TZ): string {
  return dateStrInTZ(new Date(), tz);
}

/** Parse "HH:mm" into minutes since midnight. */
export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => Number(x));
  return h * 60 + m;
}

/** Add n days to a "YYYY-MM-DD" string (UTC-safe: pure calendar math). */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Difference in whole days: b - a (can be negative). */
export function diffDays(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00.000Z`);
  const db = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((db - da) / 86_400_000);
}

/** All date strings from `from` to `to`, inclusive. */
export function datesInRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** All date strings of a "YYYY-MM" month. */
export function monthDates(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from(
    { length: last },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
  );
}

/** Day of week for a date string: 0 = Sunday … 6 = Saturday (calendar math, TZ-free). */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
}

/** Weekly off days (Sunday) — used by the absent-day computation. */
export const WEEKLY_OFF_DAYS = [0];

export function isWeeklyOff(dateStr: string): boolean {
  return WEEKLY_OFF_DAYS.includes(weekdayOf(dateStr));
}

/** Validate "YYYY-MM" / "YYYY-MM-DD" strings. */
export const isMonthStr = (s: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const isDateStr = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);
