import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../lib/api'
import { homeFor } from '../lib/utils'
import { FullScreenLoader, Spinner, btnPrimary, inputCls, labelCls } from '../components/ui'

const DEMO_ACCOUNTS = [
  ['Admin', 'admin@relay.local'],
  ['HR', 'hr@relay.local'],
  ['Manager', 'manager1@relay.local'],
  ['Engineer', 'engineer1@relay.local'],
] as const

export default function LoginPage() {
  const { user, ready, login } = useAuth()
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            R
          </span>
          <div>
            <div className="text-lg font-semibold text-white">RELAY Attendance</div>
            <div className="text-xs text-slate-400">
              Manager · HR · Admin dashboard for site attendance &amp; leave
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        >
          <h1 className="text-base font-semibold text-slate-900">Sign in</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Use your work email or employee ID.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className={labelCls}>Email or employee ID</span>
              <input
                className={inputCls}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@company.com or EMP-0001"
                autoComplete="username"
                autoFocus
              />
            </label>
            <label className="block">
              <span className={labelCls}>Password</span>
              <input
                className={inputCls}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
          </div>

          <button type="submit" className={`${btnPrimary} mt-5 w-full`} disabled={busy}>
            {busy ? <Spinner /> : <LogIn className="h-4 w-4" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            <div className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              Demo accounts (seeded)
            </div>
            <ul className="space-y-0.5">
              {DEMO_ACCOUNTS.map(([role, email]) => (
                <li key={email} className="flex justify-between gap-3">
                  <span>{role}</span>
                  <span className="font-mono">{email}</span>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 border-t border-slate-200 pt-1.5">
              Password for all demo accounts: <span className="font-mono">Relay@123</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
