import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import type { LeaveType } from '@/lib/types'

function BoolBadge({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean
  trueLabel: string
  falseLabel: string
}) {
  return value ? (
    <Badge variant="secondary">{trueLabel}</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      {falseLabel}
    </Badge>
  )
}

function SwitchRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function LeaveTypeDialog({
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${target?.name ?? 'leave type'}` : 'New leave type'}</DialogTitle>
          <DialogDescription>
            Quota auto-allocates to engineers; notice, document and half-day rules are enforced
            server-side.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="lt-code">Code</Label>
            <Input
              id="lt-code"
              className="uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isEdit}
            />
            <p className="text-xs text-muted-foreground">
              {isEdit ? 'Codes are immutable.' : 'e.g. EL, SL, CASUAL'}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lt-name">Name</Label>
            <Input id="lt-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lt-quota">Annual quota (days)</Label>
            <Input
              id="lt-quota"
              className="tnum"
              type="number"
              min={0}
              max={365}
              value={annualQuota}
              onChange={(e) => setAnnualQuota(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lt-notice">Minimum notice (days)</Label>
            <Input
              id="lt-notice"
              className="tnum"
              type="number"
              min={0}
              max={90}
              value={minNoticeDays}
              onChange={(e) => setMinNoticeDays(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lt-max-consecutive">Max consecutive days</Label>
            <Input
              id="lt-max-consecutive"
              className="tnum"
              type="number"
              min={1}
              max={365}
              value={maxConsecutive}
              onChange={(e) => setMaxConsecutive(e.target.value)}
              placeholder="No limit"
            />
            <p className="text-xs text-muted-foreground">Blank = no limit.</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <SwitchRow id="lt-paid" label="Paid leave" checked={paid} onCheckedChange={setPaid} />
          <SwitchRow
            id="lt-document"
            label="Supporting document required"
            checked={requiresDocument}
            onCheckedChange={setRequiresDocument}
          />
          <SwitchRow
            id="lt-halfday"
            label="Half-day requests allowed"
            checked={allowHalfDay}
            onCheckedChange={setAllowHalfDay}
          />
          {isEdit && (
            <SwitchRow
              id="lt-active"
              label="Active (selectable by engineers)"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isEdit ? 'Save changes' : 'Create leave type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function LeaveTypesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [types, setTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Leave types</h1>
          <p className="text-[13px] text-muted-foreground">
            Configurable leave policy: quotas, notice periods, documents and half-day rules
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New leave type
          </Button>
        ) : (
          <span className="text-[13px] text-muted-foreground">
            View only — leave types are admin-managed
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Couldn&apos;t load leave types</AlertTitle>
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
                Type
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Quota
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Paid
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Document
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Notice
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Max consecutive
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Half-day
              </TableHead>
              <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Active
              </TableHead>
              {isAdmin && (
                <TableHead className="px-3 text-right text-xs uppercase tracking-wide text-muted-foreground">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, row) => (
                <TableRow key={row} className="h-10 hover:bg-transparent">
                  {Array.from({ length: isAdmin ? 9 : 8 }).map((__, cell) => (
                    <TableCell key={cell} className="px-3 py-2">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : types.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={isAdmin ? 9 : 8}
                  className="h-40 text-center whitespace-normal"
                >
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <Tags className="size-6" aria-hidden />
                    <span className="text-sm font-medium text-foreground">No leave types</span>
                    <span className="max-w-md text-[13px]">
                      {isAdmin
                        ? 'Create the first leave type.'
                        : 'Ask an administrator to configure leave types.'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              types.map((type) => (
                <TableRow key={type.id} className="h-10">
                  <TableCell className="px-3 py-2">
                    <span className="font-medium">{type.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {type.code}
                    </span>
                  </TableCell>
                  <TableCell className="tnum px-3 py-2">{type.annualQuota} d</TableCell>
                  <TableCell className="px-3 py-2">
                    <BoolBadge value={type.paid} trueLabel="Paid" falseLabel="Unpaid" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <BoolBadge
                      value={type.requiresDocument}
                      trueLabel="Required"
                      falseLabel="Not required"
                    />
                  </TableCell>
                  <TableCell className="tnum px-3 py-2">{type.minNoticeDays} d</TableCell>
                  <TableCell className="tnum px-3 py-2">
                    {type.maxConsecutiveDays === null ? '—' : `${type.maxConsecutiveDays} d`}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <BoolBadge value={type.allowHalfDay} trueLabel="Allowed" falseLabel="No" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <BoolBadge value={type.isActive} trueLabel="Active" falseLabel="Inactive" />
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="px-3 py-1.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditTarget(type)}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {createOpen && (
        <LeaveTypeDialog
          target={null}
          onClose={() => setCreateOpen(false)}
          onSaved={(message) => {
            setCreateOpen(false)
            toast.success(message)
            void load()
          }}
        />
      )}
      {editTarget && (
        <LeaveTypeDialog
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
