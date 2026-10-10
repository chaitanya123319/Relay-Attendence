import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react'
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
import { useAuth } from '@/auth/AuthContext'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, downloadReport, getErrorMessage } from '@/lib/api'
import type { ReportJson, Site } from '@/lib/types'
import {
  cn,
  currentMonth,
  firstDayOfMonth,
  lastDayOfMonth,
  monthLabel,
} from '@/lib/utils'

type Tab = 'attendance' | 'leave'

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

export default function ReportsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('attendance')
  const [month, setMonth] = useState(currentMonth())
  const [siteId, setSiteId] = useState('')
  const [from, setFrom] = useState(firstDayOfMonth(currentMonth()))
  const [to, setTo] = useState(lastDayOfMonth(currentMonth()))
  const [sites, setSites] = useState<Site[]>([])
  const [report, setReport] = useState<ReportJson | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null)

  useEffect(() => {
    async function loadSites() {
      try {
        const { data } = await api.get<Site[]>('/sites')
        setSites(
          user?.role === 'MANAGER'
            ? data.filter((site) => site.assignments.some((a) => a.userId === user.id))
            : data,
        )
      } catch {
        /* site filter degrades gracefully */
      }
    }
    void loadSites()
  }, [user])

  const query = useMemo(() => {
    if (tab === 'attendance') {
      const params: Record<string, string> = { month }
      if (siteId) params.siteId = siteId
      return { path: '/reports/attendance', params, fallback: `attendance-report-${month}` }
    }
    return {
      path: '/reports/leave',
      params: { from, to },
      fallback: `leave-report-${from}_${to}`,
    }
  }, [tab, month, siteId, from, to])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<ReportJson>(query.path, {
        params: { ...query.params, format: 'json' },
      })
      setReport(data)
    } catch (err) {
      setError(getErrorMessage(err))
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  const download = async (format: 'csv' | 'pdf') => {
    setDownloading(format)
    setError(null)
    try {
      await downloadReport(
        query.path,
        { ...query.params, format },
        `${query.fallback}.${format}`,
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDownloading(null)
    }
  }

  /* Chart: attendance report → Present vs Late per engineer (columns are stable backend output). */
  const chartData = useMemo(() => {
    if (!report || tab !== 'attendance') return []
    const nameIdx = report.columns.indexOf('Name')
    const presentIdx = report.columns.indexOf('Present')
    const lateIdx = report.columns.indexOf('Late')
    if (nameIdx < 0 || presentIdx < 0 || lateIdx < 0) return []
    return report.rows.map((row) => ({
      name: String(row[nameIdx] ?? ''),
      Present: Number(row[presentIdx] ?? 0),
      Late: Number(row[lateIdx] ?? 0),
    }))
  }, [report, tab])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
          <p className="text-[13px] text-muted-foreground">
            Monthly attendance and leave exports — JSON preview, CSV and PDF downloads
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
          <AlertTitle>Couldn&apos;t load the report</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button size="xs" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <TabsList>
              <TabsTrigger value="attendance">
                <CalendarDays className="size-4" aria-hidden />
                Attendance
              </TabsTrigger>
              <TabsTrigger value="leave">
                <FileText className="size-4" aria-hidden />
                Leave
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === 'attendance' ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="report-month" className="text-muted-foreground">
                  Month
                </Label>
                <Input
                  id="report-month"
                  type="month"
                  className="w-44"
                  value={month}
                  onChange={(e) => setMonth(e.target.value || currentMonth())}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-muted-foreground">Site</Label>
                <Select
                  value={siteId === '' ? 'all' : siteId}
                  onValueChange={(value) => setSiteId(value === 'all' ? '' : value)}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sites</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="report-from" className="text-muted-foreground">
                  From
                </Label>
                <Input
                  id="report-from"
                  type="date"
                  className="w-44"
                  value={from}
                  onChange={(e) => setFrom(e.target.value || from)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="report-to" className="text-muted-foreground">
                  To
                </Label>
                <Input
                  id="report-to"
                  type="date"
                  className="w-44"
                  value={to}
                  onChange={(e) => setTo(e.target.value || to)}
                />
              </div>
            </>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-4">
          {tab === 'attendance' && <Skeleton className="h-72 rounded-xl" />}
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
          <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No report loaded</p>
          <p className="max-w-md text-[13px] text-muted-foreground">
            Pick a period above and refresh to preview the report.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tab === 'attendance' && chartData.length > 0 && (
            <Card className="gap-3 py-4">
              <div className="px-4 text-sm font-medium">Present vs late — {monthLabel(month)}</div>
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
                    <Bar dataKey="Present" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Late" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
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
                <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">No data for this period</p>
                <p className="max-w-md text-[13px] text-muted-foreground">
                  No engineers or leave records fall inside the selected range.
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
