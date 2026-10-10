import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'
import { cn, flagMeta, ROLE_META, statusMeta } from '../lib/utils'
import type { Role } from '../lib/types'

/* ── shared class presets ───────────────────────────────────────────────── */

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200'
export const btnPrimary = `${btnBase} bg-indigo-600 text-white hover:bg-indigo-500`
export const btnOutline = `${btnBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`
export const btnDanger = `${btnBase} border border-rose-200 bg-white text-rose-600 hover:bg-rose-50`
export const btnSubtle = `${btnBase} bg-slate-100 text-slate-700 hover:bg-slate-200`

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100'
export const labelCls =
  'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500'

export const cardCls = 'rounded-xl border border-slate-200 bg-white shadow-sm'

/* ── primitives ─────────────────────────────────────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Spinner className="h-8 w-8 text-indigo-600" />
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        cls,
      )}
    >
      {label}
    </span>
  )
}

export function StatusChip({ status }: { status: string }) {
  const meta = statusMeta(status)
  return <Chip label={meta.label} cls={meta.cls} />
}

export function FlagChip({ flag }: { flag: string }) {
  const meta = flagMeta(flag)
  return <Chip label={meta.label} cls={meta.cls} />
}

export function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role]
  return <Chip label={meta.label} cls={meta.cls} />
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-medium underline underline-offset-2 hover:text-rose-800"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function SuccessBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

/* ── modal ──────────────────────────────────────────────────────────────── */

const MODAL_SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: keyof typeof MODAL_SIZES
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn('w-full rounded-xl bg-white shadow-xl', MODAL_SIZES[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
