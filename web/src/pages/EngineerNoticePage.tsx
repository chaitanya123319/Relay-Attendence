import { Navigate, useNavigate } from 'react-router-dom'
import { LogOut, Smartphone } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { FullScreenLoader, RoleBadge, btnOutline } from '../components/ui'
import { homeFor } from '../lib/utils'

/** ENGINEER accounts belong on the mobile app — friendly single screen. */
export default function EngineerNoticePage() {
  const { user, ready, logout } = useAuth()
  const navigate = useNavigate()

  if (!ready) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'ENGINEER') return <Navigate to={homeFor(user.role)} replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
          <Smartphone className="h-7 w-7 text-indigo-600" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">
          Hi {user.name.split(' ')[0]} — use the RELAY mobile app
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          This web dashboard is built for managers, HR and administrators. Engineers mark
          attendance with a live photo + GPS from the RELAY mobile app, where you can also
          apply for leave and track your history.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
          <span>{user.email}</span>
          <RoleBadge role={user.role} />
        </div>
        <button
          type="button"
          className={`${btnOutline} mt-6 w-full`}
          onClick={() => {
            void logout().then(() => navigate('/login', { replace: true }))
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
