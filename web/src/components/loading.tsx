import { Loader2 } from 'lucide-react'

/** Full-viewport loading state used while the session is being restored. */
export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}
