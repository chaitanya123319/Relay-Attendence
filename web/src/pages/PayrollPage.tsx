import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, Loader2, RefreshCw, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, downloadReport, getErrorMessage } from '@/lib/api'
import type { ReportJson } from '@/lib/types'
import { cn, currentMonth, monthLabel } from '@/lib/utils'

/** Recharts renders SVG attributes — tokens resolve there exactly like in CSS. */
const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--popover-foreground)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--popover-foreground)', fontWeight: 500 },
  itemStyle: { color: 'var(--muted-foreground)' },
  cursor: { fill: 'var(--muted)', fillOpacity: 0.4 },
} as const

export default function PayrollPage() {
  const [month, setMonth] = useState(currentMonth())
  const [report, setReport] = useState<ReportJson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<ReportJson>('/reports/payroll', {
        params: { month, format: 'json' },
      })
      setReport(data)
    } catch (err) {
      setError(getErrorMessage(err))
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    void load()
  }, [load])

  const download = async (format: 'csv' | 'pdf') => {
    setDownloading(format)
    setError(null)
    try {
      await downloadReport(
        '/reports/payroll',
        { month, format },
        `payroll-summary-${month}.${format}`,
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDownloading(null)
    }
  }

  const chartData = useMemo(() => {
    if (!report) return []
    const nameIdx = report.columns.indexOf('Name')
    const workedIdx = report.columns.indexOf('Days worked')
    const absentIdx = report.columns.indexOf('Absent')
    if (nameIdx < 0 || workedIdx < 0) return []
    return report.rows.map((row) => ({
      name: String(row[nameIdx] ?? ''),
      'Days worked': Number(row[workedIdx] ?? 0),
      ...(absentIdx >= 0 ? { Absent: Number(row[absentIdx] ?? 0) } : {}),
    }))
  }, [report])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Payroll summary</h1>
          <p className="text-[13px] text-muted-foreground">
            Payroll-ready monthly rollup: days worked, half-days, absences and paid/unpaid leave
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="size-4" aria-hidden />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => void download('csv')}
            disabled={downloading !== null}
          >
            {downloading === 'csv' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="size-4" aria-hidden />
            )}
            Download CSV
          </Button>
          <Button onClick={() => void download('pdf')} disabled={downloading !== null}>
            {downloading === 'pdf' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="size-4" aria-hidden />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Couldn&apos;t load the payroll summary</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      <Card className="mb-4 p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="payroll-month" className="text-muted-foreground">
            Month
          </Label>
          <Input
            id="payroll-month"
            type="month"
            className="w-44"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
          />
        </div>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-72 rounded-xl" />
          <Card className="overflow-hidden py-0">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, row) => (
                <Skeleton key={row} className="h-5 w-full" />
              ))}
            </div>
          </Card>
        </div>
      ) : !report ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
          <Wallet className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No payroll data</p>
          <p className="max-w-md text-[13px] text-muted-foreground">
            Pick a month above and refresh.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {chartData.length > 0 && (
            <Card className="gap-3 py-4">
              <div className="px-4 text-sm font-medium">Days worked — {monthLabel(month)}</div>
              <div className="h-64 px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
                    <Bar dataKey="Days worked" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    {chartData[0] && 'Absent' in chartData[0] && (
                      <Bar dataKey="Absent" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden py-0">
            <div className="border-b px-4 py-3">
              <div className="text-sm font-medium">{report.title}</div>
              <div className="text-[13px] text-muted-foreground">{report.subtitle}</div>
            </div>
            {report.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
                <Wallet className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">No engineers in scope</p>
                <p className="max-w-md text-[13px] text-muted-foreground">
                  No active engineers are assigned to sites for this payroll period.
                </p>
              </div>
            ) : (
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {report.columns.map((column) => (
                      <TableHead
                        key={column}
                        className="px-3 text-xs uppercase tracking-wide text-muted-foreground"
                      >
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex} className="h-10">
                      {row.map((cell, cellIndex) => (
                        <TableCell
                          key={cellIndex}
                          className={cn('px-3 py-2', typeof cell === 'number' && 'tnum text-right')}
                        >
                          {String(cell)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
