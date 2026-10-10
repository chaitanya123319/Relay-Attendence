import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { api, getErrorMessage } from '@/lib/api'
import type { AppNotification } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'

/** Polls GET /notifications/me every 60 s; dropdown with mark-as-read. */
export default function NotificationsBell() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true)
    try {
      const { data } = await api.get<AppNotification[]>('/notifications/me')
      setItems(data)
      setError(null)
    } catch (err) {
      if (showLoading) setError(getErrorMessage(err))
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(false)
    const timer = window.setInterval(() => void load(false), 60_000)
    return () => window.clearInterval(timer)
  }, [load])

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
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void load(true)
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none tabular-nums">
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read
            </Button>
          )}
        </div>
        <div className="thin-scroll max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="px-3 py-6 text-center text-[13px] text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            items.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onSelect={() => {
                  if (!notification.readAt) void markRead(notification.id)
                }}
                className={cn(
                  'flex-col items-start gap-1 rounded-none border-b border-border/60 px-3 py-2.5 whitespace-normal last:border-b-0',
                  !notification.readAt && 'bg-muted/40',
                )}
              >
                <span className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      notification.readAt ? 'bg-muted-foreground/30' : 'bg-primary',
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn('truncate text-sm', !notification.readAt && 'font-medium')}
                  >
                    {notification.title}
                  </span>
                  <span className="tnum ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {timeAgo(notification.createdAt)}
                  </span>
                </span>
                <span className="pl-3.5 text-xs leading-relaxed text-muted-foreground">
                  {notification.body}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
