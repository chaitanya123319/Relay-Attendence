import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Tags } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
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
  Spinner,
  SuccessBanner,
  inputCls,
} from '../components/ui'
import { api, getErrorMessage } from '../lib/api'
import type { LeaveType } from '../lib/types'
import { cn } from '../lib/utils'

function BoolChip({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  return value ? (
    <Chip label={trueLabel} cls="border-emerald-200 bg-emerald-50 text-emerald-700" />
  ) : (
    <Chip label={falseLabel} cls="border-slate-200 bg-slate-50 text-slate-500" />
  )
}

function LeaveTypeModal({
  target,
  onClose,
  onSaved,
}: {
  target: LeaveType | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const isEdit = target !== null
  const [code, setCode] = useState(target?.code ?? '')
  const [name, setName] = useState(target?.name ?? '')
  const [annualQuota, setAnnualQuota] = useState(String(target?.annualQuota ?? 12))
  const [paid, setPaid] = useState(target?.paid ?? true)
  const [requiresDocument, setRequiresDocument] = useState(target?.requiresDocument ?? false)
  const [minNoticeDays, setMinNoticeDays] = useState(String(target?.minNoticeDays ?? 0))
  const [maxConsecutive, setMaxConsecutive] = useState(
    target?.maxConsecutiveDays === null || target?.maxConsecutiveDays === undefined
      ? ''
      : String(target.maxConsecutiveDays),
  )
  const [allowHalfDay, setAllowHalfDay] = useState(target?.allowHalfDay ?? true)
  const [isActive, setIsActive] = useState(target?.isActive ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!isEdit && code.trim().length < 2) return setError('Code must be at least 2 characters.')
    if (name.trim().length < 2) return setError('Name must be at least 2 characters.')
    const quota = Number(annualQuota)
    if (!Number.isFinite(quota) || quota < 0 || quota > 365) {
      return setError('Annual quota must be between 0 and 365.')
    }
    const notice = Number(minNoticeDays)
    if (!Number.isInteger(notice) || notice < 0 || notice > 90) {
      return setError('Minimum notice must be 0–90 days.')
    }
    let maxConsecutiveDays: number | null = null
    if (maxConsecutive.trim()) {
      const parsed = Number(maxConsecutive)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
        return setError('Max consecutive days must be 1–365, or blank for no limit.')
      }
      maxConsecutiveDays = parsed
    }

    const payload = {
      name: name.trim(),
      annualQuota: quota,
      paid,
      requiresDocument,
      minNoticeDays: notice,
      maxConsecutiveDays,
      allowHalfDay,
    }

    setBusy(true)
    setError(null)
    try {
      if (isEdit && target) {
        await api.patch(`/leave/types/${target.id}`, { ...payload, isActive })
        onSaved(`Leave type ${payload.name} updated.`)
      } else {
        await api.post('/leave/types', { ...payload, code: code.trim().toUpperCase() })
        onSaved(`Leave type ${payload.name} created.`)
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
      title={isEdit ? `Edit ${target?.name ?? 'leave type'}` : 'New leave type'}
      subtitle="Quota auto-allocates to engineers; notice, document and half-day rules are enforced server-side."
      footer={
        <>
          <button type="button" className={btnOutline} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={() => void submit()} disabled={busy}>
            {busy && <Spinner />}
            {isEdit ? 'Save changes' : 'Create leave type'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" hint={isEdit ? 'Codes are immutable.' : 'e.g. EL, SL, CASUAL'}>
            <input
              className={cn(inputCls, 'uppercase', isEdit && 'bg-slate-50 text-slate-500')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isEdit}
            />
          </Field>
          <Field label="Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Annual quota (days)">
            <input
              className={inputCls}
              type="number"
              min={0}
              max={365}
              value={annualQuota}
              onChange={(e) => setAnnualQuota(e.target.value)}
            />
          </Field>
          <Field label="Minimum notice (days)">
            <input
              className={inputCls}
              type="number"
              min={0}
              max={90}
              value={minNoticeDays}
              onChange={(e) => setMinNoticeDays(e.target.value)}
            />
          </Field>
          <Field label="Max consecutive days" hint="Blank = no limit.">
            <input
              className={inputCls}
              type="number"
              min={1}
              max={365}
              value={maxConsecutive}
              onChange={(e) => setMaxConsecutive(e.target.value)}
              placeholder="No limit"
            />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />
            Paid leave
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              checked={requiresDocument}
              onChange={(e) => setRequiresDocument(e.target.checked)}
            />
            Supporting document required
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              checked={allowHalfDay}
              onChange={(e) => setAllowHalfDay(e.target.checked)}
            />
            Half-day requests allowed
          </label>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active (selectable by engineers)
            </label>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function LeaveTypesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [types, setTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LeaveType | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<LeaveType[]>('/leave/types')
      setTypes(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        title="Leave types"
        subtitle="Configurable leave policy: quotas, notice periods, documents and half-day rules"
        actions={
          isAdmin ? (
            <button type="button" className={btnPrimary} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New leave type
            </button>
          ) : (
            <Chip
              label="View only — leave types are admin-managed"
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

      <div className={cn(cardCls, 'overflow-hidden')}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-indigo-600" />
          </div>
        ) : types.length === 0 ? (
          <EmptyState
            icon={<Tags className="h-8 w-8" />}
            title="No leave types"
            message={isAdmin ? 'Create the first leave type.' : 'Ask an administrator to configure leave types.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Quota</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Notice</th>
                  <th className="px-4 py-3">Max consecutive</th>
                  <th className="px-4 py-3">Half-day</th>
                  <th className="px-4 py-3">Active</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {types.map((type) => (
                  <tr key={type.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{type.name}</div>
                      <div className="font-mono text-xs text-slate-400">{type.code}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{type.annualQuota} d</td>
                    <td className="px-4 py-3">
                      <BoolChip value={type.paid} trueLabel="Paid" falseLabel="Unpaid" />
                    </td>
                    <td className="px-4 py-3">
                      <BoolChip
                        value={type.requiresDocument}
                        trueLabel="Required"
                        falseLabel="Not required"
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {type.minNoticeDays} d
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {type.maxConsecutiveDays === null ? '—' : `${type.maxConsecutiveDays} d`}
                    </td>
                    <td className="px-4 py-3">
                      <BoolChip value={type.allowHalfDay} trueLabel="Allowed" falseLabel="No" />
                    </td>
                    <td className="px-4 py-3">
                      <BoolChip value={type.isActive} trueLabel="Active" falseLabel="Inactive" />
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className={btnOutline}
                          onClick={() => setEditTarget(type)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <LeaveTypeModal
          target={null}
          onClose={() => setCreateOpen(false)}
          onSaved={(message) => {
            setCreateOpen(false)
            setFlash(message)
            void load()
          }}
        />
      )}
      {editTarget && (
        <LeaveTypeModal
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
