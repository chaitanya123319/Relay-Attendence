import type { Role } from './types'

export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ')

const pad = (n: number): string => String(n).padStart(2, '0')

/** Local "today" as YYYY-MM-DD (company TZ default is Asia/Kolkata; dashboards run in IST). */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function currentMonth(): string {
  return todayISO().slice(0, 7)
}

export function firstDayOfMonth(month: string): string {
  return `${month}-01`
}

export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${y}-${pad(m)}-${pad(d.getDate())}`
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** YYYY-MM-DD → "09 Oct 2026" */
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`
}

export function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return month
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso.slice(0, 10))
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ── visual meta ────────────────────────────────────────────────────────── */

export interface ChipMeta {
  label: string
  cls: string
}

const chip = (cls: string, label: string): ChipMeta => ({ label, cls })

export const STATUS_META: Record<string, ChipMeta> = {
  PRESENT: chip('border-emerald-200 bg-emerald-50 text-emerald-700', 'Present'),
  LATE: chip('border-amber-200 bg-amber-50 text-amber-700', 'Late'),
  HALF_DAY: chip('border-sky-200 bg-sky-50 text-sky-700', 'Half day'),
  INCOMPLETE: chip('border-orange-200 bg-orange-50 text-orange-700', 'Incomplete'),
  NOT_CHECKED_IN: chip('border-slate-200 bg-slate-50 text-slate-600', 'Not checked in'),
  ABSENT: chip('border-rose-200 bg-rose-50 text-rose-700', 'Absent'),
  ON_LEAVE: chip('border-violet-200 bg-violet-50 text-violet-700', 'On leave'),
  UPCOMING: chip('border-slate-200 bg-slate-50 text-slate-500', 'Upcoming'),
  WEEKLY_OFF: chip('border-slate-200 bg-slate-50 text-slate-500', 'Weekly off'),
  PENDING: chip('border-amber-200 bg-amber-50 text-amber-700', 'Pending'),
  APPROVED: chip('border-emerald-200 bg-emerald-50 text-emerald-700', 'Approved'),
  REJECTED: chip('border-rose-200 bg-rose-50 text-rose-700', 'Rejected'),
  CANCELLED: chip('border-slate-200 bg-slate-100 text-slate-500', 'Cancelled'),
}

export const FLAG_META: Record<string, ChipMeta> = {
  OUT_OF_RANGE: chip('border-rose-200 bg-rose-50 text-rose-700', 'Out of range'),
  TIME_DRIFT: chip('border-amber-200 bg-amber-50 text-amber-700', 'Time drift'),
}

export function statusMeta(status: string): ChipMeta {
  return STATUS_META[status] ?? chip('border-slate-200 bg-slate-50 text-slate-600', status)
}

export function flagMeta(flag: string): ChipMeta {
  return FLAG_META[flag] ?? chip('border-slate-200 bg-slate-50 text-slate-600', flag)
}

export const ROLE_META: Record<Role, ChipMeta> = {
  ADMIN: chip('border-violet-200 bg-violet-50 text-violet-700', 'Admin'),
  HR: chip('border-sky-200 bg-sky-50 text-sky-700', 'HR'),
  MANAGER: chip('border-indigo-200 bg-indigo-50 text-indigo-700', 'Manager'),
  ENGINEER: chip('border-emerald-200 bg-emerald-50 text-emerald-700', 'Engineer'),
}

/** Landing route per role. */
export function homeFor(role: Role): string {
  return role === 'ENGINEER' ? '/mobile' : '/team'
}
