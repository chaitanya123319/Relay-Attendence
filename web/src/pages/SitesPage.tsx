import { useCallback, useEffect, useState } from 'react'
import { Building2, ChevronRight, Clock, Loader2, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import { SiteFormMap } from '@/components/AttendanceMap'
import { RoleBadge } from '@/components/badges'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { api, getErrorMessage } from '@/lib/api'
import type { OutOfRangeBehavior, Site, SiteAssignment, SiteInput, User } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ── create / edit dialog ───────────────────────────────────────────────── */

function SiteFormDialog({
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="thin-scroll max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${site?.name ?? 'site'}` : 'New project site'}</DialogTitle>
          <DialogDescription>
            Geofence, out-of-range policy and shift timing drive server-side attendance rules.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="site-name">Site name</Label>
            <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="site-address">Address</Label>
            <Input
              id="site-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, area, city"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] text-muted-foreground">
              Location — click the map or drag the pin; numbers stay in sync
            </span>
            <span
              className={cn(
                'tnum text-xs',
                coordsValid ? 'text-muted-foreground' : 'text-destructive',
              )}
            >
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
            <div className="grid gap-1.5">
              <Label htmlFor="site-lat">Latitude</Label>
              <Input
                id="site-lat"
                className="tnum"
                type="number"
                step="any"
                value={latStr}
                onChange={(e) => setLatStr(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="site-lng">Longitude</Label>
              <Input
                id="site-lng"
                className="tnum"
                type="number"
                step="any"
                value={lngStr}
                onChange={(e) => setLngStr(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="site-radius">Geofence radius (m)</Label>
              <Input
                id="site-radius"
                className="tnum"
                type="number"
                min={10}
                max={5000}
                value={radiusM}
                onChange={(e) => setRadiusM(Math.round(Number(e.target.value) || 0))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="site-radius-slider" className="text-muted-foreground">
                Radius slider
              </Label>
              <input
                id="site-radius-slider"
                type="range"
                min={10}
                max={5000}
                step={10}
                value={Math.min(Math.max(radiusM, 10), 5000)}
                onChange={(e) => setRadiusM(Number(e.target.value))}
                className="accent-primary mt-2 w-full"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="grid gap-1.5">
            <Label>Out-of-range behavior</Label>
            <Select
              value={behavior}
              onValueChange={(value) => setBehavior(value as OutOfRangeBehavior)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REJECT">REJECT — block check-in</SelectItem>
                <SelectItem value="FLAG">FLAG — allow, flag record</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="site-shift-start">Shift start</Label>
            <Input
              id="site-shift-start"
              className="tnum"
              type="time"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="site-shift-end">Shift end</Label>
            <Input
              id="site-shift-end"
              className="tnum"
              type="time"
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="site-grace">Late grace (min)</Label>
            <Input
              id="site-grace"
              className="tnum"
              type="number"
              min={0}
              max={240}
              value={grace}
              onChange={(e) => setGrace(Math.round(Number(e.target.value) || 0))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="site-halfday">Half-day under (min)</Label>
            <Input
              id="site-halfday"
              className="tnum"
              type="number"
              min={30}
              max={720}
              value={halfDay}
              onChange={(e) => setHalfDay(Math.round(Number(e.target.value) || 0))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isEdit ? 'Save changes' : 'Create site'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── assignments sheet ──────────────────────────────────────────────────── */

function AssignmentsSheet({
  site,
  isAdmin,
  users,
  onClose,
  onChanged,
}: {
  site: Site
  isAdmin: boolean
  users: User[]
  onClose: () => void
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
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Site assignments</SheetTitle>
          <SheetDescription>
            {site.name} · users attached to this geofence. Engineers cannot check in here until
            assigned.
          </SheetDescription>
        </SheetHeader>

        <div className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Assignment request failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Select value={userId} onValueChange={setUserId} disabled={busy}>
                <SelectTrigger className="flex-1">
                  <SelectValue
                    placeholder={
                      available.length === 0
                        ? 'No unassigned users left'
                        : 'Select a user to assign…'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {available.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} · {user.employeeId} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => void addAssignment()} disabled={!userId || busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                Assign
              </Button>
            </div>
          )}

          {list === null ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No active assignments — engineers cannot check in here until assigned.
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{assignment.user.name}</span>
                      <span className="tnum text-xs text-muted-foreground">
                        {assignment.user.employeeId}
                      </span>
                    </div>
                    {assignment.user.email && (
                      <div className="truncate text-xs text-muted-foreground">
                        {assignment.user.email}
                      </div>
                    )}
                  </div>
                  <RoleBadge role={assignment.user.role} />
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      onClick={() => void removeAssignment(assignment.id)}
                      aria-label={`Remove ${assignment.user.name} from this site`}
                    >
                      <Trash2 className="size-3.5 text-destructive" aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
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
  const [formOpen, setFormOpen] = useState(false)
  const [editSite, setEditSite] = useState<Site | null>(null)
  const [assignSite, setAssignSite] = useState<Site | null>(null)

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

  const behaviorBadge = (behavior: OutOfRangeBehavior) =>
    behavior === 'REJECT' ? (
      <Badge variant="destructive">REJECT out-of-range</Badge>
    ) : (
      <Badge variant="secondary">FLAG out-of-range</Badge>
    )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Project sites</h1>
          <p className="text-[13px] text-muted-foreground">Geofences, shifts and team assignments</p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New site
          </Button>
        ) : (
          <span className="text-[13px] text-muted-foreground">
            View only — site config is admin-managed
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Couldn&apos;t load sites</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button size="xs" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="gap-3 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-5 w-32 rounded-full" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((__, cell) => (
                  <Skeleton key={cell} className="h-9 w-full" />
                ))}
              </div>
              <Skeleton className="h-7 w-36" />
            </Card>
          ))}
        </div>
      ) : sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
          <Building2 className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No project sites yet</p>
          <p className="max-w-md text-[13px] text-muted-foreground">
            {isAdmin
              ? 'Create the first site with its geofence and shift timing.'
              : 'Ask an administrator to create project sites.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sites.map((site) => (
            <Card key={site.id} className="gap-0 overflow-hidden py-0">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium">{site.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{site.address}</span>
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setEditSite(site)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </Button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {behaviorBadge(site.outOfRangeBehavior)}
                  <Badge variant="outline" className="tnum">
                    Radius {site.radiusM} m
                  </Badge>
                  {!site.isActive && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Shift</dt>
                    <dd className="tnum mt-0.5 flex items-center gap-1 text-[13px]">
                      <Clock className="size-3.5 text-muted-foreground" aria-hidden />
                      {site.shiftStart}–{site.shiftEnd}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Late grace</dt>
                    <dd className="tnum mt-0.5 text-[13px]">{site.lateGraceMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Half-day under</dt>
                    <dd className="tnum mt-0.5 text-[13px]">{site.halfDayMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Coordinates</dt>
                    <dd className="tnum mt-0.5 font-mono text-xs text-muted-foreground">
                      {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="border-t px-4 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setAssignSite(site)}
                >
                  <Users className="size-3.5" aria-hidden />
                  {isAdmin ? 'Manage assignments' : 'View assignments'}
                  <span className="tnum">({site.assignments.length})</span>
                  <ChevronRight className="size-3.5" aria-hidden />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <SiteFormDialog
          site={null}
          onClose={() => setFormOpen(false)}
          onSaved={(message) => {
            setFormOpen(false)
            toast.success(message)
            void load()
          }}
        />
      )}
      {editSite && (
        <SiteFormDialog
          site={editSite}
          onClose={() => setEditSite(null)}
          onSaved={(message) => {
            setEditSite(null)
            toast.success(message)
            void load()
          }}
        />
      )}
      {assignSite && (
        <AssignmentsSheet
          site={assignSite}
          isAdmin={isAdmin}
          users={users}
          onClose={() => setAssignSite(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  )
}
