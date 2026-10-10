import { useCallback, useEffect, useState } from 'react'
import { Camera, Hash, MapPin } from 'lucide-react'
import { api, getErrorMessage } from '@/lib/api'
import type { AttendanceRecordDetail, PhotoSide } from '@/lib/types'
import { fmtDate, fmtMinutes, fmtTime } from '@/lib/utils'
import { FlagBadge, StatusBadge } from '@/components/badges'
import { AuthedImage } from '@/components/SignedMedia'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

/** Distances read in metres under 1 km, kilometres (2 dp) beyond — DESIGN.md. */
function fmtDistance(meters: number | null): string {
  if (meters === null) return '—'
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`
}

function PhotoCard({ side, photo }: { side: string; photo: PhotoSide | null }) {
  if (!photo) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
        <Camera className="size-5" aria-hidden />
        <span className="text-[13px]">No {side.toLowerCase()} photo</span>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <AuthedImage path={photo.photoEndpoint} alt={`${side} photo`} className="h-56 w-full" />
      <div className="space-y-1.5 p-3 text-xs text-muted-foreground">
        <div className="tnum text-sm font-medium text-foreground">
          {side} · {fmtTime(photo.time)}
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="tnum">
            {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)} · ±{Math.round(photo.accuracy)} m
          </span>
        </div>
        <div>
          Distance from site:{' '}
          <span className="tnum font-medium text-foreground">
            {fmtDistance(photo.distanceMeters)}
          </span>
        </div>
        {photo.photoHash && (
          <div className="flex items-start gap-1.5">
            <Hash className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span className="break-all font-mono text-[10px] leading-tight">{photo.photoHash}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-xs' : 'tnum text-sm font-medium'}>
        {value}
      </dd>
    </div>
  )
}

/** Record detail dialog with signed-URL photos, telemetry and hash evidence. */
export default function RecordDetailModal({
  recordId,
  onClose,
}: {
  recordId: string | null
  onClose: () => void
}) {
  const [detail, setDetail] = useState<AttendanceRecordDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<AttendanceRecordDetail>(`/attendance/${recordId}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [recordId])

  useEffect(() => {
    setDetail(null)
    void load()
  }, [load])

  return (
    <Dialog
      open={recordId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="thin-scroll max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Attendance record</DialogTitle>
          <DialogDescription>
            {detail
              ? `${detail.user?.name ?? ''} · ${detail.user?.employeeId ?? ''} · ${fmtDate(detail.date)}`
              : 'Signed-URL photos, GPS telemetry and photo hash evidence.'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-5 w-48 rounded-full" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-56 rounded-lg" />
              <Skeleton className="h-56 rounded-lg" />
            </div>
            <Skeleton className="h-24 rounded-lg" />
          </div>
        )}

        {error && !loading && (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t load this record</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <Button size="xs" variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </AlertAction>
          </Alert>
        )}

        {detail && !loading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              {detail.flags.map((flag) => (
                <FlagBadge key={flag} flag={flag} />
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <PhotoCard side="Check-in" photo={detail.checkIn} />
              <PhotoCard side="Check-out" photo={detail.checkOut} />
            </div>

            <dl className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-3">
              <Stat label="Worked" value={fmtMinutes(detail.workedMinutes)} />
              <Stat label="Check-in time" value={fmtTime(detail.checkIn.time)} />
              <Stat
                label="Check-out time"
                value={detail.checkOut ? fmtTime(detail.checkOut.time) : '—'}
              />
              <Stat label="Site" value={detail.site?.name ?? '—'} />
              <Stat
                label="Client clock drift"
                value={detail.clientDriftSeconds === null ? '—' : `${detail.clientDriftSeconds}s`}
              />
              <Stat label="Device" value={detail.deviceId} mono />
            </dl>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
