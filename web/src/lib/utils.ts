export { cn } from "cn"

import type { Role } from './types'

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

/** Badge tint classes; dark variants included so chips read on both themes. */
export const STATUS_META: Record<string, ChipMeta> = {
  PRESENT: chip('border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', 'Present'),
  LATE: chip('border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400', 'Late'),
  HALF_DAY: chip('border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-400', 'Half day'),
  INCOMPLETE: chip('border-orange-600/20 bg-orange-500/10 text-orange-700 dark:text-orange-400', 'Incomplete'),
  NOT_CHECKED_IN: chip('border-border bg-muted text-muted-foreground', 'Not checked in'),
  ABSENT: chip('border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-400', 'Absent'),
  ON_LEAVE: chip('border-violet-600/20 bg-violet-500/10 text-violet-700 dark:text-violet-400', 'On leave'),
  UPCOMING: chip('border-border bg-muted text-muted-foreground', 'Upcoming'),
  WEEKLY_OFF: chip('border-border bg-muted text-muted-foreground', 'Weekly off'),
  PENDING: chip('border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400', 'Pending'),
  APPROVED: chip('border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', 'Approved'),
  REJECTED: chip('border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-400', 'Rejected'),
  CANCELLED: chip('border-border bg-muted text-muted-foreground', 'Cancelled'),
}

export const FLAG_META: Record<string, ChipMeta> = {
  OUT_OF_RANGE: chip('border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-400', 'Out of range'),
  TIME_DRIFT: chip('border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400', 'Time drift'),
}

export function statusMeta(status: string): ChipMeta {
  return STATUS_META[status] ?? chip('border-border bg-muted text-muted-foreground', status)
}

export function flagMeta(flag: string): ChipMeta {
  return FLAG_META[flag] ?? chip('border-border bg-muted text-muted-foreground', flag)
}

export const ROLE_META: Record<Role, ChipMeta> = {
  ADMIN: chip('border-violet-600/20 bg-violet-500/10 text-violet-700 dark:text-violet-400', 'Admin'),
  HR: chip('border-sky-600/20 bg-sky-500/10 text-sky-700 dark:text-sky-400', 'HR'),
  MANAGER: chip('border-indigo-600/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400', 'Manager'),
  ENGINEER: chip('border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', 'Engineer'),
}

/** Landing route per role. */
export function homeFor(role: Role): string {
  return role === 'ENGINEER' ? '/mobile' : '/team'
}
