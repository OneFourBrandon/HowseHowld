import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarDays,
  CalendarPlus,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDollarSign,
  Clock3,
  ListTodo,
  Plus,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
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
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  FeatureCard,
  Inner,
  Progress,
  Stat,
  Tile,
} from '../components/ui'
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

const daysBetweenKeys = (from: string, to: string) =>
  Math.round((dateFromKey(to).getTime() - dateFromKey(from).getTime()) / 86_400_000)

const shortWeekday = new Intl.DateTimeFormat('en-CA', { weekday: 'short', timeZone: 'UTC' })
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
  size = 40,
}: {
  kind: AgendaKind
  occurrenceStatus?: 'assigned' | 'completed' | 'missed'
  size?: number
}) {
  if (kind === 'bill') return <Tile icon={CircleDollarSign} tone="amber" size={size} />
  if (kind === 'event') return <Tile icon={CalendarDays} tone="violet" size={size} />
  if (kind === 'departure') return <Tile icon={CarFront} tone="pink" size={size} />
  return <ChoreOccurrenceIcon status={occurrenceStatus} size={size} />
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
  const addMenuRef = useRef<HTMLDivElement>(null)
  const visibleDayCount = compactDateRange ? 3 : 7
  const visibleDays = Array.from({ length: visibleDayCount }, (_, index) =>
    addDateKeyDays(rangeStart, index),
  )
  const myBalance = data.balances.find((balance) => balance.memberId === currentMember.id)
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const moneyOn = data.household.enabledFeatures.includes('money')
  const choresOn = data.household.enabledFeatures.includes('chores')

  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia('(max-width: 640px)')
    const updateRangeSize = () => setCompactDateRange(media.matches)
    updateRangeSize()
    media.addEventListener('change', updateRangeSize)
    return () => media.removeEventListener('change', updateRangeSize)
  }, [])

  useEffect(() => {
    if (!addMenuOpen) return
    const close = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) setAddMenuOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [addMenuOpen])

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
  const laterAgenda = agenda
    .filter((item) => item.dateKey > selectedDate && item.dateKey <= addDateKeyDays(selectedDate, 7))
    .slice(0, 4)
  const nextBill = agenda.find((item) => item.kind === 'bill' && item.dateKey >= householdToday && !item.paid)
  const nextDeparture = agenda.find((item) => item.kind === 'departure' && item.sortAt >= now.getTime())
  const selectedDateLabel = selectedDate === householdToday ? 'Today' : longDate.format(dateFromKey(selectedDate))

  const countsForDay = (dateKey: string) => ({
    chores: agenda.filter((item) => item.dateKey === dateKey && item.kind === 'chore').length,
    bills: agenda.filter((item) => item.dateKey === dateKey && item.kind === 'bill').length,
    events: agenda.filter(
      (item) => item.dateKey === dateKey && (item.kind === 'event' || item.kind === 'departure'),
    ).length,
  })

  const todayChores = agenda.filter((item) => item.dateKey === householdToday && item.kind === 'chore')
  const todayChoresDone = todayChores.filter((item) => item.occurrenceStatus === 'completed').length
  const myPeriods = data.billPeriods.filter((period) => {
    const bill = data.bills.find((item) => item.id === period.billId)
    return Boolean(bill?.memberIds.includes(currentMember.id))
  })
  const myPeriodsPaid = myPeriods.filter((period) =>
    period.paidMemberIds.includes(currentMember.id),
  ).length
  const paidCents = myBalance?.contributionCents ?? 0
  const usedCents = myBalance?.resourceUseCents ?? 0
  const sharePercent = paidCents + usedCents > 0
    ? Math.round((paidCents / (paidCents + usedCents)) * 100)
    : 0
  const daysToBill = nextBill ? daysBetweenKeys(householdToday, nextBill.dateKey) : null
  const netCents = myBalance?.netCents ?? 0

  const selectedCounts = countsForDay(selectedDate)

  const quickActions = [
    choresOn && { to: '/chores', label: 'Add a chore', icon: ListTodo },
    moneyOn && { to: '/money', label: 'Add a purchase', icon: ShoppingCart },
    data.household.enabledFeatures.includes('calendar') && {
      to: '/calendar',
      label: 'Add an event',
      icon: CalendarPlus,
    },
    data.household.enabledFeatures.includes('driveway') && {
      to: '/driveway',
      label: 'Schedule an exit',
      icon: CarFront,
    },
  ].filter(Boolean) as Array<{ to: string; label: string; icon: typeof ListTodo }>

  return (
    <>
      {data.household.enabledFeatures.includes('notifications') && !data.notificationHealth.subscribed && (
        <Link
          to="/settings"
          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[rgba(255,180,84,.25)] bg-(--amber-soft) px-4 py-3 text-[.82rem] text-(--amber) transition-colors hover:bg-[rgba(255,180,84,.22)]"
        >
          <BellRing size={18} />
          <span className="grid">
            <strong>Don’t miss the last call</strong>
            <span className="text-[.78rem] text-(--text-3)">
              Enable reminders for chore and driveway alerts.
            </span>
          </span>
          <ChevronRight size={17} />
        </Link>
      )}

      <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-10 px-1 pt-2 max-[1180px]:grid-cols-1 max-[1180px]:gap-6">
        <div className="grid gap-6">
          <div className="grid gap-1.5">
            <h1 className="text-[2.5rem] max-[640px]:text-[1.9rem]">
              {greeting}, <span className="text-(--text-3)">{currentMember.displayName}</span>
            </h1>
            <p className="text-[.88rem] text-(--text-3)">
              {longDate.format(dateFromKey(householdToday))} · Here’s what the house needs from you today.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {choresOn && (
              <Progress
                className="w-33"
                label="Chores today"
                tone="pink"
                value={todayChores.length ? (todayChoresDone / todayChores.length) * 100 : 100}
              />
            )}
            {moneyOn && myPeriods.length > 0 && (
              <Progress
                className="w-36"
                label="Bills paid"
                tone="white"
                value={(myPeriodsPaid / myPeriods.length) * 100}
              />
            )}
            {moneyOn && (
              <Progress className="w-36" label="Your share paid" tone="hatched" value={sharePercent} />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-11 pb-0.5 max-[1180px]:gap-8">
          {choresOn && (
            <Stat
              value={todayChores.length}
              label="Chores today"
              icon={Check}
              tone="green"
              delta={todayChores.length ? `${todayChoresDone} done` : undefined}
            />
          )}
          {moneyOn && (
            <Stat
              value={daysToBill == null ? '—' : daysToBill}
              label={nextBill ? `Days to ${nextBill.title.replace(/ due$/, '').toLowerCase()}` : 'No bill due'}
              icon={CalendarDays}
              tone="pink"
              delta={nextBill ? shortWeekday.format(dateFromKey(nextBill.dateKey)) : undefined}
            />
          )}
          {moneyOn && myBalance && (
            <Stat
              value={formatMoney(netCents, true)}
              label={netCents < 0 ? 'You owe the house' : 'The house owes you'}
              icon={netCents < 0 ? TrendingDown : TrendingUp}
              tone={netCents < 0 ? 'red' : 'blue'}
            />
          )}
        </div>
      </section>

      <section className="grid grid-cols-[280px_minmax(0,1fr)_300px] items-stretch gap-5 max-[1240px]:grid-cols-[260px_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <Card className="grid grid-rows-[auto_1fr] pb-4">
          <CardHead title="Summary" />
          <div className="grid content-start gap-2 px-4">
            <SummaryRow color="var(--pink)" label="Chores" count={selectedCounts.chores} />
            <SummaryRow color="var(--amber)" label="Bills" count={selectedCounts.bills} />
            <SummaryRow color="var(--blue)" label="Events" count={selectedCounts.events} />
            <p className="mt-2 px-1 text-[.76rem] leading-relaxed text-(--text-3)">
              {selectedAgenda.length
                ? `${selectedAgenda.length} thing${selectedAgenda.length === 1 ? '' : 's'} on ${selectedDateLabel.toLowerCase()}.`
                : 'Nothing scheduled for this day.'}
            </p>
          </div>
        </Card>

        <Card className="grid grid-rows-[auto_auto_1fr] pb-4">
          <CardHead
            title={selectedDateLabel}
            description={`${selectedAgenda.length} scheduled`}
            action={
              <div className="relative" ref={addMenuRef}>
                <Button variant="secondary" size="sm" onClick={() => setAddMenuOpen((open) => !open)}>
                  <Plus size={15} /> Add <ChevronDown size={13} />
                </Button>
                {addMenuOpen && (
                  <div className="hh-anim-pop hh-card absolute top-[calc(100%+8px)] right-0 z-20 grid w-48 gap-0.5 rounded-2xl p-1.5">
                    {quickActions.map((action) => (
                      <Link
                        key={action.to}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[.8rem] font-semibold hover:bg-[rgba(255,255,255,.06)]"
                        to={action.to}
                        onClick={() => setAddMenuOpen(false)}
                      >
                        <action.icon size={15} className="text-(--text-3)" />
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            }
          />

          <div className="flex items-center gap-2 px-4 pb-3">
            <button
              type="button"
              aria-label="Previous dates"
              className="hh-btn hh-btn-icon size-8 shrink-0"
              onClick={() => {
                const start = addDateKeyDays(rangeStart, -visibleDayCount)
                setRangeStart(start)
                setSelectedDate(start)
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <div
              aria-label="Visible dates"
              role="group"
              className="grid min-w-0 flex-1 gap-1.5"
              style={{ gridTemplateColumns: `repeat(${visibleDayCount}, minmax(0, 1fr))` }}
            >
              {visibleDays.map((dateKey) => {
                const date = dateFromKey(dateKey)
                const counts = countsForDay(dateKey)
                const selected = selectedDate === dateKey
                const isToday = dateKey === householdToday
                return (
                  <button
                    type="button"
                    key={dateKey}
                    onClick={() => setSelectedDate(dateKey)}
                    aria-pressed={selected}
                    className={cn(
                      'relative grid min-w-0 justify-items-center gap-1 rounded-2xl border px-1 py-2 transition-colors duration-150',
                      selected
                        ? 'border-transparent bg-(--text) text-(--bg)'
                        : 'border-(--line) bg-(--inner) text-(--text) hover:border-(--line-2)',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[.62rem] font-bold tracking-[.06em] uppercase',
                        selected ? 'text-[rgba(11,12,15,.6)]' : 'text-(--text-3)',
                      )}
                    >
                      {shortWeekday.format(date)}
                    </span>
                    <strong className="font-display text-[1.2rem] leading-none font-extrabold">
                      {date.getUTCDate()}
                    </strong>
                    <span
                      className={cn(
                        'flex min-w-0 gap-1.5 text-[.6rem] font-semibold',
                        selected ? 'text-[rgba(11,12,15,.65)]' : 'text-(--text-3)',
                      )}
                    >
                      <span className="inline-flex items-center gap-0.75">
                        <i className="size-1.25 rounded-full bg-(--pink)" />
                        {counts.chores}
                      </span>
                      <span className="inline-flex items-center gap-0.75">
                        <i className="size-1.25 rounded-full bg-(--amber)" />
                        {counts.bills}
                      </span>
                      <span className="inline-flex items-center gap-0.75">
                        <i className="size-1.25 rounded-full bg-(--blue)" />
                        {counts.events}
                      </span>
                    </span>
                    {isToday && !selected && (
                      <i className="absolute top-1.5 right-1.5 size-1.25 rounded-full bg-(--text)" />
                    )}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              aria-label="Next dates"
              className="hh-btn hh-btn-icon size-8 shrink-0"
              onClick={() => {
                const start = addDateKeyDays(rangeStart, visibleDayCount)
                setRangeStart(start)
                setSelectedDate(start)
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid content-start gap-2 px-4">
            {selectedAgenda.map((item) => {
              const assignee = item.assigneeId
                ? data.members.find((member) => member.id === item.assigneeId)
                : undefined
              const isMyChore = item.kind === 'chore' && item.assigneeId === currentMember.id
              const availability = item.occurrenceId && item.dueAt
                ? taskCompletionAvailability(item.dateKey, item.dueAt, data.household.timezone)
                : null
              const done = item.occurrenceStatus === 'completed' || item.paid
              return (
                <Inner
                  key={item.id}
                  data-agenda-item
                  className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 max-[620px]:grid-cols-[auto_minmax(0,1fr)_auto]"
                >
                  <span className="grid size-4.5 place-items-center max-[620px]:hidden">
                    {done ? (
                      <CheckCircle2 size={18} className="text-(--green)" />
                    ) : (
                      <Circle size={17} className="text-(--text-4)" />
                    )}
                  </span>
                  <AgendaIcon kind={item.kind} occurrenceStatus={item.occurrenceStatus} size={36} />
                  <span className="grid min-w-0">
                    <h3 className="truncate text-[.86rem] font-bold">{item.title}</h3>
                    <span className="truncate text-[.74rem] text-(--text-3)">
                      {item.timeLabel} · {item.subtitle}
                    </span>
                  </span>
                  <span className="flex items-center gap-2.5">
                    {item.amountCents != null && (
                      <strong className="text-[.82rem] font-bold text-(--amber) tabular-nums">
                        {formatMoney(item.amountCents)}
                      </strong>
                    )}
                    {assignee && (
                      <Avatar
                        initials={assignee.initials}
                        color={assignee.color}
                        imageUrl={assignee.avatarUrl}
                        size="sm"
                      />
                    )}
                    {isMyChore && item.occurrenceStatus === 'assigned' && availability === 'available' ? (
                      <Button
                        size="sm"
                        aria-label={`Mark complete: ${item.title}`}
                        disabled={busy === `complete:${item.occurrenceId}`}
                        onClick={() => void completeOccurrence(item.occurrenceId!)}
                      >
                        <Check size={14} /> Done
                      </Button>
                    ) : item.kind === 'bill' && !item.paid ? (
                      <Link className="text-[.74rem] font-bold text-(--amber)" to="/money">
                        Pay
                      </Link>
                    ) : done ? (
                      <Badge tone="green">Done</Badge>
                    ) : null}
                  </span>
                </Inner>
              )
            })}
            {!selectedAgenda.length && (
              <EmptyState
                icon={CalendarPlus}
                title="Nothing scheduled"
                description="This day is clear. Add a chore or an event to fill it."
              />
            )}
          </div>
        </Card>

        <div className="grid content-start gap-5 max-[1240px]:col-span-full max-[1240px]:grid-cols-2 max-[640px]:grid-cols-1">
          {moneyOn && myBalance && (
            <FeatureCard className="grid content-between gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[.72rem] font-semibold tracking-[.06em] text-[rgba(255,255,255,.75)] uppercase">
                  Your house balance
                </span>
                <Link
                  to="/money"
                  aria-label="Open shared money"
                  className="grid size-8.5 shrink-0 place-items-center rounded-full bg-[rgba(255,255,255,.18)] text-white transition-colors hover:bg-[rgba(255,255,255,.28)]"
                >
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="grid gap-1">
                <strong className="font-display text-[2.6rem] leading-none font-extrabold tracking-[-.03em]">
                  {formatMoney(netCents, true)}
                </strong>
                <span className="text-[.8rem] font-semibold text-[rgba(255,255,255,.85)]">
                  {netCents < 0 ? 'You owe the house' : netCents > 0 ? 'The house owes you' : 'You’re all settled up'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-0.5 rounded-xl bg-white px-3.5 py-2.5 text-(--bg)">
                  <span className="text-[.68rem] font-semibold text-(--text-3)">Paid</span>
                  <span className="text-[.95rem] font-extrabold tabular-nums">{formatMoney(paidCents)}</span>
                </div>
                <div className="grid gap-0.5 rounded-xl border border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.16)] px-3.5 py-2.5">
                  <span className="text-[.68rem] font-semibold text-[rgba(255,255,255,.75)]">Used</span>
                  <span className="text-[.95rem] font-extrabold tabular-nums">{formatMoney(usedCents)}</span>
                </div>
              </div>
            </FeatureCard>
          )}

          {moneyOn && (
            <Card className="grid content-start gap-3 p-5">
              <div className="flex items-center gap-3">
                <Tile icon={CircleDollarSign} tone="amber" size={34} radius={10} />
                <strong className="text-[.88rem]">Next bill due</strong>
              </div>
              {nextBill ? (
                <div className="grid gap-1">
                  <span className="text-[.82rem]">{nextBill.title.replace(/ due$/, '')}</span>
                  <strong className="text-[1.3rem] font-extrabold text-(--amber) tabular-nums">
                    {nextBill.amountCents != null ? formatMoney(nextBill.amountCents) : 'Variable'}
                  </strong>
                  <span className="inline-flex items-center gap-1.5 text-[.75rem] text-(--text-3)">
                    <CalendarDays size={13} />
                    {nextBill.dateKey === householdToday
                      ? 'Due today'
                      : `Due ${shortDate.format(dateFromKey(nextBill.dateKey))}`}
                  </span>
                </div>
              ) : (
                <span className="text-[.8rem] text-(--text-3)">No upcoming unpaid bills.</span>
              )}
            </Card>
          )}

          {nextDeparture && (
            <Link to="/driveway" className="hh-card grid content-start gap-3 p-5">
              <div className="flex items-center gap-3">
                <Tile icon={CarFront} tone="pink" size={34} radius={10} />
                <strong className="text-[.88rem]">Next departure</strong>
              </div>
              <div className="grid gap-1">
                <span className="text-[.82rem]">{nextDeparture.title}</span>
                <span className="inline-flex items-center gap-1.5 text-[.75rem] text-(--text-3)">
                  <Clock3 size={13} />
                  {timeUntil(new Date(nextDeparture.sortAt).toISOString())}
                </span>
              </div>
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-[minmax(0,1.35fr)_300px_minmax(0,1fr)] items-stretch gap-5 max-[1240px]:grid-cols-[minmax(0,1fr)_300px] max-[900px]:grid-cols-1">
        <Card className="grid grid-rows-[auto_1fr_auto] pb-4">
          <CardHead
            title="Later this week"
            action={
              <Link className="hh-btn hh-btn-ghost hh-btn-sm h-8 px-3" to="/calendar">
                Calendar <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="grid content-start gap-2 px-4">
            {laterAgenda.map((item) => {
              const assignee = item.assigneeId
                ? data.members.find((member) => member.id === item.assigneeId)
                : undefined
              return (
                <Link
                  to={item.href}
                  key={`later-${item.id}`}
                  className="hh-inner grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition-colors hover:border-(--line-2)"
                >
                  <AgendaIcon kind={item.kind} occurrenceStatus={item.occurrenceStatus} size={34} />
                  <span className="grid min-w-0">
                    <span className="truncate text-[.84rem] font-bold">{item.title}</span>
                    <span className="truncate text-[.73rem] text-(--text-3)">
                      {shortDate.format(dateFromKey(item.dateKey))} · {item.timeLabel} · {item.subtitle}
                    </span>
                  </span>
                  <span className="flex items-center gap-2.5">
                    {item.amountCents != null && (
                      <strong className="text-[.8rem] font-bold text-(--amber) tabular-nums">
                        {formatMoney(item.amountCents)}
                      </strong>
                    )}
                    {assignee && (
                      <Avatar
                        initials={assignee.initials}
                        color={assignee.color}
                        imageUrl={assignee.avatarUrl}
                        size="sm"
                      />
                    )}
                    <ChevronRight size={15} className="text-(--text-4)" />
                  </span>
                </Link>
              )
            })}
            {!laterAgenda.length && (
              <EmptyState title="The rest of the week is clear." className="min-h-24" />
            )}
          </div>
        </Card>

        <Card className="grid grid-rows-[auto_1fr] pb-4">
          <CardHead title="Household" description={`${data.members.length} members`} />
          <div className="grid content-start gap-2 px-4">
            {data.members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-1 py-1.5">
                <Avatar
                  initials={member.initials}
                  color={member.color}
                  imageUrl={member.avatarUrl}
                  size="md"
                />
                <span className="grid min-w-0">
                  <span className="truncate text-[.84rem] font-bold">
                    {member.displayName}
                    {member.id === currentMember.id && (
                      <span className="font-medium text-(--text-3)"> (you)</span>
                    )}
                  </span>
                  <span className="truncate text-[.72rem] text-(--text-3)">
                    {member.role === 'owner' ? 'Howse admin' : 'Member'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="grid content-between gap-5 p-5">
          <div className="grid gap-1">
            <span className="text-[.88rem] font-bold">Hi, {currentMember.displayName} 👋</span>
            <h2 className="text-[1.3rem]">What needs doing?</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="hh-inner flex items-center gap-2.5 px-3.5 py-3 text-[.82rem] font-bold transition-colors hover:border-(--line-2)"
              >
                <Tile icon={action.icon} tone="neutral" size={30} radius={9} />
                {action.label}
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </>
  )
}

function SummaryRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="hh-inner flex items-center gap-2.5 py-2.5 pr-3 pl-3.5">
      <span className="size-2 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-[.84rem] font-bold">{label}</span>
      <span className="hh-pill h-6.5 bg-(--raise) px-2.5 text-[.76rem]">{count}</span>
    </div>
  )
}
