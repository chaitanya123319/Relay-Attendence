import { useCallback, useEffect, useState } from 'react'
import { Loader2, Scale, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, getErrorMessage } from '@/lib/api'
import type { BalanceRow, User } from '@/lib/types'
import { cn } from '@/lib/utils'

function AdjustDialog({
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust {row.leaveType.name}</DialogTitle>
          <DialogDescription>
            <span className="tnum">
              Year {year} · used {row.used} · pending {row.pending} · available {row.available}
            </span>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="balance-allocated">Allocated days (0–365)</Label>
          <Input
            id="balance-allocated"
            className="tnum"
            type="number"
            min={0}
            max={365}
            step={0.5}
            value={allocated}
            onChange={(e) => setAllocated(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">The change is audited.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BalancesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [userId, setUserId] = useState('')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      <div className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Leave balances</h1>
        <p className="text-[13px] text-muted-foreground">
          Allocation, usage and availability per engineer and leave type
        </p>
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid flex-1 gap-1.5 sm:max-w-xs">
            <Label className="text-muted-foreground">Employee</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} · {user.employeeId} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">Year</Label>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions
                  .sort((a, b) => a - b)
                  .map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {selectedUser && (
            <p className="pb-1 text-xs text-muted-foreground">
              Available = allocated − used (approved) − pending (reserved)
            </p>
          )}
        </div>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Couldn&apos;t load balances</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      <Card className="overflow-hidden py-0">
        {!userId ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
            <Scale className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Pick an employee</p>
            <p className="max-w-md text-[13px] text-muted-foreground">
              Select an employee above to view their leave balances.
            </p>
          </div>
        ) : loading ? (
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Leave type
                </TableHead>
                {['Allocated', 'Used', 'Pending', 'Available', 'Actions'].map((column) => (
                  <TableHead
                    key={column}
                    className="px-3 text-right text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, row) => (
                <TableRow key={row} className="h-10 hover:bg-transparent">
                  {Array.from({ length: 6 }).map((__, cell) => (
                    <TableCell key={cell} className="px-3 py-2">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
            <Scale className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">No balances</p>
            <p className="max-w-md text-[13px] text-muted-foreground">
              No active leave types to show for this year.
            </p>
          </div>
        ) : (
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Leave type
                </TableHead>
                {['Allocated', 'Used', 'Pending', 'Available', 'Actions'].map((column) => (
                  <TableHead
                    key={column}
                    className="px-3 text-right text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.leaveType.id} className="h-10">
                  <TableCell className="px-3 py-2">
                    <span className="font-medium">{row.leaveType.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {row.leaveType.code}
                    </span>
                  </TableCell>
                  <TableCell className="tnum px-3 py-2 text-right">{row.allocated}</TableCell>
                  <TableCell className="tnum px-3 py-2 text-right">{row.used}</TableCell>
                  <TableCell className="tnum px-3 py-2 text-right">{row.pending}</TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <span
                      className={cn(
                        'tnum font-medium',
                        row.available <= 0 && 'text-destructive',
                      )}
                    >
                      {row.available}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-right">
                    <Button variant="outline" size="sm" onClick={() => setAdjustRow(row)}>
                      <SlidersHorizontal className="size-3.5" aria-hidden />
                      Adjust
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {adjustRow && userId && (
        <AdjustDialog
          row={adjustRow}
          userId={userId}
          year={year}
          onClose={() => setAdjustRow(null)}
          onSaved={(message) => {
            setAdjustRow(null)
            toast.success(message)
            void load()
          }}
        />
      )}
    </div>
  )
}
