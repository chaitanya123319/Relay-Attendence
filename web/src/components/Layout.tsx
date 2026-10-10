import { useState } from 'react'
import {
  CalendarDays,
  ClipboardList,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Scale,
  Sun,
  Tags,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { RoleBadge } from '@/components/badges'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/lib/theme'
import type { Role } from '@/lib/types'
import { cn, initials } from '@/lib/utils'
import NotificationsBell from './NotificationsBell'

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
    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  )

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        R
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold">RELAY</div>
        <div className="text-xs text-muted-foreground">Attendance dashboard</div>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={label}>
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</TooltipContent>
    </Tooltip>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  if (!user) return null
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Brand />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs leading-relaxed text-muted-foreground">
          Geo-tagged attendance · live photo + GPS proof of presence
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b bg-background/95 px-3 backdrop-blur md:px-6">
          {/* Mobile navigation */}
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-14 items-center border-b px-4">
                <Brand />
              </div>
              <nav className="space-y-0.5 p-3">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={navClass}
                    onClick={() => setNavOpen(false)}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="flex-1" />

          <ThemeToggle />
          <NotificationsBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <Avatar className="size-6">
                  <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="text-sm">{user.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                <RoleBadge role={user.role} className="mt-1 w-fit" />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void toggle()} className="md:hidden">
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {theme === 'dark' ? 'Light theme' : 'Dark theme'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleLogout()}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-4 md:p-6">
          {/* The single authored motion moment: route content settles in once. */}
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
