import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Loader2, Paperclip, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { SignedDocumentLink } from '@/components/SignedMedia'
import { StatusBadge } from '@/components/badges'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { api, getErrorMessage } from '@/lib/api'
import type { LeaveRequest } from '@/lib/types'
import { fmtDate, fmtDateTime, initials, timeAgo } from '@/lib/utils'

type Tab = 'PENDING' | 'HISTORY'

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
  const [decision, setDecision] = useState<{
    request: LeaveRequest
    mode: 'approve' | 'reject'
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = tab === 'PENDING' ? { status: 'PENDING' } : undefined
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

  /* History shows decided / cancelled requests; pending work lives on its own tab. */
  const history = useMemo(() => items.filter((request) => request.status !== 'PENDING'), [items])

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight">Leave queue</h1>
        <p className="text-[13px] text-muted-foreground">
          Review leave requests from engineers on your sites
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="HISTORY">History</TabsTrigger>
        </TabsList>

        <TabsContent value="PENDING">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Couldn&apos;t load requests</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <Button size="xs" variant="outline" onClick={() => void load()}>
                  Retry
                </Button>
              </AlertAction>
            </Alert>
          )}

          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="gap-0 space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex justify-end gap-2 pt-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </Card>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
              <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">No pending requests</p>
              <p className="max-w-md text-[13px] text-muted-foreground">
                Leave requests from your assigned engineers will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((request) => (
                <Card key={request.id} className="gap-0 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="text-xs">
                        {initials(request.user?.name ?? '?')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {request.user?.name ?? 'Unknown'}
                        </span>
                        <span className="tnum text-xs text-muted-foreground">
                          {request.user?.employeeId}
                        </span>
                        <span className="ml-auto">
                          <StatusBadge status={request.status} />
                        </span>
                      </div>
                      <div className="tnum mt-1 text-[13px] text-muted-foreground">
                        {dateSpan(request)} ·{' '}
                        <span className="font-medium text-foreground">{request.days} day(s)</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">
                      {request.leaveType.name} ({request.leaveType.code})
                    </Badge>
                    {request.leaveType.paid && <Badge variant="secondary">Paid</Badge>}
                    {request.isHalfDay && (
                      <Badge variant="secondary">{request.halfDayPeriod ?? 'AM'} half-day</Badge>
                    )}
                  </div>

                  <p className="mt-3 flex-1 text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {request.reason}
                  </p>

                  {request.documents.length > 0 && (
                    <div className="mt-3 space-y-1 border-t pt-3">
                      {request.documents.map((doc) => (
                        <SignedDocumentLink key={doc.id} path={doc.endpoint} label={doc.originalName} />
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
                    <span className="tnum text-xs text-muted-foreground">
                      Requested {timeAgo(request.createdAt)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDecision({ request, mode: 'reject' })}
                      >
                        <XCircle className="size-4" aria-hidden />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setDecision({ request, mode: 'approve' })}
                      >
                        <CheckCircle2 className="size-4" aria-hidden />
                        Approve
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="HISTORY">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Couldn&apos;t load requests</AlertTitle>
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
                    Employee
                  </TableHead>
                  <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Dates
                  </TableHead>
                  <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Days
                  </TableHead>
                  <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Decided by
                  </TableHead>
                  <TableHead className="px-3 text-xs uppercase tracking-wide text-muted-foreground">
                    Comment
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, row) => (
                    <TableRow key={row} className="h-10 hover:bg-transparent">
                      {Array.from({ length: 7 }).map((__, cell) => (
                        <TableCell key={cell} className="px-3 py-2">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : history.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="h-40 text-center whitespace-normal">
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                        <CalendarDays className="size-6" aria-hidden />
                        <span className="text-sm font-medium text-foreground">
                          No decided requests yet
                        </span>
                        <span className="max-w-md text-[13px]">
                          Approved, rejected and cancelled requests will appear here.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((request) => (
                    <TableRow key={request.id} className="h-10">
                      <TableCell className="px-3 py-2">
                        <span className="font-medium">{request.user?.name ?? '—'}</span>
                        <span className="tnum ml-2 text-xs text-muted-foreground">
                          {request.user?.employeeId}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2">{request.leaveType.name}</TableCell>
                      <TableCell className="tnum px-3 py-2 text-muted-foreground">
                        {dateSpan(request)}
                      </TableCell>
                      <TableCell className="tnum px-3 py-2">{request.days}</TableCell>
                      <TableCell className="px-3 py-2">
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        {request.decidedBy ? (
                          <>
                            <span>{request.decidedBy.name}</span>
                            <span className="tnum ml-2 text-xs text-muted-foreground">
                              {request.decidedAt ? fmtDateTime(request.decidedAt) : ''}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-56 px-3 py-2 whitespace-normal text-muted-foreground">
                        {request.decisionComment ? (
                          <span className="line-clamp-2" title={request.decisionComment}>
                            {request.decisionComment}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {decision && (
        <DecisionDialog
          request={decision.request}
          mode={decision.mode}
          onCancel={() => setDecision(null)}
          onDone={() => {
            setDecision(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function DecisionDialog({
  request,
  mode,
  onCancel,
  onDone,
}: {
  request: LeaveRequest
  mode: 'approve' | 'reject'
  onCancel: () => void
  onDone: () => void
}) {
  const isReject = mode === 'reject'
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = comment.trim()
    if (isReject && trimmed.length < 3) {
      setFieldError('A comment of at least 3 characters is required when rejecting.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (isReject) {
        await api.post(`/leave/requests/${request.id}/reject`, { comment: trimmed })
        toast.success('Leave request rejected.')
      } else {
        await api.post(`/leave/requests/${request.id}/approve`, trimmed ? { comment: trimmed } : {})
        toast.success('Leave request approved — balance updated.')
      }
      onDone()
    } catch (err) {
      setError(getErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isReject ? 'Reject leave request' : 'Approve leave request'}</DialogTitle>
          <DialogDescription>
            {request.user?.name ?? ''} · {dateSpan(request)} · {request.leaveType.name},{' '}
            {request.days} day(s)
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Paperclip className="size-3.5" aria-hidden />
            Reason given
          </div>
          <p className="mt-1 text-[13px] whitespace-pre-wrap text-foreground">{request.reason}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="decision-comment">
            {isReject ? 'Comment (required)' : 'Comment (optional)'}
          </Label>
          <Textarea
            id="decision-comment"
            className="min-h-24 resize-y"
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              if (fieldError) setFieldError(null)
            }}
            placeholder={isReject ? 'Why is this request being rejected?' : 'Optional note…'}
            aria-invalid={fieldError ? true : undefined}
          />
          {fieldError ? (
            <p className="text-xs text-destructive">{fieldError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isReject
                ? 'Minimum 3 characters — sent to the engineer.'
                : 'Sent to the engineer with the approval.'}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={isReject ? 'destructive' : 'default'}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isReject ? 'Reject request' : 'Approve request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
