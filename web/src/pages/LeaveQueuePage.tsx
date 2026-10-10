import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Paperclip, XCircle } from 'lucide-react'
import { SignedDocumentLink } from '../components/SignedMedia'
import {
  btnDanger,
  btnOutline,
  btnPrimary,
  cardCls,
  EmptyState,
  ErrorBanner,
  Field,
  Modal,
  PageHeader,
  Spinner,
  StatusChip,
  SuccessBanner,
  inputCls,
} from '../components/ui'
import { api, getErrorMessage } from '../lib/api'
import type { LeaveRequest } from '../lib/types'
import { cn, fmtDate, fmtDateTime, initials, timeAgo } from '../lib/utils'

const TABS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  ALL: 'All',
}

function dateSpan(request: LeaveRequest): string {
  const half = request.isHalfDay ? ` · ${request.halfDayPeriod ?? 'AM'} half-day` : ''
  if (request.fromDate === request.toDate) return `${fmtDate(request.fromDate)}${half}`
  return `${fmtDate(request.fromDate)} → ${fmtDate(request.toDate)}${half}`
}

export default function LeaveQueuePage() {
  const [tab, setTab] = useState<Tab>('PENDING')
  const [items, setItems] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [decision, setDecision] = useState<{ request: LeaveRequest; mode: 'approve' | 'reject' } | null>(
    null,
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = tab === 'ALL' ? undefined : { status: tab }
      const { data } = await api.get<LeaveRequest[]>('/leave/requests', { params })
      setItems(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        title="Leave queue"
        subtitle="Review leave requests from engineers on your sites"
      />

      {flash && (
        <div className="mb-4">
          <SuccessBanner message={flash} onDismiss={() => setFlash(null)} />
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : items.length === 0 ? (
        <div className={cardCls}>
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={tab === 'PENDING' ? 'No pending requests' : `No ${TAB_LABELS[tab].toLowerCase()} requests`}
            message="Leave requests from your assigned engineers will appear here."
          />
        </div>
      ) : tab === 'PENDING' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((request) => (
            <article key={request.id} className={cn(cardCls, 'flex flex-col p-4')}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {initials(request.user?.name ?? '?')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">
                      {request.user?.name ?? 'Unknown'}
                    </span>
                    <span className="text-xs text-slate-400">{request.user?.employeeId}</span>
                    <span className="ml-auto">
                      <StatusChip status={request.status} />
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {dateSpan(request)} · <span className="font-medium">{request.days} day(s)</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                  {request.leaveType.name} ({request.leaveType.code})
                </span>
                {request.leaveType.paid && (
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    Paid
                  </span>
                )}
                {request.isHalfDay && (
                  <span className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                    {request.halfDayPeriod ?? 'AM'} half-day
                  </span>
                )}
              </div>

              <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {request.reason}
              </p>

              {request.documents.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                  {request.documents.map((doc) => (
                    <SignedDocumentLink
                      key={doc.id}
                      path={doc.endpoint}
                      label={`${doc.originalName}`}
                    />
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">Requested {timeAgo(request.createdAt)}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => setDecision({ request, mode: 'reject' })}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => setDecision({ request, mode: 'approve' })}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={cn(cardCls, 'overflow-hidden')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Decided by</th>
                  <th className="px-4 py-3">Comment</th>
                </tr>
              </thead>
              <tbody>
                {items.map((request) => (
                  <tr key={request.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{request.user?.name ?? '—'}</div>
                      <div className="text-xs text-slate-400">{request.user?.employeeId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{request.leaveType.name}</td>
                    <td className="px-4 py-3 text-slate-600">{dateSpan(request)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{request.days}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={request.status} />
                    </td>
                    <td className="px-4 py-3">
                      {request.decidedBy ? (
                        <>
                          <div className="text-slate-700">{request.decidedBy.name}</div>
                          <div className="text-xs text-slate-400">
                            {request.decidedAt ? fmtDateTime(request.decidedAt) : ''}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="max-w-56 px-4 py-3 text-slate-600">
                      {request.decisionComment ? (
                        <span className="line-clamp-2" title={request.decisionComment}>
                          {request.decisionComment}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {decision && (
        <DecisionModal
          request={decision.request}
          mode={decision.mode}
          onCancel={() => setDecision(null)}
          onDone={(message) => {
            setDecision(null)
            setFlash(message)
            void load()
          }}
        />
      )}
    </div>
  )
}

function DecisionModal({
  request,
  mode,
  onCancel,
  onDone,
}: {
  request: LeaveRequest
  mode: 'approve' | 'reject'
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const isReject = mode === 'reject'
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = comment.trim()
    if (isReject && trimmed.length < 3) {
      setError('A comment of at least 3 characters is required when rejecting.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (isReject) {
        await api.post(`/leave/requests/${request.id}/reject`, { comment: trimmed })
      } else {
        await api.post(`/leave/requests/${request.id}/approve`, trimmed ? { comment: trimmed } : {})
      }
      onDone(isReject ? 'Leave request rejected.' : 'Leave request approved — balance updated.')
    } catch (err) {
      setError(getErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={isReject ? 'Reject leave request' : 'Approve leave request'}
      subtitle={`${request.user?.name ?? ''} · ${dateSpan(request)} · ${request.leaveType.name}, ${request.days} day(s)`}
      footer={
        <>
          <button type="button" className={btnOutline} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={isReject ? btnDanger : btnPrimary}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy && <Spinner />}
            {isReject ? 'Reject request' : 'Approve request'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Paperclip className="h-3.5 w-3.5" />
            Reason given
          </div>
          <p className="mt-1 whitespace-pre-wrap">{request.reason}</p>
        </div>
        <Field
          label={isReject ? 'Comment (required)' : 'Comment (optional)'}
          hint={isReject ? 'Minimum 3 characters — sent to the engineer.' : 'Sent to the engineer with the approval.'}
        >
          <textarea
            className={cn(inputCls, 'min-h-24 resize-y')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isReject ? 'Why is this request being rejected?' : 'Optional note…'}
          />
        </Field>
      </div>
    </Modal>
  )
}
