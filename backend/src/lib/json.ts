/** Safe JSON helpers for String columns that hold serialized JSON (SQLite has no Json type). */

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const toJson = (value: unknown): string => JSON.stringify(value ?? null);
