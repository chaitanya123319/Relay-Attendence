import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { homeFor } from '@/lib/utils'

export default function NotFoundPage() {
  const { user } = useAuth()
  return (
    <div className="page-enter flex min-h-svh flex-col items-center justify-center gap-3 bg-muted/40 px-4 text-center">
      <Compass className="size-6 text-muted-foreground" aria-hidden />
      <div className="text-3xl font-semibold tracking-tight text-muted-foreground">404</div>
      <p className="text-sm font-medium">This page doesn&apos;t exist.</p>
      <Button variant="outline" asChild>
        <Link to={user ? homeFor(user.role) : '/login'}>
          Back to {user ? 'dashboard' : 'sign in'}
        </Link>
      </Button>
    </div>
  )
}
