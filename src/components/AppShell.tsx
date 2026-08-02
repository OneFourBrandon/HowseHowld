import { cn } from '../lib/cn'
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
    <div className={"app-frame min-h-screen grid grid-cols-[238px_1fr] max-[980px]:block max-[980px]:min-h-dvh"}>
      <aside className={"sidebar fixed inset-[0_auto_0_0] w-59.5 overflow-hidden p-[28px_18px] text-[#edf3ee] bg-(--forest) flex flex-col z-[20] border-r max-[980px]:hidden"}>
        <div className={"brand flex items-center gap-3"}>
          <div className={"brand-mark w-9.5 h-9.5 grid place-items-center rounded-xl text-(--forest) bg-[#f1d799] font-display text-[1.3rem] font-bold"} aria-hidden="true">
            H
          </div>
          <div>
            <strong className="block font-display text-[1.18rem] tracking-[-.02em]">HowseHowld</strong>
            <span className="mt-0.5 block text-[.78rem] text-[#c3d5bc]">{data.household.name}</span>
          </div>
        </div>

        <nav className={"desktop-nav grid gap-0.5 mt-11"} aria-label="Primary">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => desktopNavClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={1.9} />
                  <span className={cn('transition-[transform_.18s_ease,text-shadow_.18s_ease]', isActive && 'translate-x-1 text-shadow-[0_0_10px_rgba(239,207,136,.42)]')}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={"sidebar-footer mt-auto p-[15px_10px_0] border-t flex items-center gap-2.5"}>
          <Avatar
            initials={currentMember.initials}
            color={currentMember.color}
            imageUrl={currentMember.avatarUrl}
            size="sm"
          />
          <div>
            <strong className="block text-[.88rem]">{currentMember.displayName}</strong>
            <span className="mt-0.5 block text-[.78rem] text-[#bdd0b5]">{currentMember.role === 'owner' ? 'Howse Admin' : 'Member'}</span>
          </div>
        </div>
      </aside>

      <div className={"main-column col-[2] min-w-0 max-[980px]:relative max-[980px]:min-h-dvh"}>
        {demoMode && (
          <div className={"demo-banner flex items-center justify-center gap-2 font-bold tracking-[.02em] text-[#6f5420] bg-[#efdfb8] min-h-9 text-[.78rem]"}>
            <span className={"demo-dot w-1.5 h-1.5 rounded-full bg-(--gold)"} />
            Demo house
            <span className="font-medium text-[#88764e]">Connect Supabase to use live household data.</span>
          </div>
        )}
        {!navigator.onLine && (
          <div className={"offline-banner flex items-center justify-center gap-2 font-bold tracking-[.02em] text-white bg-(--coral) min-h-9 text-[.78rem]"}>
            <WifiOff size={16} />
            Offline — viewing cached data. Changes are paused.
          </div>
        )}
        <NavLink
          to="/settings"
          aria-label="Settings"
          className={({ isActive }) =>
            cn(
              'mobile-settings-link hidden max-[980px]:absolute max-[980px]:top-4.5 max-[980px]:right-5 max-[980px]:z-[35] max-[980px]:grid max-[980px]:w-10.5 max-[980px]:h-10.5 max-[980px]:place-items-center max-[980px]:border max-[980px]:rounded-[10px] max-[980px]:text-(--forest) max-[980px]:bg-[rgba(244,241,232,.78)] max-[980px]:shadow-[0_8px_24px_rgba(29,46,24,.09)]  max-[980px]:backdrop-blur-[14px] max-[980px]:backdrop-saturate-[1.35]',
              demoMode && 'mobile-settings-link-with-banner max-[980px]:top-12.5',
              isActive && 'is-active max-[980px]:bg-(--forest)! max-[980px]:text-white',
            )}
        >
          <Settings size={21} strokeWidth={1.9} />
        </NavLink>
        <main className={"page-content m-[0_auto] pt-13.5 max-[980px]:pt-19 w-[min(1400px,100%)] p-[58px_64px_104px] max-[980px]:w-full max-[980px]:p-[48px_40px_calc(112px+env(safe-area-inset-bottom,0px))] max-[640px]:p-[32px_20px_calc(116px+env(safe-area-inset-bottom,0px))]"}>
          <Outlet />
        </main>
      </div>

      <nav
        className={"mobile-nav hidden max-[980px]:fixed! max-[980px]:top-auto! max-[980px]:left-1/2! max-[980px]:right-auto! max-[980px]:bottom-[calc(20px+env(safe-area-inset-bottom,0px))]! max-[980px]:m-0! max-[980px]:w-[calc(100%-24px)]! max-[980px]:min-w-0! max-[980px]:z-40 max-[980px]:grid max-[980px]:grid-cols-[repeat(var(--mobile-nav-count,5),1fr)] max-[980px]:p-1.75 max-[980px]:border max-[980px]:rounded-[19px] max-[980px]:text-[#f0f6ed] max-[980px]:bg-[rgba(32,57,23,.78)] max-[980px]:shadow-[0_12px_32px_rgba(18,35,14,.18),0_3px_10px_rgba(18,35,14,.12),inset_0_1px_0_rgba(255,255,255,.14)] max-[980px]:backdrop-blur-[22px] max-[980px]:backdrop-saturate-[1.45]"}
        aria-label="Primary"
style={{ '--mobile-nav-count': mobileNavItems.length, position: 'fixed', top: 'auto', left: '50%', right: 'auto', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', margin: 0, width: 'calc(100% - 24px)', minWidth: 0, transform: 'translateX(-50%)' } as CSSProperties}
      >
        {mobileNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => mobileNavClass(isActive)}
          >
            <Icon className="flex-[0_0_auto] drop-shadow-[0_1px_2px_rgba(14,31,10,.2)]" size={21} strokeWidth={1.9} />
            <span className="block w-full text-shadow-[0_1px_2px_rgba(14,31,10,.2)]">{label}</span>
          </NavLink>
        ))}
      </nav>

      {toast && (
        <div className={"toast fixed right-6 bottom-6 z-[80] max-w-90 p-[13px_15px] flex items-center gap-3 rounded-xl text-white bg-(--forest) shadow-[var(--shadow)] max-[640px]:left-3.5 max-[640px]:right-3.5 max-[640px]:bottom-21.75 max-[640px]:max-w-[none] text-[.82rem]"} role="status">
          <span>{toast}</span>
          <button className="ml-auto border-0 bg-transparent p-0.5 text-white" onClick={clearToast} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function desktopNavClass(active: boolean) {
  return cn(
    "nav-link relative flex min-h-13 items-center gap-3 overflow-hidden rounded-lg bg-transparent p-[0_13px] pl-4.5 text-[.96rem] font-[650] text-[#d0dfca] shadow-none transition-[background-color_.18s_ease,color_.18s_ease,transform_.18s_ease] before:absolute before:left-0 before:h-[calc(100%-8px)] before:w-0.75 before:scale-y-[.45] before:rounded-[0_3px_3px_0] before:bg-[#efcf88] before:opacity-0 before:transition-[opacity_.18s_ease,transform_.18s_ease] before:content-[''] hover:translate-x-1 hover:bg-[rgba(255,255,255,.045)] hover:text-white",
    active && 'nav-link-active bg-[linear-gradient(90deg,rgba(255,255,255,.13),rgba(255,255,255,.09))]! text-white shadow-[inset_0_1px_0_rgba(255,255,255,.035),inset_0_-1px_0_rgba(0,0,0,.035)] before:scale-y-100 before:opacity-100',
  )
}

function mobileNavClass(active: boolean) {
  return cn(
    "nav-link relative flex min-h-13 min-w-0 flex-col items-center justify-center gap-1 rounded-none bg-transparent p-[4px_2px] text-center text-[.48rem] leading-none text-[#d0dfca] shadow-none transition-[.18s_ease] before:absolute before:left-0 before:top-1/2 before:h-7 before:w-0.25 before:-translate-y-1/2 before:bg-[rgba(255,255,255,.23)] before:content-[''] first:before:hidden after:absolute after:bottom-0.25 after:h-1 after:w-1 after:scale-50 after:rounded-full after:bg-[#f1d799] after:opacity-0 after:transition-[opacity_.18s_ease,transform_.18s_ease] max-[640px]:min-h-14.5 max-[640px]:gap-1.25 max-[640px]:py-1.5 max-[640px]:text-[.62rem]",
    active && 'nav-link-active text-white after:scale-100 after:opacity-100',
  )
}
