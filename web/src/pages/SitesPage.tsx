import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { SiteFormMap } from '../components/AttendanceMap'
import {
  btnOutline,
  btnPrimary,
  cardCls,
  Chip,
  EmptyState,
  ErrorBanner,
  Field,
  Modal,
  PageHeader,
  RoleBadge,
  Spinner,
  SuccessBanner,
  inputCls,
} from '../components/ui'
import { api, getErrorMessage } from '../lib/api'
import type { OutOfRangeBehavior, Site, SiteAssignment, SiteInput, User } from '../lib/types'
import { cn } from '../lib/utils'

/* ── create / edit modal ────────────────────────────────────────────────── */

function SiteFormModal({
  site,
  onClose,
  onSaved,
}: {
  site: Site | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const isEdit = site !== null
  const [name, setName] = useState(site?.name ?? '')
  const [address, setAddress] = useState(site?.address ?? '')
  const [latStr, setLatStr] = useState(String(site?.lat ?? 19.076))
  const [lngStr, setLngStr] = useState(String(site?.lng ?? 72.8777))
  const [radiusM, setRadiusM] = useState(site?.radiusM ?? 150)
  const [behavior, setBehavior] = useState<OutOfRangeBehavior>(site?.outOfRangeBehavior ?? 'REJECT')
  const [shiftStart, setShiftStart] = useState(site?.shiftStart ?? '09:00')
  const [shiftEnd, setShiftEnd] = useState(site?.shiftEnd ?? '18:00')
  const [grace, setGrace] = useState(site?.lateGraceMinutes ?? 15)
  const [halfDay, setHalfDay] = useState(site?.halfDayMinutes ?? 240)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lat = Number(latStr)
  const lng = Number(lngStr)
  const coordsValid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180

  const pickFromMap = (la: number, ln: number) => {
    setLatStr(la.toFixed(6))
    setLngStr(ln.toFixed(6))
  }

  const submit = async () => {
    if (name.trim().length < 2) return setError('Site name must be at least 2 characters.')
    if (address.trim().length < 2) return setError('Address must be at least 2 characters.')
    if (!coordsValid) {
      return setError('Latitude must be -90..90 and longitude -180..180 (pick on the map or type them).')
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(shiftStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(shiftEnd)) {
      return setError('Shift times must be HH:mm.')
    }

    const payload: SiteInput = {
      name: name.trim(),
      address: address.trim(),
      lat,
      lng,
      radiusM,
      outOfRangeBehavior: behavior,
      shiftStart,
      shiftEnd,
      lateGraceMinutes: grace,
      halfDayMinutes: halfDay,
    }

    setBusy(true)
    setError(null)
    try {
      if (isEdit && site) {
        await api.patch(`/sites/${site.id}`, payload)
        onSaved(`Site ${payload.name} updated.`)
      } else {
        await api.post('/sites', payload)
        onSaved(`Site ${payload.name} created.`)
      }
    } catch (err) {
      setError(getErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit ${site?.name ?? 'site'}` : 'New project site'}
      subtitle="Geofence, out-of-range policy and shift timing drive server-side attendance rules."
      size="xl"
      footer={
        <>
          <button type="button" className={btnOutline} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={() => void submit()} disabled={busy}>
            {busy && <Spinner />}
            {isEdit ? 'Save changes' : 'Create site'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <ErrorBanner message={error} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Address">
            <input
              className={inputCls}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, area, city"
            />
          </Field>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Location — click the map or drag the pin; numbers stay in sync
            </span>
            <span className={cn('text-xs', coordsValid ? 'text-slate-400' : 'text-rose-600')}>
              {coordsValid ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Invalid coordinates'}
            </span>
          </div>
          <SiteFormMap
            lat={coordsValid ? lat : 19.076}
            lng={coordsValid ? lng : 72.8777}
            radiusM={radiusM}
            onPick={pickFromMap}
          />
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Latitude">
              <input
                className={inputCls}
                type="number"
                step="any"
                value={latStr}
                onChange={(e) => setLatStr(e.target.value)}
              />
            </Field>
            <Field label="Longitude">
              <input
                className={inputCls}
                type="number"
                step="any"
                value={lngStr}
                onChange={(e) => setLngStr(e.target.value)}
              />
            </Field>
            <Field label="Geofence radius (m)">
              <input
                className={inputCls}
                type="number"
                min={10}
                max={5000}
                value={radiusM}
                onChange={(e) => setRadiusM(Math.round(Number(e.target.value) || 0))}
              />
            </Field>
            <div>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Radius slider
              </span>
              <input
                type="range"
                min={10}
                max={5000}
                step={10}
                value={Math.min(Math.max(radiusM, 10), 5000)}
                onChange={(e) => setRadiusM(Number(e.target.value))}
                className="mt-2 w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Out-of-range behavior">
            <select
              className={inputCls}
              value={behavior}
              onChange={(e) => setBehavior(e.target.value as OutOfRangeBehavior)}
            >
              <option value="REJECT">REJECT — block check-in</option>
              <option value="FLAG">FLAG — allow, flag record</option>
            </select>
          </Field>
          <Field label="Shift start">
            <input
              className={inputCls}
              type="time"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
            />
          </Field>
          <Field label="Shift end">
            <input
              className={inputCls}
              type="time"
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
            />
          </Field>
          <Field label="Late grace (min)">
            <input
              className={inputCls}
              type="number"
              min={0}
              max={240}
              value={grace}
              onChange={(e) => setGrace(Math.round(Number(e.target.value) || 0))}
            />
          </Field>
          <Field label="Half-day under (min)">
            <input
              className={inputCls}
              type="number"
              min={30}
              max={720}
              value={halfDay}
              onChange={(e) => setHalfDay(Math.round(Number(e.target.value) || 0))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

/* ── assignments panel ──────────────────────────────────────────────────── */

function AssignmentsPanel({
  site,
  isAdmin,
  users,
  onChanged,
}: {
  site: Site
  isAdmin: boolean
  users: User[]
  onChanged: () => void
}) {
  const [list, setList] = useState<SiteAssignment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<SiteAssignment[]>(`/sites/${site.id}/assignments`)
      setList(data)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [site.id])

  useEffect(() => {
    void load()
  }, [load])

  const assignedIds = new Set((list ?? []).map((a) => a.userId))
  const available = users.filter((u) => u.isActive && !assignedIds.has(u.id))

  const addAssignment = async () => {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      await api.post(`/sites/${site.id}/assignments`, { userId })
      setUserId('')
      await load()
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const removeAssignment = async (assignmentId: string) => {
    setBusy(true)
    setError(null)
    try {
      await api.delete(`/sites/${site.id}/assignments/${assignmentId}`)
      await load()
      onChanged()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4">
      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}
      {isAdmin && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            className={cn(inputCls, 'w-64')}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={busy}
          >
            <option value="">
              {available.length === 0 ? 'No unassigned users left' : 'Select a user to assign…'}
            </option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.employeeId} ({u.role})
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => void addAssignment()}
            disabled={!userId || busy}
          >
            {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
            Assign
          </button>
        </div>
      )}
      {list === null ? (
        <div className="flex justify-center py-4">
          <Spinner className="text-slate-400" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500">
          No active assignments — engineers cannot check in here until assigned.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((assignment) => (
            <li
              key={assignment.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <span className="text-sm font-medium text-slate-800">{assignment.user.name}</span>
              <span className="text-xs text-slate-400">{assignment.user.employeeId}</span>
              <RoleBadge role={assignment.user.role} />
              {assignment.user.email && (
                <span className="hidden text-xs text-slate-400 sm:inline">{assignment.user.email}</span>
              )}
              {isAdmin && (
                <button
                  type="button"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-500 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void removeAssignment(assignment.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── page ───────────────────────────────────────────────────────────────── */

export default function SitesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [sites, setSites] = useState<Site[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editSite, setEditSite] = useState<Site | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<Site[]>('/sites')
      setSites(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get<User[]>('/users')
      setUsers(data)
    } catch {
      /* assignment dropdown degrades */
    }
  }, [])

  useEffect(() => {
    void load()
    void loadUsers()
  }, [load, loadUsers])

  const behaviorChip = (behavior: OutOfRangeBehavior) =>
    behavior === 'REJECT' ? (
      <Chip label="REJECT out-of-range" cls="border-rose-200 bg-rose-50 text-rose-700" />
    ) : (
      <Chip label="FLAG out-of-range" cls="border-amber-200 bg-amber-50 text-amber-700" />
    )

  return (
    <div>
      <PageHeader
        title="Project sites"
        subtitle="Geofences, shifts and team assignments"
        actions={
          isAdmin ? (
            <button type="button" className={btnPrimary} onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New site
            </button>
          ) : (
            <Chip
              label="View only — site config is admin-managed"
              cls="border-slate-200 bg-slate-50 text-slate-500"
            />
          )
        }
      />

      {flash && (
        <div className="mb-4">
          <SuccessBanner message={flash} onDismiss={() => setFlash(null)} />
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : sites.length === 0 ? (
        <div className={cardCls}>
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No project sites yet"
            message={
              isAdmin
                ? 'Create the first site with its geofence and shift timing.'
                : 'Ask an administrator to create project sites.'
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sites.map((site) => (
            <article key={site.id} className={cn(cardCls, 'overflow-hidden')}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900">{site.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {site.address}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className={cn(btnOutline, 'shrink-0')}
                      onClick={() => setEditSite(site)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {behaviorChip(site.outOfRangeBehavior)}
                  <Chip
                    label={`Radius ${site.radiusM} m`}
                    cls="border-indigo-200 bg-indigo-50 text-indigo-700"
                  />
                  {!site.isActive && (
                    <Chip label="Inactive" cls="border-slate-200 bg-slate-100 text-slate-500" />
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Shift
                    </dt>
                    <dd className="flex items-center gap-1 text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {site.shiftStart}–{site.shiftEnd}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Late grace
                    </dt>
                    <dd className="text-slate-700">{site.lateGraceMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Half-day under
                    </dt>
                    <dd className="text-slate-700">{site.halfDayMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      Coordinates
                    </dt>
                    <dd className="font-mono text-xs text-slate-600">
                      {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  onClick={() => setExpanded(expanded === site.id ? null : site.id)}
                >
                  <Users className="h-4 w-4" />
                  {site.assignments.length} assigned
                  {expanded === site.id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              {expanded === site.id && (
                <AssignmentsPanel
                  site={site}
                  isAdmin={isAdmin}
                  users={users}
                  onChanged={() => void load()}
                />
              )}
            </article>
          ))}
        </div>
      )}

      {formOpen && (
        <SiteFormModal
          site={null}
          onClose={() => setFormOpen(false)}
          onSaved={(message) => {
            setFormOpen(false)
            setFlash(message)
            void load()
          }}
        />
      )}
      {editSite && (
        <SiteFormModal
          site={editSite}
          onClose={() => setEditSite(null)}
          onSaved={(message) => {
            setEditSite(null)
            setFlash(message)
            void load()
          }}
        />
      )}
    </div>
  )
}
