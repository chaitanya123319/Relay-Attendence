import type { LucideIcon } from 'lucide-react'
import { Clock3, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/types'
import { flagMeta, ROLE_META, statusMeta } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/** Status chip (attendance + leave states) — tint classes come from lib/utils. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = statusMeta(status)
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium', meta.cls, className)}>
      {meta.label}
    </Badge>
  )
}

const FLAG_ICONS: Record<string, LucideIcon> = {
  OUT_OF_RANGE: TriangleAlert,
  TIME_DRIFT: Clock3,
}

/** Anti-fraud flag chip — icon + label, never colour alone. */
export function FlagBadge({ flag, className }: { flag: string; className?: string }) {
  const meta = flagMeta(flag)
  const Icon = FLAG_ICONS[flag] ?? TriangleAlert
  return (
    <Badge variant="outline" className={cn('gap-1 rounded-full font-medium', meta.cls, className)}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </Badge>
  )
}

/** Role chip for the header/dropdowns. */
export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const meta = ROLE_META[role]
  return (
    <Badge variant="outline" className={cn('rounded-full font-medium', meta.cls, className)}>
      {meta.label}
    </Badge>
  )
}
