import { Navigate, useNavigate } from 'react-router-dom'
import { LogOut, Smartphone } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { FullScreenLoader } from '@/components/loading'
import { RoleBadge } from '@/components/badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { homeFor } from '@/lib/utils'

/** ENGINEER accounts belong on the mobile app — friendly single screen. */
export default function EngineerNoticePage() {
  const { user, ready, logout } = useAuth()
  const navigate = useNavigate()

  if (!ready) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ENGINEER') return <Navigate to={homeFor(user.role)} replace />

  return (
    <div className="page-enter flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Smartphone className="size-6 text-muted-foreground" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">
            Hi {user.name.split(' ')[0]} — use the RELAY mobile app
          </h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            This web dashboard is built for managers, HR and administrators. Engineers mark
            attendance with a live photo + GPS from the RELAY mobile app, where you can also apply
            for leave and track your history.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] text-muted-foreground">
            <span className="font-mono">{user.email}</span>
            <RoleBadge role={user.role} />
          </div>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => {
              void logout().then(() => navigate('/login', { replace: true }))
            }}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
