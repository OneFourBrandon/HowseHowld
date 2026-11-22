import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmailRecovery } from '../components/EmailRecovery'
import { addDateKeyDays, graceMinutesOf } from '../lib/chores'
import { cn } from '../lib/cn'
import { blockingVehicles, slotsFor } from '../lib/driveway'
import {
  type AgendaKind,
  buildAgenda,
  choreCounts,
  dateFromKey,
  dayLoad,
  daysBetween,
  memberStats,
  onTimeRate,
  weekRange,
} from '../lib/insights'
import { formatMoney, formatShortTime, taskCompletionAvailability, timeUntil } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import { AgendaRow } from './AgendaRow'
import { AttentionRow } from './Attention'
import { DrivewayMini, LoadChart } from './charts'
import { Bar, Chip, Empty, Face, Meter, Panel, Segmented, Stat, Stats } from './ui'
import { useHouse } from './useHouse'

const longDay = new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
const shortDay = new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const weekday = new Intl.DateTimeFormat('en-CA', { weekday: 'long', timeZone: 'UTC' })
const shortWeekday = new Intl.DateTimeFormat('en-CA', { weekday: 'short', timeZone: 'UTC' })

function dayTitle(dateKey: string, today: string) {
  const offset = daysBetween(today, dateKey)
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'
  if (offset === -1) return 'Yesterday'
  return weekday.format(dateFromKey(dateKey))
}

const percent = (value: number | null) => (value === null ? 'No record' : `${Math.round(value * 100)}%`)

export function OverviewPage() {
  const { data, busy, completeOccurrence } = useAppData()
  const { now, today, me, balances, attention, actionCount } = useHouse()
  const [scope, setScope] = useState<'house' | 'mine'>('house')
  const [selected, setSelected] = useState(today)
  const [tracked, setTracked] = useState(today)
  // At midnight, follow the new day if the old today was showing.
  if (tracked !== today) {
    setTracked(today)
    if (selected === tracked) setSelected(today)
  }

  const features = data.household.enabledFeatures
  const hasChores = features.includes('chores')
  const hasMoney = features.includes('money')
  const hasDriveway = features.includes('driveway')
  const hasCalendar = features.includes('calendar') || features.includes('courses')
  const graceMinutes = graceMinutesOf(data.household)
  const memberById = (id?: string) => data.members.find(member => member.id === id)

  const agenda = useMemo(() => buildAgenda(data, now), [data, now])
  const scoped = useMemo(() => (scope === 'mine' ? agenda.filter(entry => entry.mine) : agenda), [agenda, scope])
  const load = useMemo(() => dayLoad(scoped, today, 13, 14), [scoped, today])
  const dayEntries = scoped.filter(entry => entry.dateKey === selected)
  const afterThat = scoped
    .filter(entry => entry.dateKey > selected && entry.dateKey <= addDateKeyDays(selected, 7) && entry.state !== 'done')
    .slice(0, 4)

  const weekEnd = addDateKeyDays(today, 6)
  const ahead = scoped.filter(entry => entry.dateKey >= today && entry.dateKey <= weekEnd)
  const aheadCount = (...kinds: AgendaKind[]) =>
    ahead.filter(entry => kinds.includes(entry.kind) && entry.state !== 'done' && entry.state !== 'missed').length

  const week = weekRange(today)
  const scopeMember = scope === 'mine' ? me.id : undefined
  const thisWeek = choreCounts(data, week.start, week.end, now, scopeMember)
  const lastWeek = choreCounts(data, addDateKeyDays(week.start, -7), addDateKeyDays(week.end, -7), now, scopeMember)
  const month = choreCounts(data, addDateKeyDays(today, -29), today, now, scopeMember)
  const share = (count: number) => (thisWeek.total ? count / thisWeek.total : 0)
  const versusLastWeek = (current: number, previous: number) => {
    if (!lastWeek.total) return undefined
    const change = current - previous
    return change === 0 ? 'same as last week' : `${change > 0 ? '+' : '−'}${Math.abs(change)} vs last week`
  }

  const stats = useMemo(() => memberStats(data, now, balances), [balances, data, now])
  const myBalance = balances.get(me.id) ?? 0
  const nextBill = agenda.find(entry => entry.kind === 'bill' && entry.mine && entry.state === 'ahead')

  const slots = slotsFor(data)
  const nextExit = [...data.departures]
    .filter(departure => new Date(departure.requiredAt).getTime() >= now)
    .sort((left, right) => left.requiredAt.localeCompare(right.requiredAt))[0]
  const exitVehicle = data.vehicles.find(vehicle => vehicle.id === nextExit?.vehicleId)
  const exitBlockers = nextExit ? blockingVehicles(slots, nextExit.vehicleId) : []

  const hour = new Date(now).getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const showSide = hasMoney || hasDriveway

  return (
    <>
      <div className="sl-toolbar">
        <p className="min-w-0 text-(--sl-ink-2)">
          <span className="font-[560] text-(--sl-ink)">{greeting}, {me.displayName}.</span>{' '}
          {actionCount === 0
            ? 'Nothing in the house is waiting on you.'
            : `${actionCount} ${actionCount === 1 ? 'thing is' : 'things are'} waiting on you.`}
        </p>
        <Segmented
          label="Whose days to show"
          value={scope}
          onChange={setScope}
          options={[{ value: 'house', label: 'Whole house' }, { value: 'mine', label: 'Just mine' }]}
        />
      </div>

      <div className="sl-grid">
        <Panel
          className="col-span-12 lg:col-span-5"
          flush
          title="Needs you"
          note={attention.length ? 'Most urgent first' : undefined}
          tools={actionCount > 0 ? <Chip tone="brass">{actionCount} to do</Chip> : undefined}
        >
          {/* Prompts a device-only account to add a recovery email. Renders nothing once that is done. */}
          <div className="sl-embed sl-embed-inline"><EmailRecovery reminder /></div>
          <div className="sl-rows mt-3 border-t border-(--sl-line)">
            {attention.map(item => <AttentionRow key={item.id} item={item} />)}
          </div>
          {!attention.length && (
            <Empty icon={<Check size={16} />} title="You are all clear">
              Chores, votes and payments that need you show up here.
            </Empty>
          )}
        </Panel>

        <Panel
          className="col-span-12 lg:col-span-7"
          flush
          title={dayTitle(selected, today)}
          note={longDay.format(dateFromKey(selected))}
          tools={(
            <>
              {selected !== today && (
                <button type="button" className="sl-btn sl-btn-sm" onClick={() => setSelected(today)}>Back to today</button>
              )}
              <button type="button" className="sl-icon-btn" aria-label="Previous day" onClick={() => setSelected(addDateKeyDays(selected, -1))}>
                <ChevronLeft size={17} />
              </button>
              <button type="button" className="sl-icon-btn" aria-label="Next day" onClick={() => setSelected(addDateKeyDays(selected, 1))}>
                <ChevronRight size={17} />
              </button>
            </>
          )}
        >
          <div className="sl-rows mt-3 border-t border-(--sl-line)">
            {dayEntries.map(entry => (
              <AgendaRow
                key={entry.id}
                entry={entry}
                person={memberById(entry.memberId)}
                action={(() => {
                  const occurrence = entry.occurrence
                  if (!occurrence || !entry.mine || occurrence.status !== 'assigned') return undefined
                  const availability = taskCompletionAvailability(
                    occurrence.scheduledDate, occurrence.dueAt, data.household.timezone, new Date(now), graceMinutes,
                  )
                  const available = availability === 'available'
                  return (
                    <button
                      type="button"
                      className="sl-btn sl-btn-secondary sl-btn-sm"
                      disabled={!available || busy === `complete:${occurrence.id}`}
                      title={available ? undefined
                        : availability === 'expired' ? 'The time to finish this chore has passed'
                          : 'You can mark this done on its scheduled day'}
                      aria-label={`Mark done: ${entry.title}`}
                      onClick={() => void completeOccurrence(occurrence.id).catch(() => {})}
                    >
                      <Check size={14} /> Done
                    </button>
                  )
                })()}
              />
            ))}
          </div>
          {!dayEntries.length && (
            <Empty title={scope === 'mine' ? 'Nothing of yours on this day' : 'Nothing on this day'}>
              Pick another day on the chart below, or add something with New.
            </Empty>
          )}
          {afterThat.length > 0 && (
            <>
              <h3 className="sl-subhead">After that</h3>
              <div className="sl-rows">
                {afterThat.map(entry => (
                  <AgendaRow
                    key={`after-${entry.id}`}
                    entry={entry}
                    person={memberById(entry.memberId)}
                    when={`${shortWeekday.format(dateFromKey(entry.dateKey))} ${dateFromKey(entry.dateKey).getUTCDate()}`}
                    onPick={() => setSelected(entry.dateKey)}
                  />
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel
          className={cn('col-span-12', hasChores && 'lg:col-span-8')}
          title="Four weeks around today"
          note="One block for each thing on a day. Pick a day to see it above."
        >
          <Stats cols={[hasChores, hasMoney, hasCalendar, hasDriveway].filter(Boolean).length} colsSm={2} className="mb-5">
            {hasChores && <Stat tone="moss" label="Chores, next 7 days" value={aheadCount('chore')} />}
            {hasMoney && <Stat tone="brass" label="Bills due" value={aheadCount('bill')} />}
            {hasCalendar && <Stat tone="steel" label="Events and classes" value={aheadCount('event', 'class', 'exam')} />}
            {hasDriveway && <Stat tone="ink" label="Driveway exits" value={aheadCount('exit')} />}
          </Stats>
          <LoadChart days={load} selected={selected} onSelect={setSelected} />
          <ul className="sl-micro mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            <li className="flex items-center gap-2"><i className="sl-key" data-fill="solid" />Happened</li>
            <li className="flex items-center gap-2"><i className="sl-key" data-fill="hatch" />Still ahead</li>
            {hasChores && <li className="flex items-center gap-2"><i className="sl-key sl-tone-brick" data-fill="solid" />Missed chore</li>}
          </ul>
        </Panel>

        {hasChores && (
          <Panel
            className="col-span-12 lg:col-span-4"
            title="Chores this week"
            note={`${shortDay.format(dateFromKey(week.start))} to ${shortDay.format(dateFromKey(week.end))}`}
            tools={<Link className="sl-link" to="/chores">Open chores</Link>}
          >
            <div className="grid gap-2">
              <Meter tone="moss" label="Done" hint={versusLastWeek(thisWeek.done, lastWeek.done)} display={thisWeek.done} value={share(thisWeek.done)} />
              <Meter tone="steel" label="To do" display={thisWeek.open} value={share(thisWeek.open)} />
              <Meter tone="brass" label="In grace period" display={thisWeek.grace} value={share(thisWeek.grace)} />
              <Meter tone="brick" label="Missed" hint={versusLastWeek(thisWeek.missed, lastWeek.missed)} display={thisWeek.missed} value={share(thisWeek.missed)} />
            </div>
            <p className="sl-meta mt-4">
              {onTimeRate(month) === null
                ? 'No chores have been decided in the last 30 days.'
                : <>On time over the last 30 days: <strong className="sl-strong sl-num">{percent(onTimeRate(month))}</strong></>}
            </p>
          </Panel>
        )}

        {(hasChores || hasMoney) && (
          <Panel
            className={cn('col-span-12', showSide && 'lg:col-span-8')}
            flush
            title="Roommates"
            note={hasChores ? 'Chores over the last 30 days' : undefined}
          >
            <div className="mt-3 overflow-x-auto">
              <table className="sl-table">
                <thead>
                  <tr>
                    <th>Roommate</th>
                    {hasChores && <th className="max-sm:hidden">Chores done</th>}
                    {hasChores && <th>On time</th>}
                    {hasChores && <th className="max-md:hidden">Next up</th>}
                    {hasMoney && <th className="is-num">Balance</th>}
                    {hasChores && <th className="max-sm:hidden">Standing</th>}
                  </tr>
                </thead>
                <tbody>
                  {stats.map(stat => {
                    const decided = stat.counts.done + stat.counts.missed
                    return (
                      <tr key={stat.member.id}>
                        <td>
                          <span className="flex items-center gap-2.5">
                            <Face member={stat.member} size={28} />
                            <span className="min-w-0">
                              <span className="sl-cell-main">{stat.member.displayName}</span>
                              <span className="sl-cell-sub">
                                {stat.member.id === me.id ? 'You' : stat.member.role === 'owner' ? 'House admin' : 'Roommate'}
                              </span>
                            </span>
                          </span>
                        </td>
                        {hasChores && (
                          <td className="sl-num max-sm:hidden">
                            {decided ? <><span className="sl-strong">{stat.counts.done}</span> <span className="sl-meta">of {decided}</span></> : <span className="sl-meta">None yet</span>}
                          </td>
                        )}
                        {hasChores && (
                          <td>
                            {stat.onTime === null ? <span className="sl-meta">No record</span> : (
                              <span className="flex items-center gap-2.5">
                                <Bar value={stat.onTime} tone={stat.onTime >= .8 ? 'moss' : stat.onTime >= .5 ? 'brass' : 'brick'} className="max-sm:w-10" />
                                <span className="sl-num sl-meta">{percent(stat.onTime)}</span>
                              </span>
                            )}
                          </td>
                        )}
                        {hasChores && (
                          <td className="max-md:hidden">
                            {stat.next ? (
                              <>
                                <span className="sl-cell-main max-w-56 font-[480]!">{stat.next.taskTitle}</span>
                                <span className="sl-cell-sub">{dayTitle(stat.next.scheduledDate, today)}, {formatShortTime(stat.next.dueAt)}</span>
                              </>
                            ) : <span className="sl-meta">Nothing assigned</span>}
                          </td>
                        )}
                        {hasMoney && (
                          <td className={cn('is-num font-[560]', stat.balanceCents < 0 ? 'text-(--sl-brick)' : stat.balanceCents > 0 ? 'text-(--sl-moss)' : 'text-(--sl-muted)')}>
                            {stat.balanceCents === 0 ? 'Settled' : formatMoney(stat.balanceCents, true)}
                          </td>
                        )}
                        {hasChores && (
                          <td className="max-sm:hidden">
                            {stat.openReviews > 0 ? <Chip tone="brass">{stat.openReviews} under review</Chip>
                              : stat.counts.missed > 0 ? <Chip tone="brick">{stat.counts.missed} missed</Chip>
                                : stat.counts.total > 0 ? <Chip tone="moss">On track</Chip>
                                  : <Chip>No chores yet</Chip>}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {showSide && (
          <div className={cn('col-span-12 grid content-start gap-px', (hasChores || hasMoney) && 'lg:col-span-4')}>
            {hasMoney && (
              <Panel title="Your money" tools={<Link className="sl-link" to="/money">Open money</Link>}>
                <p className={cn('sl-reading sl-reading-lg', myBalance < 0 ? 'text-(--sl-brick)' : myBalance > 0 ? 'text-(--sl-moss)' : undefined)}>
                  {formatMoney(Math.abs(myBalance))}
                </p>
                <p className="sl-meta mt-1.5">
                  {myBalance < 0 ? 'You owe the house' : myBalance > 0 ? 'The house owes you' : 'You are settled up with the house'}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-(--sl-line) pt-3">
                  {nextBill ? (
                    <>
                      <span className="min-w-0">
                        <span className="sl-cell-main">{nextBill.title.replace(/ due$/, '')}</span>
                        <span className="sl-cell-sub">
                          Due {dayTitle(nextBill.dateKey, today) === 'Today' ? 'today' : shortDay.format(dateFromKey(nextBill.dateKey))}
                        </span>
                      </span>
                      <span className="sl-num sl-strong">{nextBill.amountCents == null ? 'Pending' : formatMoney(nextBill.amountCents)}</span>
                    </>
                  ) : <span className="sl-meta">No bills coming up.</span>}
                </div>
              </Panel>
            )}
            {hasDriveway && (
              <Panel title="Driveway" tools={<Link className="sl-link" to="/driveway">Open driveway</Link>}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {nextExit && exitVehicle ? (
                      <>
                        <p className="sl-cell-main whitespace-normal">{exitVehicle.label} leaves {timeUntil(nextExit.requiredAt)}</p>
                        <p className="sl-meta mt-1">
                          {memberById(nextExit.ownerMemberId)?.displayName}, {formatShortTime(nextExit.requiredAt)}
                        </p>
                        <p className="mt-2.5">
                          {exitBlockers.length
                            ? <Chip tone="brass">{exitBlockers.length} {exitBlockers.length === 1 ? 'car' : 'cars'} in the way</Chip>
                            : <Chip tone="moss">Clear path out</Chip>}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="sl-cell-main">No exits scheduled</p>
                        <p className="sl-meta mt-1">Schedule one when you need a clear path out.</p>
                      </>
                    )}
                  </div>
                  {slots.length > 0 && (
                    <div className="grid shrink-0 justify-items-center gap-1.5">
                      <span className="sl-micro">Street</span>
                      <DrivewayMini slots={slots} vehicles={data.vehicles} members={data.members} highlightVehicleIds={exitBlockers} />
                    </div>
                  )}
                </div>
              </Panel>
            )}
          </div>
        )}
      </div>
    </>
  )
}
