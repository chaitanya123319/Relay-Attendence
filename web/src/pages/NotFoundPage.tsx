import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { homeFor } from '../lib/utils'

export default function NotFoundPage() {
  const { user } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-center">
      <div className="text-4xl font-bold text-slate-300">404</div>
      <p className="text-sm font-medium text-slate-700">This page doesn&apos;t exist.</p>
      <Link
        to={user ? homeFor(user.role) : '/login'}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
      >
        Back to {user ? 'dashboard' : 'sign in'}
      </Link>
    </div>
  )
}
