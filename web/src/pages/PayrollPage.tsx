import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, RefreshCw, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
import type { ReportJson } from '../lib/types'
import { cn, currentMonth, monthLabel } from '../lib/utils'

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
      <PageHeader
        title="Payroll summary"
        subtitle="Payroll-ready monthly rollup: days worked, half-days, absences and paid/unpaid leave"
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
      </div>

      {loading ? (
        <div className={cn(cardCls, 'flex justify-center py-16')}>
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : !report ? (
        <div className={cardCls}>
          <EmptyState
            icon={<Wallet className="h-8 w-8" />}
            title="No payroll data"
            message="Pick a month above and refresh."
          />
        </div>
      ) : (
        <div className="space-y-5">
          {chartData.length > 0 && (
            <div className={cn(cardCls, 'p-4')}>
              <div className="mb-3 text-sm font-semibold text-slate-800">
                Days worked — {monthLabel(month)}
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
                    <Bar dataKey="Days worked" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    {chartData[0] && 'Absent' in chartData[0] && (
                      <Bar dataKey="Absent" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    )}
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
                title="No engineers in scope"
                message="No active engineers are assigned to sites for this payroll period."
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
