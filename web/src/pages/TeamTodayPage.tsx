import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import AttendanceMap from '@/components/AttendanceMap'
import type { MapMarker, MapSite } from '@/components/AttendanceMap'
import RecordDetailModal from '@/components/RecordDetailModal'
import { FlagBadge, StatusBadge } from '@/components/badges'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, getErrorMessage } from '@/lib/api'
import type { Site, TeamBoardResponse, TeamStatus } from '@/lib/types'
import { cn, fmtDate, fmtMinutes, fmtTime, statusMeta, todayISO } from '@/lib/utils'

const STATUS_ORDER: TeamStatus[] = [
  'PRESENT',
  'LATE',
  'HALF_DAY',
  'INCOMPLETE',
  'ON_LEAVE',
  'NOT_CHECKED_IN',
  'ABSENT',
  'UPCOMING',
]

/**
 * Leaflet paints marker geometry through SVG attributes, which cannot resolve
 * utility classes — literal values mirror the status-chip hue families.
 */
const MARKER_COLORS: Record<string, string> = {
  PRESENT: '#10b981',
  LATE: '#f59e0b',
  HALF_DAY: '#0ea5e9',
  INCOMPLETE: '#f97316',
}

/** Distances read in metres under 1 km, kilometres (2 dp) beyond — DESIGN.md. */
function fmtDistance(meters: number | null): string {
  if (meters === null) return '—'
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`
}

export default function TeamTodayPage() {
  const { user } = useAuth()
  const [date, setDate] = useState(todayISO())
  const [siteId, setSiteId] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [board, setBoard] = useState<TeamBoardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null)

  /* Managers only pick among the sites they are assigned to (server scopes the board). */
  const loadSites = useCallback(async () => {
    try {
      const { data } = await api.get<Site[]>('/sites')
      const managerId = user?.id
      const visible =
        user?.role === 'MANAGER' && managerId
          ? data.filter((site) => site.assignments.some((a) => a.userId === managerId))
          : data
      setSites(visible)
    } catch {
      /* the site filter stays empty; the board itself still works */
    }
  }, [user])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { date }
      if (siteId) params.siteId = siteId
      const { data } = await api.get<TeamBoardResponse>('/attendance/team', { params })
      setBoard(data)
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      toast.error('Couldn’t refresh the board', { description: message })
    } finally {
      setLoading(false)
    }
  }, [date, siteId])

  useEffect(() => {
    void loadSites()
  }, [loadSites])

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo(() => {
    const list = board?.items ?? []
    return [...list].sort((a, b) => {
      const diff = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      return diff !== 0 ? diff : a.user.name.localeCompare(b.user.name)
    })
  }, [board])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of board?.items ?? []) map.set(item.status, (map.get(item.status) ?? 0) + 1)
    return map
  }, [board])

  const mapSites = useMemo<MapSite[]>(() => {
    const byId = new Map<string, MapSite>()
    for (const item of board?.items ?? []) {
      byId.set(item.site.id, {
        id: item.site.id,
        name: item.site.name,
        lat: item.site.lat,
        lng: item.site.lng,
        radiusM: item.site.radiusM,
      })
    }
    if (siteId) {
      const site = sites.find((s) => s.id === siteId)
      if (site) {
        byId.set(site.id, {
          id: site.id,
          name: site.name,
          lat: site.lat,
          lng: site.lng,
          radiusM: site.radiusM,
        })
      }
    }
    return [...byId.values()]
  }, [board, siteId, sites])

  const markers = useMemo<MapMarker[]>(
    () =>
      (board?.items ?? [])
        .filter((item) => item.record !== null)
        .map((item) => {
          const record = item.record!
          return {
            id: record.id,
            lat: record.checkIn.lat,
            lng: record.checkIn.lng,
            color: MARKER_COLORS[item.status] ?? '#64748b',
            title: item.user.name,
            lines: [
              `${statusMeta(item.status).label} · in at ${fmtTime(record.checkIn.time)}`,
              record.checkIn.distanceMeters === null
                ? item.site.name
                : `${fmtDistance(record.checkIn.distanceMeters)} from ${item.site.name}`,
            ],
          }
        }),
    [board],
  )

  const activeFilters = date !== todayISO() || siteId !== ''

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Team today</h1>
          <p className="text-[13px] text-muted-foreground">
            Live attendance board — roster, geofence distance, flags and photo proof
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="size-4" aria-hidden />
          Refresh
        </Button>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="team-date" className="text-muted-foreground">
              Date
            </Label>
            <Input
              id="team-date"
              type="date"
              className="w-44"
              value={date}
              onChange={(e) => setDate(e.target.value || todayISO())}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">Site</Label>
            <Select
              value={siteId === '' ? 'all' : siteId}
              onValueChange={(value) => setSiteId(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sites</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pb-1.5">
            {STATUS_ORDER.filter((status) => (counts.get(status) ?? 0) > 0).map((status) => (
              <span key={status} className="inline-flex items-center gap-1">
                <StatusBadge status={status} />
                <span className="tnum text-xs text-muted-foreground">{counts.get(status)}</span>
              </span>
            ))}
          </div>
          {activeFilters && (
            <Button
              variant="link"
              size="sm"
              className="mb-0.5"
              onClick={() => {
                setDate(todayISO())
                setSiteId('')
              }}
            >
              Reset to today
            </Button>
          )}
        </div>
      </Card>

      {error && !loading && !board && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Couldn&apos;t load the board</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden py-0 xl:col-span-2">
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Employee
                </TableHead>
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Site
                </TableHead>
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  In
                </TableHead>
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Out
                </TableHead>
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Distance
                </TableHead>
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Worked
                </TableHead>
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Flags
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, row) => (
                  <TableRow key={row} className="h-10 hover:bg-transparent">
                    {Array.from({ length: 8 }).map((__, cell) => (
                      <TableCell key={cell} className="px-3 py-2">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="h-40 text-center whitespace-normal">
                    <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                      <Users className="size-6" aria-hidden />
                      <span className="text-sm font-medium text-foreground">
                        No engineers on this board
                      </span>
                      <span className="max-w-md text-[13px]">
                        {siteId
                          ? 'No active engineers are assigned to this site, or none match the selected date.'
                          : 'No active engineers are assigned to your sites yet.'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow
                    key={item.user.id}
                    className={cn('h-10', item.record && 'cursor-pointer')}
                    tabIndex={item.record ? 0 : undefined}
                    onClick={() => {
                      if (item.record) setSelectedRecord(item.record.id)
                    }}
                    onKeyDown={(event) => {
                      if (item.record && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault()
                        setSelectedRecord(item.record.id)
                      }
                    }}
                    title={item.record ? 'Open photo + record detail' : undefined}
                  >
                    <TableCell className="px-3 py-2">
                      <span className="font-medium">{item.user.name}</span>
                      <span className="tnum ml-2 text-xs text-muted-foreground">
                        {item.user.employeeId}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2">{item.site.name}</TableCell>
                    <TableCell className="px-3 py-2">
                      <StatusBadge status={item.status} />
                      {item.status === 'ON_LEAVE' && item.leaveType && (
                        <div className="mt-1 text-xs text-muted-foreground">{item.leaveType}</div>
                      )}
                    </TableCell>
                    <TableCell className="tnum px-3 py-2">
                      {item.record ? fmtTime(item.record.checkIn.time) : '—'}
                    </TableCell>
                    <TableCell className="tnum px-3 py-2">
                      {item.record?.checkOut ? fmtTime(item.record.checkOut.time) : '—'}
                    </TableCell>
                    <TableCell className="tnum px-3 py-2">
                      {item.record ? fmtDistance(item.record.checkIn.distanceMeters) : '—'}
                    </TableCell>
                    <TableCell className="tnum px-3 py-2">
                      {item.record ? fmtMinutes(item.record.workedMinutes) : '—'}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(item.record?.flags ?? []).map((flag) => (
                          <FlagBadge key={flag} flag={flag} />
                        ))}
                        {(!item.record || item.record.flags.length === 0) && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <div className="text-sm font-medium">Site map</div>
              <div className="tnum text-[13px] text-muted-foreground">
                {fmtDate(board?.date ?? date)} · geofences + check-in fixes
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusBadge status="PRESENT" />
              <StatusBadge status="LATE" />
            </div>
          </div>
          <AttendanceMap sites={mapSites} markers={markers} />
        </Card>
      </div>

      <RecordDetailModal recordId={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  )
}
