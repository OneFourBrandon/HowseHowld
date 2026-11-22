import { Suspense, useEffect } from 'react'
import {
  Bell,
  CalendarDays,
  CarFront,
  Check,
  House,
  ListChecks,
  type LucideIcon,
  Moon,
  Plus,
  Settings,
  Sun,
  WalletMinimal,
  WifiOff,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { setTheme, useAppearance } from '../lib/appearance'
import type { AttentionSection } from '../lib/insights'
import { type Intent, intentState } from '../lib/intent'
import { useAppData } from '../state/AppDataContext'
import type { HouseholdFeature } from '../types'
import { AttentionRow } from './Attention'
import { Face, Popover } from './ui'
import { useHouse } from './useHouse'

interface Destination {
  to: string
  label: string
  title: string
  icon: LucideIcon
  feature?: HouseholdFeature | HouseholdFeature[]
  section?: AttentionSection
}

const destinations: Destination[] = [
  { to: '/', label: 'Overview', title: 'Overview', icon: House },
  { to: '/chores', label: 'Chores', title: 'Chores', icon: ListChecks, feature: 'chores', section: 'chores' },
  { to: '/money', label: 'Money', title: 'Money', icon: WalletMinimal, feature: 'money', section: 'money' },
  { to: '/calendar', label: 'Calendar', title: 'Calendar', icon: CalendarDays, feature: ['calendar', 'courses'] },
  { to: '/driveway', label: 'Driveway', title: 'Driveway', icon: CarFront, feature: 'driveway', section: 'driveway' },
]

const quickAdds: Array<{ label: string; to: string; intent: Intent; feature: HouseholdFeature }> = [
  { label: 'Chore', to: '/chores', intent: 'new-chore', feature: 'chores' },
  { label: 'Shared purchase', to: '/money', intent: 'new-purchase', feature: 'money' },
  { label: 'Payment to a roommate', to: '/money', intent: 'settle-up', feature: 'money' },
  { label: 'Calendar event', to: '/calendar', intent: 'new-event', feature: 'calendar' },
  { label: 'Driveway exit', to: '/driveway', intent: 'schedule-exit', feature: 'driveway' },
]

const longDate = new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })

export function SlateShell() {
  const { data, demoMode, toast, clearToast } = useAppData()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { theme } = useAppearance()
  const { me, today, attention, counts, actionCount } = useHouse()
  const enabled = (feature?: HouseholdFeature | HouseholdFeature[]) =>
    !feature || [feature].flat().some(item => data.household.enabledFeatures.includes(item))
  const nav = destinations.filter(item => enabled(item.feature))
  const adds = quickAdds.filter(item => enabled(item.feature))
  const title = pathname === '/settings' ? 'Settings'
    : destinations.find(item => item.to !== '/' && pathname.startsWith(item.to))?.title ?? 'Overview'

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(clearToast, 4_500)
    return () => window.clearTimeout(timeout)
  }, [clearToast, toast])

  return (
    <div className="sl-app">
      <aside className="sl-rail">
        <Link className="sl-mark" to="/" aria-label="HowseHowld overview">H</Link>
        <nav className="grid gap-0.5" aria-label="Primary">
          {nav.map(({ to, label, icon: Icon, section }) => (
            <NavLink className="sl-rail-link" key={to} to={to} end={to === '/'}>
              <span className="sl-rail-icon">
                <Icon size={19} strokeWidth={1.8} />
                {section && counts[section] > 0 && <span className="sl-count" aria-label={`${counts[section]} waiting on you`}>{counts[section]}</span>}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid justify-items-center gap-1.5">
          <button
            type="button"
            className="sl-icon-btn"
            aria-label={theme === 'dark' ? 'Use light mode' : 'Use dark mode'}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavLink className="sl-rail-link min-h-11!" to="/settings" aria-label="Settings">
            <span className="sl-rail-icon">
              <Settings size={19} strokeWidth={1.8} />
              {counts.settings > 0 && <span className="sl-count">{counts.settings}</span>}
            </span>
          </NavLink>
          <Link className="mt-1 rounded-full" to="/settings" aria-label={`${me.displayName}, open settings`}>
            <Face member={me} size={30} />
          </Link>
        </div>
      </aside>

      <div className="sl-main">
        {demoMode && (
          <div className="sl-strip sl-tone-brass">
            <i className="sl-dot" aria-hidden="true" />
            <span><strong className="font-[620]">Demo house.</strong> Connect Supabase to use live household data.</span>
          </div>
        )}
        {!navigator.onLine && (
          <div className="sl-strip sl-tone-brick">
            <WifiOff size={14} />
            Offline. You are viewing saved data and changes are paused.
          </div>
        )}

        <header className="sl-topbar">
          <Link className="sl-mark mb-0! size-7.5! rounded-lg! text-[.9375rem]! lg:hidden" to="/" aria-label="HowseHowld overview">H</Link>
          <div className="min-w-0 flex-1">
            <h1 className="sl-title truncate">{title}</h1>
          </div>
          <p className="sl-meta mr-1 truncate max-lg:hidden">
            {data.household.name}<span className="mx-2 text-(--sl-faint)">/</span>{longDate.format(new Date(`${today}T12:00:00Z`))}
          </p>

          <Popover
            anchorClassName="max-sm:static"
            className="w-[min(400px,calc(100vw-24px))] p-0 max-sm:right-3 max-sm:left-3 max-sm:w-auto"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                className="sl-icon-btn"
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={actionCount ? `Needs you, ${actionCount} waiting` : 'Needs you, nothing waiting'}
                onClick={toggle}
              >
                <Bell size={18} />
                {actionCount > 0 && <span className="sl-count">{actionCount}</span>}
              </button>
            )}
          >
            {close => (
              <div role="dialog" aria-label="Needs you">
                <div className="flex items-center justify-between gap-3 px-(--sl-pad) pt-3.5 pb-2.5">
                  <strong className="sl-panel-title">Needs you</strong>
                  <span className="sl-micro">{attention.length ? `${actionCount} to do` : 'All clear'}</span>
                </div>
                <div className="sl-rows max-h-[min(60dvh,420px)] overflow-y-auto border-t border-(--sl-line)">
                  {attention.map(item => <AttentionRow key={item.id} item={item} onNavigate={close} />)}
                  {!attention.length && (
                    <div className="sl-empty">
                      <span className="sl-tile sl-tone-moss mb-1"><Check size={16} /></span>
                      <strong>Nothing is waiting on you</strong>
                      Chores, votes and payments that need you show up here.
                    </div>
                  )}
                </div>
              </div>
            )}
          </Popover>

          {adds.length > 0 && (
            <Popover
              trigger={({ open, toggle }) => (
                <button type="button" className="sl-btn sl-btn-primary max-sm:w-10 max-sm:px-0" aria-expanded={open} aria-haspopup="menu" onClick={toggle}>
                  <Plus size={16} strokeWidth={2.2} />
                  <span className="max-sm:sr-only">New</span>
                </button>
              )}
            >
              {close => (
                <div role="menu" aria-label="Add to the house">
                  {adds.map(item => (
                    <button
                      type="button"
                      role="menuitem"
                      className="sl-pop-item"
                      key={item.intent}
                      onClick={() => {
                        close()
                        navigate(item.to, intentState(item.intent))
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </Popover>
          )}

          <Link className="rounded-full lg:hidden" to="/settings" aria-label={`${me.displayName}, open settings`}>
            <Face member={me} size={30} />
          </Link>
        </header>

        <main className="sl-content">
          <Suspense fallback={<p className="sl-empty" role="status">Opening…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <nav className="sl-tabbar" aria-label="Primary">
        {nav.map(({ to, label, icon: Icon, section }) => (
          <NavLink className="sl-tab" key={to} to={to} end={to === '/'}>
            <span className="sl-tab-icon">
              <Icon size={20} strokeWidth={1.8} />
              {section && counts[section] > 0 && <span className="sl-count">{counts[section]}</span>}
            </span>
            <span className="max-w-full truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {toast && (
        <div className="sl-toast" role="status">
          <span className="min-w-0 flex-1">{toast}</span>
          <button type="button" className="sl-icon-btn size-7!" onClick={clearToast} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
