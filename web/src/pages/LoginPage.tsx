import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import { FullScreenLoader } from '@/components/loading'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/api'
import { homeFor } from '@/lib/utils'

const DEMO_ACCOUNTS = [
  ['Admin', 'admin@relay.local'],
  ['HR', 'hr@relay.local'],
  ['Manager', 'manager1@relay.local'],
  ['Engineer', 'engineer1@relay.local'],
] as const

export default function LoginPage() {
  const { user, ready, login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!ready) return <FullScreenLoader />
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? homeFor(user.role)} replace />
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!identifier.trim() || !password) {
      setError('Enter your email / employee ID and password')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const loggedIn = await login(identifier.trim(), password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? homeFor(loggedIn.role), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onGoogleCredential = async (idToken: string) => {
    setBusy(true)
    setError(null)
    try {
      const loggedIn = await loginWithGoogle(idToken)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? homeFor(loggedIn.role), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-enter flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
          R
        </span>
        <div>
          <div className="text-lg font-semibold tracking-tight">RELAY Attendance</div>
          <div className="text-xs text-muted-foreground">
            Manager · HR · Admin dashboard for site attendance &amp; leave
          </div>
        </div>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Use your work email or employee ID.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="identifier">Email or employee ID</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@company.com or EMP-0001"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              <LogIn className="size-4" />
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-4">
            <GoogleSignInButton
              onCredential={(token) => void onGoogleCredential(token)}
              disabled={busy}
            />
          </div>
        </CardContent>

        <CardContent className="border-t pt-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Demo accounts (seeded)
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {DEMO_ACCOUNTS.map(([role, email]) => (
              <li key={email} className="flex items-baseline justify-between gap-3">
                <span>{role}</span>
                <span className="tnum font-mono text-foreground/80">{email}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
            Password for all demo accounts:{' '}
            <span className="font-mono text-foreground/80">Relay@123</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
