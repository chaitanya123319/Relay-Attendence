import { useEffect, useState } from 'react'
import { ExternalLink, FileText, ImageOff, Loader2 } from 'lucide-react'
import { getErrorMessage, signMediaUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

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
          'flex flex-col items-center justify-center gap-2 bg-muted p-4 text-center',
          className,
        )}
      >
        <ImageOff className="size-5 text-muted-foreground" aria-hidden />
        <span className="text-xs text-muted-foreground">{error}</span>
      </div>
    )
  }
  if (!url) {
    return (
      <div className={cn('bg-muted', className)}>
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Open full size"
      className={cn('group relative block overflow-hidden bg-muted', className)}
    >
      <img src={url} alt={alt} className="h-full w-full object-cover" />
      <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-foreground/70 p-1 text-background opacity-0 transition-opacity group-hover:opacity-100">
        <ExternalLink className="size-3.5" aria-hidden />
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
      <Button
        type="button"
        variant="link"
        size="xs"
        onClick={() => void open()}
        disabled={busy}
        className="h-auto justify-start p-0 text-[13px]"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <FileText className="size-3.5" aria-hidden />
        )}
        {label}
      </Button>
      {error && <span className="mt-0.5 text-xs text-destructive">{error}</span>}
    </span>
  )
}
