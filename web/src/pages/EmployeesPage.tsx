import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Search, UserCog } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  btnOutline,
  btnPrimary,
  btnSubtle,
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
import type { Role, Site, User } from '../lib/types'
import { cn, fmtDate } from '../lib/utils'

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
        <select
          className={cn(inputCls, '!w-40 !px-2 !py-1 text-xs')}
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          disabled={busy || available.length === 0}
        >
          <option value="">
            {available.length === 0 ? 'All sites assigned' : 'Assign to site…'}
          </option>
          {available.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={cn(btnSubtle, '!px-2 !py-1.5')}
          onClick={() => void assign()}
          disabled={!siteId || busy}
          title="Assign to site"
        >
          {busy ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}

function UserModal({
  mode,
  target,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  target?: User
  onClose: () => void
  onSaved: (message: string, keepOpen?: boolean) => void
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roleOptions: Role[] =
    me?.role === 'ADMIN' ? ['ADMIN', 'HR', 'MANAGER', 'ENGINEER'] : ['HR', 'MANAGER', 'ENGINEER']

  const submit = async () => {
    if (name.trim().length < 2) return setError('Name must be at least 2 characters.')
    if (isCreate) {
      if (!email.includes('@') || email.trim().length < 5) return setError('Enter a valid email address.')
      if (employeeId.trim().length < 2) return setError('Employee ID must be at least 2 characters.')
      if (password.length < 8) return setError('Password must be at least 8 characters.')
    } else if (password && password.length < 8) {
      return setError('New password must be at least 8 characters (or leave it blank).')
    }
    if (phone.trim() && phone.trim().length < 6) return setError('Phone must be at least 6 characters.')

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
    <Modal
      open
      onClose={onClose}
      title={isCreate ? 'Add employee' : `Edit ${target?.name ?? 'employee'}`}
      subtitle={isCreate ? 'Creates a login for a manager, HR, admin or engineer.' : target?.email}
      footer={
        <>
          <button type="button" className={btnOutline} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={() => void submit()} disabled={busy}>
            {busy && <Spinner />}
            {isCreate ? 'Create employee' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Employee ID">
            <input
              className={cn(inputCls, !isCreate && 'bg-slate-50 text-slate-500')}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={!isCreate}
              placeholder="EMP-0006"
            />
          </Field>
          {isCreate && (
            <Field label="Email">
              <input
                className={inputCls}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@relay.local"
              />
            </Field>
          )}
          <Field label="Phone (optional)">
            <input
              className={inputCls}
              value={phone ?? ''}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 …"
            />
          </Field>
          <Field label="Role">
            <select
              className={inputCls}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label={isCreate ? 'Password' : 'Reset password (optional)'}
          hint={isCreate ? 'Minimum 8 characters.' : 'Leave blank to keep the current password.'}
        >
          <input
            className={inputCls}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {!isCreate && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Account active (deactivating blocks login)
          </label>
        )}
      </div>
    </Modal>
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
  const [flash, setFlash] = useState<string | null>(null)
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
      <PageHeader
        title="Employees"
        subtitle="Accounts, roles, password resets and site assignments"
        actions={
          <button type="button" className={btnPrimary} onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add employee
          </button>
        }
      />

      {flash && (
        <div className="mb-4">
          <SuccessBanner message={flash} onDismiss={() => setFlash(null)} />
        </div>
      )}

      <div className={cn(cardCls, 'mb-5 p-4')}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 sm:max-w-xs">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={cn(inputCls, 'pl-9')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, email or employee ID"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Role
            </span>
            <select
              className={cn(inputCls, 'w-40')}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="HR">HR</option>
              <option value="MANAGER">Manager</option>
              <option value="ENGINEER">Engineer</option>
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}

      <div className={cn(cardCls, 'overflow-hidden')}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-indigo-600" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserCog className="h-8 w-8" />}
            title="No employees match"
            message="Adjust the search or role filter, or add a new employee."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Sites</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((target) => {
                  const canEdit = isAdmin || target.role !== 'ADMIN'
                  return (
                    <tr key={target.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{target.name}</div>
                        <div className="text-xs text-slate-400">
                          {target.employeeId}
                          {target.createdAt ? ` · joined ${fmtDate(target.createdAt.slice(0, 10))}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={target.role} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{target.email}</div>
                        <div className="text-xs text-slate-400">{target.phone ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-64 flex-wrap gap-1">
                          {(target.sites ?? []).length === 0 ? (
                            <span className="text-xs text-slate-300">None</span>
                          ) : (
                            (target.sites ?? []).map((site) => (
                              <Chip
                                key={site.id}
                                label={site.name}
                                cls="border-slate-200 bg-slate-50 text-slate-600"
                              />
                            ))
                          )}
                        </div>
                        {isAdmin && target.isActive && (
                          <div className="mt-2">
                            <AssignCell
                              target={target}
                              sites={sites}
                              onAssigned={(message) => {
                                setFlash(message)
                                void load()
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {target.isActive ? (
                          <Chip
                            label="Active"
                            cls="border-emerald-200 bg-emerald-50 text-emerald-700"
                          />
                        ) : (
                          <Chip label="Inactive" cls="border-slate-200 bg-slate-100 text-slate-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <button
                            type="button"
                            className={btnOutline}
                            onClick={() => setEditTarget(target)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">HR cannot edit admins</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <UserModal
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={(message) => {
            setCreateOpen(false)
            setFlash(message)
            void load()
          }}
        />
      )}
      {editTarget && (
        <UserModal
          mode="edit"
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(message) => {
            setEditTarget(null)
            setFlash(message)
            void load()
          }}
        />
      )}
    </div>
  )
}
