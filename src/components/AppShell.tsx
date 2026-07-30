import { useEffect } from 'react'
import {
  CalendarDays,
  CarFront,
  CheckSquare2,
  CircleDollarSign,
  Home,
  Settings,
  WifiOff,
  X,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAppData } from '../state/AppDataContext'
import { Avatar } from './ui'

const navItems = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/chores', label: 'Chores', icon: CheckSquare2 },
  { to: '/money', label: 'Money', icon: CircleDollarSign },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/driveway', label: 'Driveway', icon: CarFront },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell() {
  const { data, demoMode, toast, clearToast } = useAppData()
  const currentMember =
    data.members.find((member) => member.id === data.household.currentMemberId) ??
    data.members[0]

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(clearToast, 4_500)
    return () => window.clearTimeout(timeout)
  }, [clearToast, toast])

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            H
          </div>
          <div>
            <strong>HowseHowld</strong>
            <span>{data.household.name}</span>
          </div>
        </div>

        <nav className="desktop-nav" aria-label="Primary">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => clsxNav(isActive)}
            >
              <Icon size={20} strokeWidth={1.9} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Avatar
            initials={currentMember.initials}
            color={currentMember.color}
            size="sm"
          />
          <div>
            <strong>{currentMember.displayName}</strong>
            <span>{currentMember.role === 'owner' ? 'House owner' : 'Member'}</span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        {demoMode && (
          <div className="demo-banner">
            <span className="demo-dot" />
            Demo house
            <span>Connect Supabase to use live household data.</span>
          </div>
        )}
        {!navigator.onLine && (
          <div className="offline-banner">
            <WifiOff size={16} />
            Offline — viewing cached data. Changes are paused.
          </div>
        )}
        <main className="page-content">
          <Outlet />
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Primary">
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsxNav(isActive)}
          >
            <Icon size={21} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button onClick={clearToast} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function clsxNav(active: boolean) {
  return active ? 'nav-link nav-link-active' : 'nav-link'
}
