import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { api, getErrorMessage } from '../lib/api'
import type { AppNotification } from '../lib/types'
import { cn, timeAgo } from '../lib/utils'
import { Spinner } from './ui'

/** Polls GET /notifications/me every 60 s; dropdown with mark-as-read. */
export default function NotificationsBell() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true)
    try {
      const { data } = await api.get<AppNotification[]>('/notifications/me')
      setItems(data)
      setError(null)
    } catch (err) {
      if (showSpinner) setError(getErrorMessage(err))
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(false)
    const timer = window.setInterval(() => void load(false), 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const unread = items.filter((n) => !n.readAt).length

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)),
    )
    try {
      await api.post(`/notifications/${id}/read`)
    } catch {
      void load(false)
    }
  }

  const markAllRead = async () => {
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    )
    try {
      await api.post('/notifications/read-all')
    } catch {
      void load(false)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void load(true)
        }}
        className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-800">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <div className="thin-scroll max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="text-indigo-600" />
              </div>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-rose-600">{error}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet</p>
            ) : (
              items.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => {
                    if (!n.readAt) void markRead(n.id)
                  }}
                  className={cn(
                    'block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50',
                    !n.readAt && 'bg-indigo-50/60',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        n.readAt ? 'bg-slate-200' : 'bg-indigo-500',
                      )}
                    />
                    <span className="truncate text-sm font-medium text-slate-800">{n.title}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-3.5 text-xs leading-relaxed text-slate-500">{n.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
