import { cn } from '../lib/cn'
import { useEffect } from 'react'
import {
  Bell,
  CalendarDays,
  Car,
  Home,
  ListTodo,
  Settings,
  WalletMinimal,
  WifiOff,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAppData } from '../state/AppDataContext'
import type { HouseholdFeature } from '../types'
import { Avatar } from './ui'
import { BrandMark } from './BrandMark'

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
]

export function AppShell() {
  const { data, demoMode, toast, clearToast } = useAppData()
  const { pathname } = useLocation()
  const currentMember =
    data.members.find((member) => member.id === data.household.currentMemberId) ??
    data.members[0]
  const visibleNavItems = navItems.filter(({ feature }) => {
    if (!feature) return true
    const candidates = Array.isArray(feature) ? feature : [feature]
    return candidates.some((item) => data.household.enabledFeatures.includes(item))
  })
  const notificationsOn = data.household.enabledFeatures.includes('notifications')

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(clearToast, 4_500)
    return () => window.clearTimeout(timeout)
  }, [clearToast, toast])

  return (
    <div className="min-h-dvh bg-(--bg)">
      {demoMode && (
        <div className="flex min-h-8 items-center justify-center gap-2 bg-(--amber-soft) text-[.76rem] font-bold text-(--amber)">
          <span className="size-1.5 rounded-full bg-(--amber)" />
          Demo house
          <span className="font-medium text-(--text-3) max-[560px]:hidden">
            Connect Supabase to use live household data.
          </span>
        </div>
      )}
      {!navigator.onLine && (
        <div className="flex min-h-8 items-center justify-center gap-2 bg-(--red-soft) text-[.76rem] font-bold text-[#ff8080]">
          <WifiOff size={15} />
          Offline — viewing cached data. Changes are paused.
        </div>
      )}

      <div className="mx-auto w-[min(1560px,100%)] px-8 max-[980px]:px-5 max-[640px]:px-4">
        <header className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-6 max-[980px]:grid-cols-[1fr_auto] max-[980px]:gap-3">
          <NavLink to="/" className="flex min-w-0 items-center gap-3">
            <BrandMark size={36} />
            <span className="grid min-w-0 leading-tight max-[360px]:hidden">
              <span className="text-[1.05rem] font-extrabold tracking-[-.02em]">HowseHowld</span>
              <span className="truncate text-[.72rem] font-semibold text-(--text-3)">
                {data.household.name}
              </span>
            </span>
          </NavLink>

          <nav className="hh-navpill max-[980px]:hidden" aria-label="Primary">
            {visibleNavItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => cn('hh-navitem', isActive && 'hh-navitem-on')}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-2">
            {notificationsOn && (
              <NavLink
                to="/settings"
                aria-label="Notifications"
                className="hh-btn hh-btn-icon relative size-10 max-[640px]:size-9"
              >
                <Bell size={17} />
                {!data.notificationHealth.subscribed && (
                  <i className="absolute top-2 right-2.5 size-1.75 rounded-full bg-(--pink) shadow-[0_0_0_2px_var(--bg)]" />
                )}
              </NavLink>
            )}
            <NavLink
              to="/settings"
              aria-label="Settings"
              className={({ isActive }) =>
                cn(
                  'hh-btn hh-btn-icon size-10 max-[640px]:size-9',
                  isActive && 'border-transparent bg-(--raise) text-(--text)',
                )
              }
            >
              <Settings size={17} />
            </NavLink>
            <NavLink
              to="/settings"
              aria-label={`Open settings for ${currentMember.displayName}`}
              className="ml-1 inline-flex rounded-full"
            >
              <Avatar
                initials={currentMember.initials}
                color={currentMember.color}
                imageUrl={currentMember.avatarUrl}
                size="lg"
                className="shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--line-2)] max-[640px]:size-9!"
              />
            </NavLink>
          </div>
        </header>

        <main
          key={pathname}
          className="hh-reveal grid content-start gap-5 pt-2 pb-16 max-[980px]:pb-[calc(104px+env(safe-area-inset-bottom,0px))]"
        >
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed bottom-[calc(14px+env(safe-area-inset-bottom,0px))] left-1/2 z-40 hidden w-[calc(100%-28px)] -translate-x-1/2 max-[980px]:grid"
        aria-label="Primary"
      >
        <div
          className="hh-navpill grid p-1.25 shadow-[0_18px_40px_-16px_rgba(0,0,0,.8)] backdrop-blur-[14px]"
          style={{
            gridTemplateColumns: `repeat(${visibleNavItems.length}, minmax(0, 1fr))`,
            background: 'rgba(29,30,35,.92)',
          }}
        >
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-w-0 flex-col items-center justify-center gap-1 rounded-full py-2 text-[.62rem] font-bold transition-[color,background-color,transform] duration-150 active:scale-95',
                  isActive ? 'bg-(--raise) text-(--text)' : 'text-(--text-3)',
                )
              }
            >
              <Icon size={19} strokeWidth={1.9} />
              <span className="w-full truncate text-center">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {toast && (
        <div
          className="hh-anim-toast fixed right-6 bottom-6 z-80 flex max-w-90 items-center gap-3 rounded-full border border-(--line-2) bg-(--text) px-4 py-3 text-[.82rem] font-semibold text-(--bg) shadow-[0_20px_50px_-18px_rgba(0,0,0,.9)] max-[640px]:right-3.5 max-[640px]:bottom-27 max-[640px]:left-3.5 max-[640px]:max-w-none"
          role="status"
        >
          <span className="min-w-0">{toast}</span>
          <button
            type="button"
            className="ml-auto shrink-0 rounded-full p-0.5 text-(--bg) opacity-60 hover:opacity-100"
            onClick={clearToast}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
