/** RFC-4180-ish CSV builder (quotes handled, CRLF line endings). */

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [headers, ...rows].map((r) => r.map(csvEscape).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
