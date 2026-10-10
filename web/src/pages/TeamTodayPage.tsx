import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import AttendanceMap from '../components/AttendanceMap'
import type { MapMarker, MapSite } from '../components/AttendanceMap'
import RecordDetailModal from '../components/RecordDetailModal'
import {
  btnOutline,
  cardCls,
  Chip,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  StatusChip,
  FlagChip,
  inputCls,
} from '../components/ui'
import { api, getErrorMessage } from '../lib/api'
import type { Site, TeamBoardResponse, TeamStatus } from '../lib/types'
import { cn, fmtDate, fmtMinutes, fmtTime, statusMeta, todayISO } from '../lib/utils'

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

const MARKER_COLORS: Record<string, string> = {
  PRESENT: '#10b981',
  LATE: '#f59e0b',
  HALF_DAY: '#0ea5e9',
  INCOMPLETE: '#f97316',
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
      setError(getErrorMessage(err))
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
                : `${record.checkIn.distanceMeters} m from ${item.site.name}`,
            ],
          }
        }),
    [board],
  )

  const activeFilters = date !== todayISO() || siteId !== ''

  return (
    <div>
      <PageHeader
        title="Team today"
        subtitle="Live attendance board — roster, geofence distance, flags and photo proof"
        actions={
          <button type="button" className={btnOutline} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className={cn(cardCls, 'mb-5 p-4')}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Date
            </span>
            <input
              type="date"
              className={cn(inputCls, 'w-44')}
              value={date}
              onChange={(e) => setDate(e.target.value || todayISO())}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Site
            </span>
            <select
              className={cn(inputCls, 'w-56')}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            {STATUS_ORDER.filter((status) => (counts.get(status) ?? 0) > 0).map((status) => {
              const meta = statusMeta(status)
              return (
                <Chip
                  key={status}
                  label={`${meta.label} · ${counts.get(status) ?? 0}`}
                  cls={meta.cls}
                />
              )
            })}
          </div>
          {activeFilters && (
            <button
              type="button"
              className="pb-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
              onClick={() => {
                setDate(todayISO())
                setSiteId('')
              }}
            >
              Reset to today
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-5">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className={cn(cardCls, 'overflow-hidden xl:col-span-2')}>
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6 text-indigo-600" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No engineers on this board"
              message={
                siteId
                  ? 'No active engineers are assigned to this site, or none match the selected date.'
                  : 'No active engineers are assigned to your sites yet.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Site</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">In</th>
                    <th className="px-4 py-3">Out</th>
                    <th className="px-4 py-3">Distance</th>
                    <th className="px-4 py-3">Worked</th>
                    <th className="px-4 py-3">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.user.id}
                      onClick={() => {
                        if (item.record) setSelectedRecord(item.record.id)
                      }}
                      className={cn(
                        'border-b border-slate-100 last:border-b-0',
                        item.record ? 'cursor-pointer hover:bg-indigo-50/40' : 'hover:bg-slate-50',
                      )}
                      title={item.record ? 'Open photo + record detail' : undefined}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{item.user.name}</div>
                        <div className="text-xs text-slate-400">{item.user.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.site.name}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={item.status} />
                        {item.status === 'ON_LEAVE' && item.leaveType && (
                          <div className="mt-1 text-xs text-slate-400">{item.leaveType}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {item.record ? fmtTime(item.record.checkIn.time) : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {item.record?.checkOut ? fmtTime(item.record.checkOut.time) : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {item.record && item.record.checkIn.distanceMeters !== null
                          ? `${item.record.checkIn.distanceMeters} m`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {item.record ? fmtMinutes(item.record.workedMinutes) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(item.record?.flags ?? []).map((flag) => (
                            <FlagChip key={flag} flag={flag} />
                          ))}
                          {(!item.record || item.record.flags.length === 0) && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={cn(cardCls, 'overflow-hidden')}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">Site map</div>
              <div className="text-xs text-slate-400">
                {fmtDate(board?.date ?? date)} · geofences + check-in fixes
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Late
              </span>
            </div>
          </div>
          <div className="relative z-0 h-96">
            <AttendanceMap sites={mapSites} markers={markers} />
          </div>
        </div>
      </div>

      <RecordDetailModal recordId={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  )
}
