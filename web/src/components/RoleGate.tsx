import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../lib/types'

/** Per-page role guard; runs inside the authenticated shell. */
export default function RoleGate({
  roles,
  children,
}: {
  roles: Role[]
  children: ReactNode
}) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'ENGINEER') return <Navigate to="/mobile" replace />
  if (!roles.includes(user.role)) return <Navigate to="/team" replace />
  return <>{children}</>
}
