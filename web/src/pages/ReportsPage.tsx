import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react'
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
import { useAuth } from '../auth/AuthContext'
import {
  btnOutline,
  btnPrimary,
  cardCls,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  inputCls,
} from '../components/ui'
import { api, downloadReport, getErrorMessage } from '../lib/api'
import type { ReportJson, Site } from '../lib/types'
import {
  cn,
  currentMonth,
  firstDayOfMonth,
  lastDayOfMonth,
  monthLabel,
} from '../lib/utils'

type Tab = 'attendance' | 'leave'

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
      <PageHeader
        title="Reports"
        subtitle="Monthly attendance and leave exports — JSON preview, CSV and PDF downloads"
        actions={
          <>
            <button
              type="button"
              className={btnOutline}
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              className={btnOutline}
              onClick={() => void download('csv')}
              disabled={downloading !== null}
            >
              {downloading === 'csv' ? <Spinner /> : <FileSpreadsheet className="h-4 w-4" />}
              Download CSV
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => void download('pdf')}
              disabled={downloading !== null}
            >
              {downloading === 'pdf' ? <Spinner /> : <FileText className="h-4 w-4" />}
              Download PDF
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}

      <div className={cn(cardCls, 'mb-5 p-4')}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1.5 pb-1">
            {(['attendance', 'leave'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium',
                  tab === t
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                )}
              >
                {t === 'attendance' ? (
                  <CalendarDays className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {t === 'attendance' ? 'Attendance' : 'Leave'}
              </button>
            ))}
          </div>

          {tab === 'attendance' ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Month
                </span>
                <input
                  type="month"
                  className={cn(inputCls, 'w-44')}
                  value={month}
                  onChange={(e) => setMonth(e.target.value || currentMonth())}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Site
                </span>
                <select
                  className={cn(inputCls, 'w-56')}
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                >
                  <option value="">All sites</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  From
                </span>
                <input
                  type="date"
                  className={cn(inputCls, 'w-44')}
                  value={from}
                  onChange={(e) => setFrom(e.target.value || from)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  To
                </span>
                <input
                  type="date"
                  className={cn(inputCls, 'w-44')}
                  value={to}
                  onChange={(e) => setTo(e.target.value || to)}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className={cn(cardCls, 'flex justify-center py-16')}>
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : !report ? (
        <div className={cardCls}>
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="No report loaded"
            message="Pick a period above and refresh to preview the report."
          />
        </div>
      ) : (
        <div className="space-y-5">
          {tab === 'attendance' && chartData.length > 0 && (
            <div className={cn(cardCls, 'p-4')}>
              <div className="mb-3 text-sm font-semibold text-slate-800">
                Present vs late — {monthLabel(month)}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Present" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className={cn(cardCls, 'overflow-hidden')}>
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">{report.title}</div>
              <div className="text-xs text-slate-400">{report.subtitle}</div>
            </div>
            {report.rows.length === 0 ? (
              <EmptyState
                title="No data for this period"
                message="No engineers or leave records fall inside the selected range."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      {report.columns.map((column) => (
                        <th key={column} className="whitespace-nowrap px-4 py-3">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-slate-100 last:border-b-0">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={cn(
                              'whitespace-nowrap px-4 py-2.5',
                              cellIndex === 0 ? 'text-slate-500' : 'text-slate-700',
                            )}
                          >
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
