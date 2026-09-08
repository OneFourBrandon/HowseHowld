import { ThemeToggle } from '../components/ThemeToggle'
import { EmailRecovery } from '../components/EmailRecovery'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Circle,
  Clock3,
  Plus,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import {
  dateKeyInTimeZone,
  formatMoney,
  formatShortTime,
  taskCompletionAvailability,
  timeUntil,
} from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { MoneyCents, UUID } from '../types'
import { Avatar, Badge, Button } from '../components/ui'
import { ChoreOccurrenceIcon } from '../components/ChoreOccurrenceIcon'

type AgendaKind = 'chore' | 'bill' | 'event' | 'departure'

interface AgendaItem {
  id: string
  kind: AgendaKind
  dateKey: string
  sortAt: number
  timeLabel: string
  title: string
  subtitle: string
  assigneeId?: UUID
  occurrenceId?: UUID
  occurrenceStatus?: 'assigned' | 'completed' | 'missed'
  dueAt?: string
  amountCents?: MoneyCents
  paid?: boolean
  href: string
}

const dateFromKey = (key: string) => new Date(`${key}T12:00:00Z`)

const addDateKeyDays = (key: string, days: number) => {
  const date = dateFromKey(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const shortWeekday = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  timeZone: 'UTC',
})

const longDate = new Intl.DateTimeFormat('en-CA', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

const shortDate = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function AgendaIcon({
  kind,
  occurrenceStatus = 'assigned',
}: {
  kind: AgendaKind
  occurrenceStatus?: 'assigned' | 'completed' | 'missed'
}) {
  if (kind === 'bill') {
    return <span className="grid size-10 place-items-center rounded-[9px] bg-(--gold-soft) text-[#9a6d13] dark:text-(--gold)"><CircleDollarSign size={20} /></span>
  }
  if (kind === 'event') {
    return <span className="grid size-10 place-items-center rounded-[9px] bg-(--blue-soft) text-(--blue)"><CalendarDays size={20} /></span>
  }
  if (kind === 'departure') {
    return <span className="grid size-10 place-items-center rounded-[9px] bg-(--sage) text-(--forest-2)"><CarFront size={20} /></span>
  }
  return <ChoreOccurrenceIcon className="size-10 rounded-[9px]" status={occurrenceStatus} />
}

export function TodayPage() {
  const { data, busy, completeOccurrence } = useAppData()
  const currentMember = data.members.find((member) => member.id === data.household.currentMemberId)!
  const householdToday = dateKeyInTimeZone(new Date(), data.household.timezone)
  const [selectedDate, setSelectedDate] = useState(householdToday)
  const [rangeStart, setRangeStart] = useState(householdToday)
  const [compactDateRange, setCompactDateRange] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 640px)').matches),
  )
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const visibleDayCount = compactDateRange ? 3 : 7
  const visibleDays = Array.from({ length: visibleDayCount }, (_, index) => addDateKeyDays(rangeStart, index))
  const myBalance = data.balances.find((balance) => balance.memberId === currentMember.id)
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia('(max-width: 640px)')
    const updateRangeSize = () => setCompactDateRange(media.matches)
    updateRangeSize()
    media.addEventListener('change', updateRangeSize)
    return () => media.removeEventListener('change', updateRangeSize)
  }, [])

  const agenda = useMemo(() => {
    const items: AgendaItem[] = []

    if (data.household.enabledFeatures.includes('chores')) {
      for (const occurrence of data.occurrences) {
        items.push({
          id: `chore-${occurrence.id}`,
          kind: 'chore',
          dateKey: occurrence.scheduledDate,
          sortAt: new Date(occurrence.dueAt).getTime(),
          timeLabel: formatShortTime(occurrence.dueAt),
          title: occurrence.taskTitle,
          subtitle: occurrence.area,
          assigneeId: occurrence.assigneeId,
          occurrenceId: occurrence.id,
          occurrenceStatus: occurrence.status,
          dueAt: occurrence.dueAt,
          href: '/chores',
        })
      }
    }

    if (data.household.enabledFeatures.includes('calendar') || data.household.enabledFeatures.includes('courses')) {
      for (const event of data.events) {
        const eventDate = dateKeyInTimeZone(new Date(event.startAt), data.household.timezone)
        items.push({
          id: `event-${event.id}`,
          kind: 'event',
          dateKey: eventDate,
          sortAt: new Date(event.startAt).getTime(),
          timeLabel: event.allDay ? 'All day' : formatShortTime(event.startAt),
          title: event.title,
          subtitle: event.location ?? (event.kind === 'class' ? 'Class' : 'Household event'),
          assigneeId: event.audience === 'self' ? event.creatorId : undefined,
          href: '/calendar',
        })
      }
    }

    if (data.household.enabledFeatures.includes('money')) {
      for (const period of data.billPeriods) {
        const bill = data.bills.find((item) => item.id === period.billId)
        if (!bill || !bill.memberIds.includes(currentMember.id)) continue
        const periodDate = dateKeyInTimeZone(new Date(period.dueAt), data.household.timezone)
        items.push({
          id: `bill-${period.id}`,
          kind: 'bill',
          dateKey: periodDate,
          sortAt: new Date(period.dueAt).getTime(),
          timeLabel: 'All day',
          title: `${bill.name} due`,
          subtitle: period.paidMemberIds.includes(currentMember.id) ? 'Your payment is complete' : 'Your payment is due',
          amountCents: period.amountCents ?? bill.amountCents,
          paid: period.paidMemberIds.includes(currentMember.id),
          href: '/money',
        })
      }
    }

    if (data.household.enabledFeatures.includes('driveway')) {
      for (const departure of data.departures) {
        const vehicle = data.vehicles.find((item) => item.id === departure.vehicleId)
        const departureDate = dateKeyInTimeZone(new Date(departure.requiredAt), data.household.timezone)
        items.push({
          id: `departure-${departure.id}`,
          kind: 'departure',
          dateKey: departureDate,
          sortAt: new Date(departure.requiredAt).getTime(),
          timeLabel: formatShortTime(departure.requiredAt),
          title: vehicle ? `${vehicle.label} needs out` : 'Driveway departure',
          subtitle: departure.sourceLabel,
          href: '/driveway',
        })
      }
    }

    return items.sort((left, right) => left.sortAt - right.sortAt)
  }, [currentMember.id, data])

  const selectedAgenda = agenda.filter((item) => item.dateKey === selectedDate)
  const laterAgenda = agenda.filter((item) => item.dateKey > selectedDate && item.dateKey <= addDateKeyDays(selectedDate, 7)).slice(0, 4)
  const nextBill = agenda.find((item) => item.kind === 'bill' && item.dateKey >= householdToday && !item.paid)
  const nextDeparture = agenda.find((item) => item.kind === 'departure' && item.sortAt >= now.getTime())
  const selectedDateLabel = selectedDate === householdToday ? 'Today' : longDate.format(dateFromKey(selectedDate))

  const countsForDay = (dateKey: string) => ({
    chores: agenda.filter((item) => item.dateKey === dateKey && item.kind === 'chore').length,
    bills: agenda.filter((item) => item.dateKey === dateKey && item.kind === 'bill').length,
    events: agenda.filter((item) => item.dateKey === dateKey && (item.kind === 'event' || item.kind === 'departure')).length,
  })

  return (
    <div className="grid gap-5.5">
      {data.household.enabledFeatures.includes('notifications') && !data.notificationHealth.subscribed && (
        <Link to="/settings" className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[10px] border border-[#e3d0a1] border-l-[3px] border-l-(--gold) bg-[#f1e5c8] dark:bg-(--gold-soft) px-4 py-3 text-[.8rem] text-[#76561d] dark:text-(--gold)">
          <BellRing size={19} />
          <div><strong className="block">Don’t miss the last call</strong><span className="text-[#756a52]">Enable reminders for chore and driveway alerts.</span></div>
          <ChevronRight size={18} />
        </Link>
      )}

      <header className="flex items-center justify-between gap-6 max-[720px]:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="page-title">{greeting}, {currentMember.displayName}.</h1>
            <span className="font-sans text-[.8rem] font-semibold text-(--gold)">{longDate.format(dateFromKey(householdToday))}</span>
          </div>
          <p className="mt-1.5 text-[.86rem] text-(--muted)">Here’s what the house needs from you today.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggle />
          <div className="relative max-[560px]:hidden">
            <Button variant="secondary" onClick={() => setAddMenuOpen((open) => !open)}><Plus size={16} /> Add <ChevronDown size={14} /></Button>
            {addMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+7px)] z-20 grid w-44 rounded-[10px] border border-(--line-strong) bg-(--surface-strong) p-1.5 shadow-[0_12px_30px_rgba(20,35,28,.14)]">
                <Link className="rounded-[7px] px-3 py-2 text-[.78rem] font-semibold hover:bg-(--sage-2)" to="/chores">Add a chore</Link>
                <Link className="rounded-[7px] px-3 py-2 text-[.78rem] font-semibold hover:bg-(--sage-2)" to="/money">Add a purchase</Link>
                <Link className="rounded-[7px] px-3 py-2 text-[.78rem] font-semibold hover:bg-(--sage-2)" to="/calendar">Add an event</Link>
              </div>
            )}
          </div>
          <Link
            aria-label={`Open settings for ${currentMember.displayName}`}
            className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--green)"
            to="/settings"
          >
            <Avatar initials={currentMember.initials} color={currentMember.color} imageUrl={currentMember.avatarUrl} size="md" />
          </Link>
        </div>
      </header>

      <section className="min-w-0 rounded-2xl border border-(--line) bg-(--surface-strong) p-3 max-[420px]:p-2">
        <div className="grid min-w-0 grid-cols-[34px_minmax(0,1fr)_34px_150px] items-stretch rounded-2xl bg-(--surface) py-3 max-[880px]:grid-cols-[30px_minmax(0,1fr)_30px] max-[420px]:grid-cols-[24px_minmax(0,1fr)_24px]">
        <button className="grid place-items-center border-0 bg-transparent text-(--muted) hover:text-(--forest)" type="button" onClick={() => { const start = addDateKeyDays(rangeStart, -visibleDayCount); setRangeStart(start); setSelectedDate(start) }} aria-label="Previous dates"><ChevronLeft size={18} /></button>
        <div
          aria-label="Visible dates"
          className="grid min-w-0 gap-1.5"
          role="group"
          style={{ gridTemplateColumns: `repeat(${visibleDayCount}, minmax(0, 1fr))` }}
        >
          {visibleDays.map((dateKey) => {
            const date = dateFromKey(dateKey)
            const counts = countsForDay(dateKey)
            const selected = selectedDate === dateKey
            return (
              <button className={cn('grid min-w-0 gap-1 overflow-hidden rounded-2xl border px-2 py-3 transition-colors', selected ? 'border-(--green) bg-(--green-soft) text-(--ink)' : 'border-(--line) bg-(--surface-strong) text-(--ink) hover:bg-(--sage-2)')} type="button" key={dateKey} onClick={() => setSelectedDate(dateKey)}>
                <span className="font-sans text-[.67rem] font-bold uppercase">{shortWeekday.format(date)}</span>
                <strong className="font-sans text-[1.2rem] leading-none">{date.getUTCDate()}</strong>
                <span className="mt-1 flex min-w-0 justify-center gap-2.5 text-[.65rem] text-(--muted) max-[420px]:gap-1.5">
                  <span className="inline-flex items-center gap-1"><i className="size-1.75 rounded-full bg-(--green)" />{counts.chores}</span>
                  <span className="inline-flex items-center gap-1"><i className="size-1.75 rounded-full bg-(--gold)" />{counts.bills}</span>
                  <span className="inline-flex items-center gap-1"><i className="size-1.75 rounded-full bg-[#7c9096]" />{counts.events}</span>
                </span>
              </button>
            )
          })}
        </div>
        <button className="grid place-items-center border-0 bg-transparent text-(--muted) hover:text-(--forest)" type="button" onClick={() => { const start = addDateKeyDays(rangeStart, visibleDayCount); setRangeStart(start); setSelectedDate(start) }} aria-label="Next dates"><ChevronRight size={18} /></button>
        <div className="grid content-center gap-1.5 pl-5 text-[.67rem] text-(--muted) max-[880px]:hidden">
          <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-(--green)" />Chores</span>
          <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-(--gold)" />Bills</span>
          <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-[#7c9096]" />Events</span>
        </div>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_315px] items-start gap-7 max-[980px]:grid-cols-1">
        <main className="grid min-w-0 gap-3 rounded-2xl border border-(--line) bg-(--surface-strong) p-3">
          <EmailRecovery reminder />
          <section className="min-w-0 rounded-xl bg-(--surface) px-4 py-3">
          <div className="flex items-center justify-between border-b border-(--line) pb-2.5">
            <h2 className="text-[1.35rem]!">{selectedDateLabel}</h2>
            <Link className="inline-flex items-center gap-1.5 text-[.76rem] font-semibold" to="/chores">Today’s chores <ArrowRight size={14} /></Link>
          </div>

          <div className="relative">
            {selectedAgenda.map((item) => {
              const assignee = item.assigneeId ? data.members.find((member) => member.id === item.assigneeId) : undefined
              const isMyChore = item.kind === 'chore' && item.assigneeId === currentMember.id
              const availability = item.occurrenceId && item.dueAt ? taskCompletionAvailability(item.dateKey, item.dueAt, data.household.timezone) : null
              const completed = item.occurrenceStatus === 'completed'
              const canComplete = isMyChore && item.occurrenceStatus === 'assigned' && availability === 'available'
              return (
                <div className="relative grid min-h-15 grid-cols-[92px_48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-(--line) py-2.5 max-[620px]:grid-cols-[62px_42px_minmax(0,1fr)] max-[620px]:gap-2" key={item.id} data-agenda-item>
                  <span className="font-sans text-[.78rem] tabular-nums">{item.timeLabel}</span>
                  <AgendaIcon kind={item.kind} occurrenceStatus={item.occurrenceStatus} />
                  <div className="min-w-0"><h3 className="truncate text-[.84rem] font-bold">{item.title}</h3><span className="block truncate text-[.72rem] text-(--muted)">{item.subtitle}</span></div>
                  <div className="flex items-center gap-3 max-[620px]:col-[3] max-[620px]:justify-self-end">
                    {assignee && <Avatar initials={assignee.initials} color={assignee.color} imageUrl={assignee.avatarUrl} size="sm" />}
                    {item.amountCents != null && <strong className="font-sans text-[.78rem] text-(--gold) tabular-nums">{formatMoney(item.amountCents)}</strong>}
                    {isMyChore ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={completed}
                        aria-label={`${completed ? 'Completed' : 'Mark complete'}: ${item.title}`}
                        title={completed ? 'Completed' : canComplete ? 'Mark complete' : 'This chore can only be completed on its scheduled day before it expires.'}
                        disabled={!canComplete || busy === `complete:${item.occurrenceId}`}
                        onClick={() => void completeOccurrence(item.occurrenceId!).catch(() => { /* Shared handler displays the error. */ })}
                        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--green) disabled:cursor-default"
                      >
                        {completed
                          ? <CheckCircle2 className="text-[#6ca177] dark:text-(--green)" size={20} aria-hidden="true" />
                          : <Circle className={cn(canComplete ? 'text-(--muted) transition-colors hover:text-(--green)' : 'text-(--line-strong)')} size={20} aria-hidden="true" />}
                      </button>
                    ) : item.kind === 'bill' && !item.paid ? (
                      <Link className="text-[.72rem] font-semibold text-(--gold)" to="/money">Due today</Link>
                    ) : item.occurrenceStatus === 'completed' || item.paid ? <Badge tone="green">Done</Badge> : <span className="font-sans text-[.75rem] tabular-nums">{item.timeLabel}</span>}
                  </div>
                </div>
              )
            })}
            {!selectedAgenda.length && <div className="flex min-h-28 items-center justify-center border-b border-(--line) text-[.8rem] text-(--muted)">Nothing scheduled for this day.</div>}
          </div>
          </section>

          <section className="min-w-0 rounded-xl bg-(--surface) px-4 py-3">
          <div className="flex items-center justify-between border-b border-(--line) pb-2">
            <h2 className="text-[1rem]!">Later this week</h2>
            <Link className="inline-flex items-center gap-1.5 text-[.74rem] font-semibold" to="/calendar">This week <ArrowRight size={14} /></Link>
          </div>
          <div>
            {laterAgenda.map((item) => {
              const assignee = item.assigneeId ? data.members.find((member) => member.id === item.assigneeId) : undefined
              return (
                <Link className="grid min-h-14 grid-cols-[128px_82px_42px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-b border-(--line) px-2 py-2 hover:bg-(--sage-2) max-[620px]:grid-cols-[92px_42px_1fr_auto]" to={item.href} key={`later-${item.id}`}>
                  <span className="text-[.72rem] text-(--muted)">{shortDate.format(dateFromKey(item.dateKey))}</span>
                  <span className="font-sans text-[.72rem] text-(--muted) tabular-nums max-[620px]:hidden">{item.timeLabel}</span>
                  <AgendaIcon kind={item.kind} occurrenceStatus={item.occurrenceStatus} />
                  <div className="min-w-0"><strong className="block truncate text-[.8rem]">{item.title}</strong><span className="block truncate text-[.7rem] text-(--muted)">{item.subtitle}</span></div>
                  <div className="flex items-center gap-3">{item.amountCents != null && <strong className="font-sans text-[.76rem] text-(--gold)">{formatMoney(item.amountCents)}</strong>}{assignee && <Avatar initials={assignee.initials} color={assignee.color} imageUrl={assignee.avatarUrl} size="sm" />}<ChevronRight size={15} /></div>
                </Link>
              )
            })}
            {!laterAgenda.length && <p className="py-6 text-center text-[.78rem] text-(--muted)">The rest of the week is clear.</p>}
          </div>
          <Link className="mx-auto mt-3 flex w-fit items-center gap-2 text-[.76rem] font-semibold text-(--forest-2)" to="/calendar">View full calendar <ArrowRight size={14} /></Link>
          </section>
        </main>

        <aside className="grid gap-4 border-l border-(--line) pl-7 max-[980px]:grid-cols-2 max-[980px]:border-l-0 max-[980px]:border-t max-[980px]:pt-6 max-[980px]:pl-0 max-[620px]:grid-cols-1">
          <h2 className="text-[1rem]! max-[980px]:col-span-full">At a glance</h2>
          {data.household.enabledFeatures.includes('money') && (
            <div className="grid min-w-0 gap-3 rounded-2xl border border-(--line) bg-(--surface-strong) p-3">
              {myBalance && (
                <section className="flex min-w-0 flex-col rounded-2xl bg-(--surface) px-5 py-6">
                  <h3 className="text-[.75rem]! font-semibold! tracking-wide text-(--muted) uppercase">Shared money</h3>
                  <strong className={cn('mt-6 break-words font-sans text-[clamp(1.75rem,3vw,2.75rem)] font-medium leading-tight tracking-tight tabular-nums', myBalance.netCents < 0 ? 'text-(--coral)' : 'text-(--green)')}>{formatMoney(myBalance.netCents, true)}</strong>
                  <span className="mt-7 text-[.72rem] font-semibold tracking-wide text-(--muted) uppercase">Your house balance</span>
                  <span className="mt-2 text-[.9rem] text-(--muted)">{myBalance.netCents < 0 ? 'You owe the house' : 'The house owes you'}</span>
                  <Link className="mt-6 w-fit rounded text-[.9rem] font-medium text-(--forest-2) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4" to="/money">Open shared money</Link>
                </section>
              )}
              <section className="min-w-0 rounded-2xl bg-(--surface) px-5 py-6">
                <h3 className="text-[.75rem]! font-semibold! tracking-wide text-(--muted) uppercase">Next bill due</h3>
                {nextBill ? (
                  <>
                    <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="min-w-0 break-words text-[1.05rem] font-semibold">{nextBill.title.replace(/ due$/, '')}</span>
                      <strong className="font-sans text-[1.15rem] font-medium text-(--gold) tabular-nums">{nextBill.amountCents != null ? formatMoney(nextBill.amountCents) : 'Variable'}</strong>
                    </div>
                    <p className="mt-2 text-[.85rem] text-(--muted)">{nextBill.dateKey === householdToday ? 'Due today' : `Due ${shortDate.format(dateFromKey(nextBill.dateKey))}`}</p>
                  </>
                ) : <p className="mt-5 text-[.85rem] text-(--muted)">No upcoming unpaid bills.</p>}
              </section>
            </div>
          )}

          <section className="rounded-[10px] border border-(--line-strong) bg-(--surface-strong) p-5">
            <strong className="text-[.78rem]">Household</strong>
            <div className="mt-3 grid gap-3">
              {data.members.slice(0, 4).map((member) => (
                <div className="flex items-center gap-2" key={member.id}><Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" /><span className="text-[.74rem]">{member.displayName}{member.id === currentMember.id ? ' (you)' : ''}</span><span className="ml-auto text-[.68rem] text-(--green)">Member</span></div>
              ))}
            </div>
          </section>

          {nextDeparture && (
            <Link className="rounded-[10px] border border-(--line-strong) bg-(--surface-strong) p-5" to="/driveway">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[8px] bg-(--blue-soft) text-(--blue)"><CarFront size={18} /></span><strong className="text-[.78rem]">Next departure</strong></div>
              <span className="mt-3 block text-[.74rem]">{nextDeparture.title}</span><span className="mt-1 inline-flex items-center gap-1.5 text-[.7rem] text-(--muted)"><Clock3 size={13} />{timeUntil(new Date(nextDeparture.sortAt).toISOString())}</span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  )
}
