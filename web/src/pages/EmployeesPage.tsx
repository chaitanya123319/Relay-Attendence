import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Search, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import { RoleBadge } from '@/components/badges'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, getErrorMessage } from '@/lib/api'
import type { Role, Site, User } from '@/lib/types'
import { fmtDate } from '@/lib/utils'

const roleLabel = (role: Role): string => role.charAt(0) + role.slice(1).toLowerCase()

/** Admin-only inline control: assign this user to one more site. */
function AssignCell({
  target,
  sites,
  onAssigned,
}: {
  target: User
  sites: Site[]
  onAssigned: (message: string) => void
}) {
  const assignedIds = new Set((target.sites ?? []).map((s) => s.id))
  const available = sites.filter((site) => !assignedIds.has(site.id))
  const [siteId, setSiteId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assign = async () => {
    if (!siteId) return
    setBusy(true)
    setError(null)
    try {
      await api.post(`/sites/${siteId}/assignments`, { userId: target.id })
      setSiteId('')
      onAssigned(`${target.name} assigned to the site.`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Select
          value={siteId}
          onValueChange={setSiteId}
          disabled={busy || available.length === 0}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue
              placeholder={available.length === 0 ? 'All sites assigned' : 'Assign to site…'}
            />
          </SelectTrigger>
          <SelectContent>
            {available.map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="icon-sm"
          variant="secondary"
          onClick={() => void assign()}
          disabled={!siteId || busy}
          title="Assign to site"
          aria-label={`Assign ${target.name} to the selected site`}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-3.5" aria-hidden />
          )}
        </Button>
      </div>
      {error && <span className="max-w-48 text-xs text-destructive">{error}</span>}
    </div>
  )
}

function UserDialog({
  mode,
  target,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  target?: User
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const { user: me } = useAuth()
  const isCreate = mode === 'create'
  const [name, setName] = useState(target?.name ?? '')
  const [email, setEmail] = useState(target?.email ?? '')
  const [employeeId, setEmployeeId] = useState(target?.employeeId ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(target?.role ?? 'ENGINEER')
  const [phone, setPhone] = useState(target?.phone ?? '')
  const [isActive, setIsActive] = useState(target?.isActive ?? true)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roleOptions: Role[] =
    me?.role === 'ADMIN' ? ['ADMIN', 'HR', 'MANAGER', 'ENGINEER'] : ['HR', 'MANAGER', 'ENGINEER']

  const submit = async () => {
    if (name.trim().length < 2) return setError('Name must be at least 2 characters.')
    if (isCreate) {
      if (!email.includes('@') || email.trim().length < 5)
        return setError('Enter a valid email address.')
      if (employeeId.trim().length < 2)
        return setError('Employee ID must be at least 2 characters.')
      if (password.length < 8) return setError('Password must be at least 8 characters.')
    } else if (password && password.length < 8) {
      return setError('New password must be at least 8 characters (or leave it blank).')
    }
    if (phone.trim() && phone.trim().length < 6)
      return setError('Phone must be at least 6 characters.')

    setBusy(true)
    setError(null)
    try {
      if (isCreate) {
        await api.post('/users', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          employeeId: employeeId.trim(),
          password,
          role,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        })
        onSaved(`Employee ${name.trim()} created.`)
      } else if (target) {
        await api.patch(`/users/${target.id}`, {
          name: name.trim(),
          role,
          isActive,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(password ? { password } : {}),
        })
        onSaved(`Employee ${name.trim()} updated.`)
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Add employee' : `Edit ${target?.name ?? 'employee'}`}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Creates a login for a manager, HR, admin or engineer.'
              : (target?.email ?? '')}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="user-name">Full name</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="user-employee-id">Employee ID</Label>
            <Input
              id="user-employee-id"
              className="tnum"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={!isCreate}
              placeholder="EMP-0006"
            />
          </div>
          {isCreate && (
            <div className="grid gap-1.5">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@relay.local"
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="user-phone">Phone (optional)</Label>
            <Input
              id="user-phone"
              value={phone ?? ''}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 …"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {roleLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="user-password">
            {isCreate ? 'Password' : 'Reset password (optional)'}
          </Label>
          <Input
            id="user-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            {isCreate
              ? 'Minimum 8 characters.'
              : 'Leave blank to keep the current password.'}
          </p>
        </div>

        {!isCreate && (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="user-active">Account active</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Deactivating blocks sign-in until the account is re-enabled.
              </p>
            </div>
            <Switch
              id="user-active"
              checked={isActive}
              onCheckedChange={(checked) => {
                if (checked) setIsActive(true)
                else setConfirmDeactivate(true)
              }}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isCreate ? 'Create employee' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {target?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won&apos;t be able to sign in until the account is re-enabled. Save changes to
              apply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => setIsActive(false)}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

export default function EmployeesPage() {
  const { user: me } = useAuth()
  const isAdmin = me?.role === 'ADMIN'
  const [users, setUsers] = useState<User[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [roleFilter, setRoleFilter] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (roleFilter) params.role = roleFilter
      if (q.trim()) params.q = q.trim()
      const { data } = await api.get<User[]>('/users', { params })
      setUsers(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [roleFilter, q])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const loadSites = useCallback(async () => {
    try {
      const { data } = await api.get<Site[]>('/sites')
      setSites(data)
    } catch {
      /* assignment dropdown stays empty */
    }
  }, [])

  useEffect(() => {
    if (isAdmin) void loadSites()
  }, [isAdmin, loadSites])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Employees</h1>
          <p className="text-[13px] text-muted-foreground">
            Accounts, roles, password resets and site assignments
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Add employee
        </Button>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid flex-1 gap-1.5 sm:max-w-xs">
            <Label htmlFor="employee-search" className="text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="employee-search"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, email or employee ID"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">Role</Label>
            <Select
              value={roleFilter === '' ? 'all' : roleFilter}
              onValueChange={(value) => setRoleFilter(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="ENGINEER">Engineer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Couldn&apos;t load employees</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      <Card className="overflow-hidden py-0">
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Employee
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Role
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Contact
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Sites
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="px-3 text-right text-xs uppercase tracking-wide text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, row) => (
                <TableRow key={row} className="h-10 hover:bg-transparent">
                  {Array.from({ length: 6 }).map((__, cell) => (
                    <TableCell key={cell} className="px-3 py-2">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-40 text-center whitespace-normal">
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <UserCog className="size-6" aria-hidden />
                    <span className="text-sm font-medium text-foreground">
                      No employees match
                    </span>
                    <span className="max-w-md text-[13px]">
                      Adjust the search or role filter, or add a new employee.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((target) => {
                const canEdit = isAdmin || target.role !== 'ADMIN'
                return (
                  <TableRow key={target.id} className="h-10">
                    <TableCell className="px-3 py-2">
                      <span className="font-medium">{target.name}</span>
                      <span className="tnum ml-2 text-xs text-muted-foreground">
                        {target.employeeId}
                        {target.createdAt
                          ? ` · joined ${fmtDate(target.createdAt.slice(0, 10))}`
                          : ''}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <RoleBadge role={target.role} />
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <span>{target.email}</span>
                      <span className="tnum ml-2 text-xs text-muted-foreground">
                        {target.phone ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 whitespace-normal">
                      <div className="flex max-w-64 flex-wrap gap-1">
                        {(target.sites ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          (target.sites ?? []).map((site) => (
                            <Badge key={site.id} variant="outline">
                              {site.name}
                            </Badge>
                          ))
                        )}
                      </div>
                      {isAdmin && target.isActive && (
                        <div className="mt-2">
                          <AssignCell
                            target={target}
                            sites={sites}
                            onAssigned={(message) => {
                              toast.success(message)
                              void load()
                            }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {target.isActive ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-right">
                      {canEdit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditTarget(target)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          Edit
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          HR cannot edit admins
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {createOpen && (
        <UserDialog
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={(message) => {
            setCreateOpen(false)
            toast.success(message)
            void load()
          }}
        />
      )}
      {editTarget && (
        <UserDialog
          mode="edit"
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(message) => {
            setEditTarget(null)
            toast.success(message)
            void load()
          }}
        />
      )}
    </div>
  )
}
