import { useCallback, useEffect, useState } from 'react'
import { Scale, SlidersHorizontal } from 'lucide-react'
import {
  btnOutline,
  btnPrimary,
  cardCls,
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
import type { BalanceRow, User } from '../lib/types'
import { cn } from '../lib/utils'

function AdjustModal({
  row,
  userId,
  year,
  onClose,
  onSaved,
}: {
  row: BalanceRow
  userId: string
  year: number
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [allocated, setAllocated] = useState(String(row.allocated))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const value = Number(allocated)
    if (!Number.isFinite(value) || value < 0 || value > 365) {
      setError('Allocation must be between 0 and 365 days.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.post('/leave/balances/adjust', {
        userId,
        leaveTypeId: row.leaveType.id,
        year,
        allocated: value,
      })
      onSaved(`${row.leaveType.name} allocation set to ${value} day(s).`)
    } catch (err) {
      setError(getErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Adjust ${row.leaveType.name}`}
      subtitle={`Year ${year} · used ${row.used} · pending ${row.pending} · available ${row.available}`}
      size="sm"
      footer={
        <>
          <button type="button" className={btnOutline} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={() => void submit()} disabled={busy}>
            {busy && <Spinner />}
            Save allocation
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <Field label="Allocated days (0–365)" hint="The change is audited.">
          <input
            className={inputCls}
            type="number"
            min={0}
            max={365}
            step={0.5}
            value={allocated}
            onChange={(e) => setAllocated(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}

export default function BalancesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [userId, setUserId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [adjustRow, setAdjustRow] = useState<BalanceRow | null>(null)

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data } = await api.get<User[]>('/users')
        setUsers(data)
        const firstEngineer = data.find((u) => u.role === 'ENGINEER')
        setUserId((current) => current || firstEngineer?.id || data[0]?.id || '')
      } catch (err) {
        setError(getErrorMessage(err))
      }
    }
    void loadUsers()
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<BalanceRow[]>('/leave/balances', {
        params: { userId, year },
      })
      setRows(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [userId, year])

  useEffect(() => {
    void load()
  }, [load])

  const selectedUser = users.find((u) => u.id === userId)
  const yearOptions = [year - 2, year - 1, year, year + 1].filter(
    (y, index, arr) => arr.indexOf(y) === index,
  )

  return (
    <div>
      <PageHeader
        title="Leave balances"
        subtitle="Allocation, usage and availability per engineer and leave type"
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
              Employee
            </span>
            <select
              className={inputCls}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.employeeId} ({u.role})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Year
            </span>
            <select
              className={cn(inputCls, 'w-28')}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions
                .sort((a, b) => a - b)
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </select>
          </label>
          {selectedUser && (
            <div className="pb-1 text-xs text-slate-400">
              Available = allocated − used (approved) − pending (reserved)
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}

      <div className={cn(cardCls, 'overflow-hidden')}>
        {!userId ? (
          <EmptyState
            icon={<Scale className="h-8 w-8" />}
            title="Pick an employee"
            message="Select an employee above to view their leave balances."
          />
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-indigo-600" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-8 w-8" />}
            title="No balances"
            message="No active leave types to show for this year."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Leave type</th>
                  <th className="px-4 py-3 text-right">Allocated</th>
                  <th className="px-4 py-3 text-right">Used</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.leaveType.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{row.leaveType.name}</div>
                      <div className="font-mono text-xs text-slate-400">{row.leaveType.code}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {row.allocated}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{row.used}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {row.pending}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'tabular-nums font-medium',
                          row.available <= 0 ? 'text-rose-600' : 'text-slate-900',
                        )}
                      >
                        {row.available}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className={btnOutline}
                        onClick={() => setAdjustRow(row)}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adjustRow && userId && (
        <AdjustModal
          row={adjustRow}
          userId={userId}
          year={year}
          onClose={() => setAdjustRow(null)}
          onSaved={(message) => {
            setAdjustRow(null)
            setFlash(message)
            void load()
          }}
        />
      )}
    </div>
  )
}
