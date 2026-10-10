import { useCallback, useEffect, useState } from 'react'
import { Camera, Hash, MapPin } from 'lucide-react'
import { api, getErrorMessage } from '../lib/api'
import type { AttendanceRecordDetail, PhotoSide } from '../lib/types'
import { fmtDate, fmtMinutes, fmtTime } from '../lib/utils'
import { AuthedImage } from './SignedMedia'
import { ErrorBanner, FlagChip, Modal, Spinner, StatusChip } from './ui'

function PhotoCard({ side, photo }: { side: string; photo: PhotoSide | null }) {
  if (!photo) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
        <Camera className="h-5 w-5" />
        No {side.toLowerCase()} photo
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <AuthedImage path={photo.photoEndpoint} alt={`${side} photo`} className="h-56 w-full" />
      <div className="space-y-1.5 p-3 text-xs text-slate-600">
        <div className="text-sm font-medium text-slate-800">
          {side} · {fmtTime(photo.time)}
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 shrink-0" />
          {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)} · ±{Math.round(photo.accuracy)} m
        </div>
        <div>
          Distance from site:{' '}
          <span className="font-medium text-slate-700">
            {photo.distanceMeters === null ? '—' : `${photo.distanceMeters} m`}
          </span>
        </div>
        {photo.photoHash && (
          <div className="flex items-start gap-1.5">
            <Hash className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="break-all font-mono text-[10px] leading-tight">{photo.photoHash}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={mono ? 'break-all font-mono text-xs text-slate-800' : 'text-sm text-slate-800'}>
        {value}
      </div>
    </div>
  )
}

/** Record detail modal with signed-URL photos, telemetry and hash evidence. */
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
    <Modal
      open={recordId !== null}
      onClose={onClose}
      title="Attendance record"
      subtitle={detail ? `${detail.user?.name ?? ''} · ${detail.user?.employeeId ?? ''} · ${fmtDate(detail.date)}` : undefined}
      size="xl"
    >
      {loading && (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      )}
      {error && !loading && <ErrorBanner message={error} onRetry={() => void load()} />}
      {detail && !loading && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={detail.status} />
            {detail.flags.map((flag) => (
              <FlagChip key={flag} flag={flag} />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PhotoCard side="Check-in" photo={detail.checkIn} />
            <PhotoCard side="Check-out" photo={detail.checkOut} />
          </div>

          <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            <Stat label="Worked" value={fmtMinutes(detail.workedMinutes)} />
            <Stat label="Check-in time" value={fmtTime(detail.checkIn.time)} />
            <Stat label="Check-out time" value={detail.checkOut ? fmtTime(detail.checkOut.time) : '—'} />
            <Stat label="Site" value={detail.site?.name ?? '—'} />
            <Stat
              label="Client clock drift"
              value={detail.clientDriftSeconds === null ? '—' : `${detail.clientDriftSeconds}s`}
            />
            <Stat label="Device" value={detail.deviceId} mono />
          </div>
        </div>
      )}
    </Modal>
  )
}
