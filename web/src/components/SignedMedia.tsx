import { useEffect, useState } from 'react'
import { ExternalLink, FileText, ImageOff } from 'lucide-react'
import { getErrorMessage, signMediaUrl } from '../lib/api'
import { cn } from '../lib/utils'
import { Spinner } from './ui'

/**
 * Renders a protected image (attendance photo) via the signed-URL flow:
 * POST /uploads/signed-url → short-lived HMAC URL → <img src>.
 */
export function AuthedImage({
  path,
  alt,
  className,
}: {
  path: string
  alt: string
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(null)
    signMediaUrl(path)
      .then((signed) => {
        if (!cancelled) setUrl(signed)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [path])

  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 bg-slate-100 p-4 text-center',
          className,
        )}
      >
        <ImageOff className="h-6 w-6 text-slate-400" />
        <span className="text-xs text-slate-500">{error}</span>
      </div>
    )
  }
  if (!url) {
    return (
      <div className={cn('flex items-center justify-center bg-slate-100', className)}>
        <Spinner className="text-slate-400" />
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Open full size"
      className={cn('group relative block overflow-hidden bg-slate-100', className)}
    >
      <img src={url} alt={alt} className="h-full w-full object-cover" />
      <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-slate-900/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </a>
  )
}

/** Opens a protected document (leave attachment) through a signed URL in a new tab. */
export function SignedDocumentLink({
  path,
  label,
  className,
}: {
  path: string
  label: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = async () => {
    setBusy(true)
    setError(null)
    try {
      const url = await signMediaUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={cn('inline-flex flex-col', className)}>
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
      >
        {busy ? <Spinner className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
        {label}
      </button>
      {error && <span className="mt-0.5 text-xs text-rose-600">{error}</span>}
    </span>
  )
}
