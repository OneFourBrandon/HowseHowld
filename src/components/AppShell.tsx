import { type CSSProperties, useEffect } from 'react'
import {
  CalendarDays,
  Car,
  Home,
  ListTodo,
  Settings,
  WalletMinimal,
  WifiOff,
  X,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAppData } from '../state/AppDataContext'
import type { HouseholdFeature } from '../types'
import { Avatar } from './ui'

const navItems: Array<{
  to: string
  label: string
  icon: typeof Home
  feature?: HouseholdFeature | HouseholdFeature[]
}> = [
  { to: '/', label: 'Overview', icon: Home },
  { to: '/chores', label: 'Chores', icon: ListTodo, feature: 'chores' },
  { to: '/money', label: 'Money', icon: WalletMinimal, feature: 'money' },
  {
    to: '/calendar',
    label: 'Calendar',
    icon: CalendarDays,
    feature: ['calendar', 'courses'],
  },
  { to: '/driveway', label: 'Driveway', icon: Car, feature: 'driveway' },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell() {
  const { data, demoMode, toast, clearToast } = useAppData()
  const currentMember =
    data.members.find((member) => member.id === data.household.currentMemberId) ??
    data.members[0]
  const visibleNavItems = navItems.filter(({ feature }) => {
    if (!feature) return true
    const candidates = Array.isArray(feature) ? feature : [feature]
    return candidates.some((item) => data.household.enabledFeatures.includes(item))
  })
  const mobileNavItems = visibleNavItems.filter((item) => item.to !== '/settings')

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
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
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
        <NavLink
          to="/settings"
          aria-label="Settings"
          className={({ isActive }) =>
            `mobile-settings-link${demoMode ? ' mobile-settings-link-with-banner' : ''}${isActive ? ' is-active' : ''}`
          }
        >
          <Settings size={21} strokeWidth={1.9} />
        </NavLink>
        <main className="page-content">
          <Outlet />
        </main>
      </div>

      <nav
        className="mobile-nav"
        aria-label="Primary"
        style={{ '--mobile-nav-count': mobileNavItems.length } as CSSProperties}
      >
        {mobileNavItems.map(({ to, label, icon: Icon }) => (
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
