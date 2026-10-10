import {
  CalendarDays,
  ClipboardList,
  LogOut,
  MapPin,
  Scale,
  Tags,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../lib/types'
import { cn, initials } from '../lib/utils'
import NotificationsBell from './NotificationsBell'
import { RoleBadge, btnOutline } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/team', label: 'Team today', icon: Users, roles: ['MANAGER', 'HR', 'ADMIN'] },
  { to: '/leave', label: 'Leave queue', icon: CalendarDays, roles: ['MANAGER', 'HR', 'ADMIN'] },
  { to: '/reports', label: 'Reports', icon: ClipboardList, roles: ['MANAGER', 'HR', 'ADMIN'] },
  { to: '/employees', label: 'Employees', icon: UserCog, roles: ['HR', 'ADMIN'] },
  { to: '/sites', label: 'Sites', icon: MapPin, roles: ['HR', 'ADMIN'] },
  { to: '/leave-types', label: 'Leave types', icon: Tags, roles: ['HR', 'ADMIN'] },
  { to: '/balances', label: 'Balances', icon: Scale, roles: ['HR', 'ADMIN'] },
  { to: '/payroll', label: 'Payroll', icon: Wallet, roles: ['HR', 'ADMIN'] },
]

const navClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
  )

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        R
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white">RELAY</div>
        <div className="text-[11px] text-slate-400">Attendance dashboard</div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-slate-900 md:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4 text-[11px] leading-relaxed text-slate-500">
          Geo-tagged attendance · live photo + GPS proof of presence
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="sticky top-0 z-40 md:hidden">
        <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
          <Brand />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="thin-scroll flex gap-1 overflow-x-auto bg-slate-900 px-2 pb-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap',
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <NotificationsBell />
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              {initials(user.name)}
            </span>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-medium text-slate-800">{user.name}</div>
              <div className="scale-90 origin-left">
                <RoleBadge role={user.role} />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className={cn(btnOutline, 'hidden !px-2.5 md:inline-flex')}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
