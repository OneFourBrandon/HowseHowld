import type { AppSnapshot, CalendarEvent, Member, TaskOccurrence, UUID } from '../types'
import {
  addDateKeyDays,
  claimForInfraction,
  claimVoteOf,
  claimVoterIds,
  graceEndsAt,
  graceMinutesOf,
  isInGracePeriod,
  isLiveClaim,
  lastMinuteBefore,
} from './chores'
import { blockingVehicles, slotsFor } from './driveway'
import { EXPENSE_CATEGORIES } from './expenseCategories'
import { isInfractionReviewOpen } from './infractions'
import { allocateBillShares } from './shares'
import { monthlySpending, type SpendingCategory } from './spending'
import { dateKeyInTimeZone, formatMoney, formatShortTime, taskCompletionAvailability } from './utils'

/*
 * Read-only views of the household snapshot, shaped for the slate design's
 * charts, tables and "needs you" list. Nothing here changes data.
 */

const DAY_MS = 86_400_000

// ── Dates ──────────────────────────────────────────────────────────────

export function todayKey(data: Pick<AppSnapshot, 'household'>, nowMs: number) {
  return dateKeyInTimeZone(new Date(nowMs), data.household.timezone)
}

/** A date key as a UTC noon date, safe to format with `timeZone: 'UTC'`. */
export function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`)
}

export function daysBetween(fromKey: string, toKey: string) {
  return Math.round((dateFromKey(toKey).getTime() - dateFromKey(fromKey).getTime()) / DAY_MS)
}

/** Monday to Sunday around a date key. */
export function weekRange(dateKey: string) {
  const weekday = (dateFromKey(dateKey).getUTCDay() + 6) % 7
  const start = addDateKeyDays(dateKey, -weekday)
  return { start, end: addDateKeyDays(start, 6) }
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function daysInMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

// ── Balances ───────────────────────────────────────────────────────────

export interface MemberMoney {
  /** What they have put in. */
  paidCents: number
  /** Their share of what the house has spent. */
  usedCents: number
  netCents: number
  fundOwedCents: number
}

/**
 * Each member's money position. Live data reads it from the member_balances
 * view. The demo has no database, so bill shares are folded in here the way
 * that view does it: a bill counts from the start of its month, and everyone
 * but the bill payer owes the payer their share.
 */
export function moneyByMember(data: AppSnapshot, demoMode: boolean, nowMs = Date.now()) {
  const money = new Map<UUID, MemberMoney>(data.balances.map(balance => [balance.memberId, {
    paidCents: balance.contributionCents,
    usedCents: balance.resourceUseCents,
    netCents: balance.netCents,
    fundOwedCents: balance.fundOwedCents,
  }]))
  if (!demoMode) return money

  const currentMonth = todayKey(data, nowMs).slice(0, 7)
  const entry = (memberId: UUID) => {
    let row = money.get(memberId)
    if (!row) {
      row = { paidCents: 0, usedCents: 0, netCents: 0, fundOwedCents: 0 }
      money.set(memberId, row)
    }
    return row
  }
  for (const period of data.billPeriods) {
    if (period.amountCents == null || period.periodMonth.slice(0, 7) > currentMonth) continue
    const bill = data.bills.find(item => item.id === period.billId)
    if (!bill) continue
    const payeeId = period.payeeMemberId ?? bill.payeeMemberId
    const shares = period.shares?.length ? period.shares : allocateBillShares(period.amountCents, bill)
    for (const share of shares) {
      if (share.memberId === payeeId) continue
      const debtor = entry(share.memberId)
      debtor.usedCents += share.amountCents
      debtor.netCents -= share.amountCents
      const payee = entry(payeeId)
      payee.paidCents += share.amountCents
      payee.netCents += share.amountCents
    }
  }
  return money
}

/** Net balance per member. */
export function netBalances(data: AppSnapshot, demoMode: boolean, nowMs = Date.now()) {
  return new Map([...moneyByMember(data, demoMode, nowMs)].map(([memberId, money]) => [memberId, money.netCents]))
}

// ── Agenda ─────────────────────────────────────────────────────────────

export type AgendaKind = 'chore' | 'bill' | 'event' | 'class' | 'exam' | 'exit'

export interface AgendaEntry {
  id: string
  kind: AgendaKind
  dateKey: string
  sortAt: number
  allDay: boolean
  timeLabel: string
  title: string
  detail: string
  /** The roommate it belongs to: assignee, bill payer, event creator, driver. */
  memberId?: UUID
  /** It involves the signed-in member. */
  mine: boolean
  /**
   * `ahead` has not happened yet, `done` happened, `missed` was a chore nobody
   * finished, `grace` is a chore past due that can still be finished.
   */
  state: 'ahead' | 'done' | 'missed' | 'grace'
  href: string
  occurrence?: TaskOccurrence
  event?: CalendarEvent
  amountCents?: number
}

const has = (data: AppSnapshot, feature: AppSnapshot['household']['enabledFeatures'][number]) =>
  data.household.enabledFeatures.includes(feature)

export function buildAgenda(data: AppSnapshot, nowMs: number): AgendaEntry[] {
  const me = data.household.currentMemberId
  const timeZone = data.household.timezone
  const today = todayKey(data, nowMs)
  const graceMinutes = graceMinutesOf(data.household)
  const name = (id: UUID) => data.members.find(member => member.id === id)?.displayName ?? 'A roommate'
  const entries: AgendaEntry[] = []

  if (has(data, 'chores')) {
    for (const occurrence of data.occurrences) {
      // A chore in its grace period stays on today until the grace period ends.
      const inGrace = isInGracePeriod(occurrence, graceMinutes, nowMs)
      const graceEnd = graceEndsAt(occurrence.dueAt, graceMinutes).toISOString()
      entries.push({
        id: `chore-${occurrence.id}`,
        kind: 'chore',
        dateKey: inGrace ? today : occurrence.scheduledDate,
        sortAt: new Date(occurrence.dueAt).getTime(),
        allDay: false,
        timeLabel: formatShortTime(inGrace ? graceEnd : occurrence.dueAt),
        title: occurrence.taskTitle,
        detail: inGrace ? `Grace period, was due ${formatShortTime(occurrence.dueAt)}` : occurrence.area,
        memberId: occurrence.assigneeId,
        mine: occurrence.assigneeId === me,
        state: occurrence.status === 'completed' ? 'done'
          : occurrence.status === 'missed' ? 'missed'
            : inGrace ? 'grace' : 'ahead',
        href: '/chores',
        occurrence,
      })
    }
  }

  if (has(data, 'calendar') || has(data, 'courses')) {
    for (const event of data.events) {
      const startMs = new Date(event.startAt).getTime()
      entries.push({
        id: `event-${event.id}`,
        kind: event.kind === 'class' ? 'class' : event.kind === 'exam' ? 'exam' : 'event',
        dateKey: dateKeyInTimeZone(new Date(event.startAt), timeZone),
        sortAt: startMs,
        allDay: event.allDay,
        timeLabel: event.allDay ? 'All day' : formatShortTime(event.startAt),
        title: event.title,
        detail: event.location ?? (event.kind === 'class' ? 'Class' : event.kind === 'exam' ? 'Exam' : 'House event'),
        memberId: event.creatorId,
        mine: event.audience === 'everyone' || event.creatorId === me || event.audienceMemberIds.includes(me),
        state: new Date(event.endAt).getTime() < nowMs ? 'done' : 'ahead',
        href: '/calendar',
        event,
      })
    }
  }

  if (has(data, 'money')) {
    for (const period of data.billPeriods) {
      const bill = data.bills.find(item => item.id === period.billId)
      if (!bill) continue
      const payeeId = period.payeeMemberId ?? bill.payeeMemberId
      const shares = period.amountCents == null ? []
        : period.shares?.length ? period.shares : allocateBillShares(period.amountCents, bill)
      const myShare = shares.find(share => share.memberId === me)?.amountCents
      const involved = bill.memberIds.includes(me) || payeeId === me
      const dueMs = new Date(period.dueAt).getTime()
      const dueKey = dateKeyInTimeZone(new Date(period.dueAt), timeZone)
      // Bills are settled with direct payments now, but older periods can still carry a paid mark.
      const paid = period.paidMemberIds.includes(me)
      entries.push({
        id: `bill-${period.id}`,
        kind: 'bill',
        dateKey: dueKey,
        sortAt: dueMs,
        allDay: true,
        timeLabel: 'All day',
        title: `${bill.name} due`,
        detail: period.amountCents == null ? 'Price not entered yet'
          : paid ? 'Marked as paid'
          : payeeId === me ? 'Roommates owe you their shares'
            : myShare ? `Your share, owed to ${name(payeeId)}`
              : `Owed to ${name(payeeId)}`,
        memberId: payeeId,
        mine: involved,
        // A bill is due all day, so it stays ahead until its due day is over.
        state: paid || dueKey < today ? 'done' : 'ahead',
        href: '/money',
        amountCents: period.amountCents == null ? undefined
          : payeeId === me ? period.amountCents : myShare ?? period.amountCents,
      })
    }
  }

  if (has(data, 'driveway')) {
    for (const departure of data.departures) {
      const vehicle = data.vehicles.find(item => item.id === departure.vehicleId)
      const dueMs = new Date(departure.requiredAt).getTime()
      entries.push({
        id: `exit-${departure.id}`,
        kind: 'exit',
        dateKey: dateKeyInTimeZone(new Date(departure.requiredAt), timeZone),
        sortAt: dueMs,
        allDay: false,
        timeLabel: formatShortTime(departure.requiredAt),
        title: vehicle ? `${vehicle.label} needs out` : 'A car needs out',
        detail: departure.sourceLabel || 'Driveway exit',
        memberId: departure.ownerMemberId,
        mine: departure.ownerMemberId === me,
        state: dueMs < nowMs ? 'done' : 'ahead',
        href: '/driveway',
      })
    }
  }

  return entries.sort((left, right) =>
    left.dateKey.localeCompare(right.dateKey)
    || Number(right.allDay) - Number(left.allDay)
    || left.sortAt - right.sortAt)
}

// ── Day load ───────────────────────────────────────────────────────────

export interface LoadBlock {
  kind: AgendaKind
  /** Solid has happened, hatch is still to come, missed was a chore nobody finished. */
  fill: 'solid' | 'hatch' | 'missed'
}

export interface DayLoad {
  dateKey: string
  relation: 'past' | 'today' | 'future'
  blocks: LoadBlock[]
}

const KIND_ORDER: AgendaKind[] = ['chore', 'bill', 'event', 'class', 'exam', 'exit']

export function blockFor(entry: AgendaEntry): LoadBlock {
  return {
    kind: entry.kind,
    fill: entry.state === 'missed' ? 'missed' : entry.state === 'done' ? 'solid' : 'hatch',
  }
}

/** One column per day around today, each a stack of the things that day holds. */
export function dayLoad(agenda: AgendaEntry[], today: string, daysBack: number, daysAhead: number): DayLoad[] {
  const byDay = new Map<string, AgendaEntry[]>()
  for (const entry of agenda) {
    const list = byDay.get(entry.dateKey)
    if (list) list.push(entry)
    else byDay.set(entry.dateKey, [entry])
  }
  return Array.from({ length: daysBack + daysAhead + 1 }, (_, index) => {
    const dateKey = addDateKeyDays(today, index - daysBack)
    const blocks = (byDay.get(dateKey) ?? [])
      .map(blockFor)
      .sort((left, right) => KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind))
    return {
      dateKey,
      relation: dateKey < today ? 'past' as const : dateKey > today ? 'future' as const : 'today' as const,
      blocks,
    }
  })
}

// ── Chores ─────────────────────────────────────────────────────────────

export interface ChoreCounts {
  done: number
  open: number
  grace: number
  missed: number
  total: number
}

/** Chores scheduled between two date keys, inclusive, counted by where they stand. */
export function choreCounts(
  data: Pick<AppSnapshot, 'occurrences' | 'household'>,
  startKey: string,
  endKey: string,
  nowMs: number,
  memberId?: UUID,
): ChoreCounts {
  const graceMinutes = graceMinutesOf(data.household)
  const counts: ChoreCounts = { done: 0, open: 0, grace: 0, missed: 0, total: 0 }
  for (const occurrence of data.occurrences) {
    if (occurrence.scheduledDate < startKey || occurrence.scheduledDate > endKey) continue
    if (memberId && occurrence.assigneeId !== memberId) continue
    counts.total += 1
    if (occurrence.status === 'completed') counts.done += 1
    else if (occurrence.status === 'missed') counts.missed += 1
    else if (isInGracePeriod(occurrence, graceMinutes, nowMs)) counts.grace += 1
    else counts.open += 1
  }
  return counts
}

/** Done chores as a share of chores that have been decided either way. */
export function onTimeRate(counts: Pick<ChoreCounts, 'done' | 'missed'>) {
  const decided = counts.done + counts.missed
  return decided ? counts.done / decided : null
}

export interface MemberStat {
  member: Member
  counts: ChoreCounts
  onTime: number | null
  balanceCents: number
  fundOwedCents: number
  /** Their next unfinished chore. */
  next?: TaskOccurrence
  /** Missed chores of theirs still under review. */
  openReviews: number
}

export function memberStats(
  data: AppSnapshot,
  nowMs: number,
  balances: Map<UUID, number>,
  windowDays = 30,
): MemberStat[] {
  const today = todayKey(data, nowMs)
  const start = addDateKeyDays(today, -(windowDays - 1))
  return data.members.filter(member => member.active).map(member => {
    const counts = choreCounts(data, start, today, nowMs, member.id)
    const next = data.occurrences
      .filter(occurrence => occurrence.assigneeId === member.id && occurrence.status === 'assigned')
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt))[0]
    return {
      member,
      counts,
      onTime: onTimeRate(counts),
      balanceCents: balances.get(member.id) ?? 0,
      fundOwedCents: data.balances.find(balance => balance.memberId === member.id)?.fundOwedCents ?? 0,
      next,
      openReviews: data.infractions.filter(infraction =>
        infraction.memberId === member.id
        && isInfractionReviewOpen(infraction, nowMs, claimForInfraction(data.choreClaims, infraction.id))).length,
    }
  })
}

export interface GridCell {
  dateKey: string
  done: number
  missed: number
  open: number
}

/** Who did what, day by day: one row per roommate. */
export function completionGrid(
  data: Pick<AppSnapshot, 'members' | 'occurrences'>,
  today: string,
  daysBack = 27,
  daysAhead = 7,
) {
  const days = Array.from({ length: daysBack + daysAhead + 1 }, (_, index) =>
    addDateKeyDays(today, index - daysBack))
  const index = new Map(days.map((day, position) => [day, position]))
  const rows = data.members.filter(member => member.active).map(member => ({
    member,
    cells: days.map((dateKey): GridCell => ({ dateKey, done: 0, missed: 0, open: 0 })),
  }))
  const rowByMember = new Map(rows.map(row => [row.member.id, row]))
  for (const occurrence of data.occurrences) {
    const position = index.get(occurrence.scheduledDate)
    const row = rowByMember.get(occurrence.assigneeId)
    if (position === undefined || !row) continue
    const cell = row.cells[position]
    if (occurrence.status === 'completed') cell.done += 1
    else if (occurrence.status === 'missed') cell.missed += 1
    else cell.open += 1
  }
  return { today, days, rows }
}

// ── Needs you ──────────────────────────────────────────────────────────

export type AttentionSection = 'chores' | 'money' | 'driveway' | 'settings'
export type AttentionTone = 'brass' | 'brick' | 'steel'

export interface AttentionItem {
  id: string
  section: AttentionSection
  tone: AttentionTone
  title: string
  detail: string
  href: string
  /** `action` wants something done now. `note` is worth knowing and can wait. */
  level: 'action' | 'note'
  rank: number
  at: number
  /** Something that can be finished right from the list. */
  quick?:
    | { type: 'complete'; occurrenceId: UUID; label: string }
    | { type: 'confirm-settlement'; settlementId: UUID; label: string }
    | { type: 'confirm-fund'; paymentId: UUID; label: string }
}

const sectionEnabled: Record<AttentionSection, (data: AppSnapshot) => boolean> = {
  chores: data => has(data, 'chores'),
  money: data => has(data, 'money'),
  driveway: data => has(data, 'driveway'),
  settings: () => true,
}

/** Everything in the house that is waiting on the signed-in member, most urgent first. */
export function attentionItems(
  data: AppSnapshot,
  nowMs: number,
  balances: Map<UUID, number> = new Map(),
): AttentionItem[] {
  const me = data.household.currentMemberId
  const currentMember = data.members.find(member => member.id === me)
  const today = todayKey(data, nowMs)
  const timeZone = data.household.timezone
  const graceMinutes = graceMinutesOf(data.household)
  const name = (id: UUID) => data.members.find(member => member.id === id)?.displayName ?? 'A former roommate'
  const items: AttentionItem[] = []

  for (const occurrence of data.occurrences) {
    if (occurrence.assigneeId !== me || occurrence.status !== 'assigned') continue
    const inGrace = isInGracePeriod(occurrence, graceMinutes, nowMs)
    if (!inGrace && occurrence.scheduledDate !== today) continue
    const available = taskCompletionAvailability(
      occurrence.scheduledDate, occurrence.dueAt, timeZone, new Date(nowMs), graceMinutes,
    ) === 'available'
    if (!available) continue
    const graceEnd = graceEndsAt(occurrence.dueAt, graceMinutes)
    items.push({
      id: `chore:${occurrence.id}`,
      section: 'chores',
      tone: inGrace ? 'brick' : 'brass',
      title: occurrence.taskTitle,
      detail: inGrace
        ? `Past due. Finish by ${formatShortTime(graceEnd.toISOString())} to avoid a penalty`
        : `${occurrence.area}, due ${formatShortTime(occurrence.dueAt)}`,
      href: '/chores',
      level: 'action',
      rank: inGrace ? 0 : 1,
      at: inGrace ? graceEnd.getTime() : new Date(occurrence.dueAt).getTime(),
      quick: { type: 'complete', occurrenceId: occurrence.id, label: 'Mark done' },
    })
  }

  if (has(data, 'driveway')) {
    const slots = slotsFor(data)
    const myVehicles = new Set(data.vehicles.filter(vehicle => vehicle.ownerMemberId === me).map(vehicle => vehicle.id))
    for (const departure of data.departures) {
      const leavesAt = new Date(departure.requiredAt).getTime()
      if (leavesAt < nowMs || leavesAt > nowMs + DAY_MS || departure.ownerMemberId === me) continue
      const mine = blockingVehicles(slots, departure.vehicleId).filter(id => myVehicles.has(id))
      if (!mine.length) continue
      const blocker = data.vehicles.find(vehicle => vehicle.id === mine[0])
      const leaving = data.vehicles.find(vehicle => vehicle.id === departure.vehicleId)
      items.push({
        id: `blocking:${departure.id}`,
        section: 'driveway',
        tone: 'brass',
        title: `Move ${blocker?.label ?? 'your car'} by ${formatShortTime(departure.requiredAt)}`,
        detail: `${name(departure.ownerMemberId)} needs ${leaving?.label ?? 'their car'} out and you are parked in the way`,
        href: '/driveway',
        level: 'action',
        rank: 1,
        at: leavesAt,
      })
    }
  }

  for (const infraction of data.infractions) {
    const claim = claimForInfraction(data.choreClaims, infraction.id)
    if (!isInfractionReviewOpen(infraction, nowMs, claim)) continue
    const live = claim && isLiveClaim(claim) ? claim : undefined

    if (live?.status === 'claimed' && live.claimerId === me) {
      const due = lastMinuteBefore(live.claimDeadline)
      // Past the deadline the photo can no longer be added; the server lapses the claim shortly after.
      if (new Date(live.claimDeadline).getTime() <= nowMs) continue
      items.push({
        id: `claim-photo:${live.id}`,
        section: 'chores',
        tone: 'brass',
        title: `Add your after photo for ${infraction.taskTitle}`,
        detail: `You are covering this for ${name(live.assigneeId)}. The reward is ${formatMoney(live.rewardCents)}`,
        href: '/chores',
        level: 'action',
        rank: 2,
        at: due.getTime(),
      })
      continue
    }

    if (live) {
      const waitingOnMe = live.status === 'submitted'
        && claimVoterIds(data.members, live).includes(me)
        && !claimVoteOf(live, me)
        && (!live.voteDeadline || new Date(live.voteDeadline).getTime() > nowMs)
      if (waitingOnMe) {
        items.push({
          id: `claim-vote:${live.id}`,
          section: 'chores',
          tone: 'brass',
          title: `Did ${name(live.claimerId)} really do it?`,
          detail: `Check the photos for ${infraction.taskTitle} and vote`,
          href: '/chores',
          level: 'action',
          rank: 3,
          at: new Date(live.voteDeadline ?? live.claimDeadline).getTime(),
        })
      }
      continue
    }

    if (infraction.memberId === me) {
      if (infraction.status === 'pending') {
        items.push({
          id: `my-miss:${infraction.id}`,
          section: 'chores',
          tone: 'steel',
          title: `You missed ${infraction.taskTitle}`,
          detail: `${formatMoney(infraction.amountCents)} penalty unless the house excuses it. You can dispute it`,
          href: '/chores',
          level: 'note',
          rank: 6,
          at: new Date(infraction.disputeDeadline).getTime(),
        })
      }
      continue
    }

    const voted = infraction.excuseVotes.includes(me) || infraction.upholdVotes.includes(me)
    if (!voted) {
      items.push({
        id: `vote:${infraction.id}`,
        section: 'chores',
        tone: 'brass',
        title: `Vote on ${name(infraction.memberId)}’s missed chore`,
        detail: `${infraction.taskTitle}, ${formatMoney(infraction.amountCents)} penalty`,
        href: '/chores',
        level: 'action',
        rank: 3,
        at: new Date(infraction.disputeDeadline).getTime(),
      })
    }
  }

  for (const settlement of data.settlements) {
    if (settlement.toMemberId !== me || settlement.status !== 'pending') continue
    items.push({
      id: `settlement:${settlement.id}`,
      section: 'money',
      tone: 'brass',
      title: `Confirm ${formatMoney(settlement.amountCents)} from ${name(settlement.fromMemberId)}`,
      detail: 'Balances change once you confirm the payment arrived',
      href: '/money',
      level: 'action',
      rank: 4,
      at: new Date(settlement.createdAt).getTime(),
      quick: { type: 'confirm-settlement', settlementId: settlement.id, label: 'Confirm' },
    })
  }

  for (const payment of data.fundPayments) {
    if (payment.memberId === me || payment.status !== 'pending') continue
    items.push({
      id: `fund:${payment.id}`,
      section: 'money',
      tone: 'brass',
      title: `Confirm ${name(payment.memberId)}’s ${formatMoney(payment.amountCents)} penalty payment`,
      detail: 'Paid into the house penalty account',
      href: '/money',
      level: 'action',
      rank: 4,
      at: new Date(payment.createdAt).getTime(),
      quick: { type: 'confirm-fund', paymentId: payment.id, label: 'Confirm' },
    })
  }

  if (currentMember?.role === 'owner') {
    const currentMonth = today.slice(0, 7)
    for (const bill of data.bills) {
      if (!bill.requiresMonthlyPrice) continue
      const period = data.billPeriods.find(item =>
        item.billId === bill.id && item.periodMonth.slice(0, 7) === currentMonth)
      if (period?.amountCents != null) continue
      items.push({
        id: `bill-price:${bill.id}`,
        section: 'money',
        tone: 'brass',
        title: `Enter this month’s price for ${bill.name}`,
        detail: 'Roommates see it as pending until you do',
        href: '/money',
        level: 'action',
        rank: 5,
        at: period ? new Date(period.dueAt).getTime() : nowMs,
      })
    }
  }

  const myNet = balances.get(me) ?? 0
  if (myNet <= -100) {
    items.push({
      id: 'owe-house',
      section: 'money',
      tone: 'steel',
      title: `You owe the house ${formatMoney(-myNet)}`,
      detail: 'Pay a roommate directly, then record it with Settle up',
      href: '/money',
      level: 'note',
      rank: 7,
      at: nowMs,
    })
  }

  const myFund = data.balances.find(balance => balance.memberId === me)?.fundOwedCents ?? 0
  if (myFund > 0) {
    items.push({
      id: 'owe-fund',
      section: 'money',
      tone: 'steel',
      title: `You owe ${formatMoney(myFund)} to the penalty account`,
      detail: 'Record the payment once you have paid it',
      href: '/money',
      level: 'note',
      rank: 7,
      at: nowMs,
    })
  }

  if (has(data, 'notifications') && !data.notificationHealth.subscribed) {
    items.push({
      id: 'reminders-off',
      section: 'settings',
      tone: 'steel',
      title: 'Reminders are off on this device',
      detail: 'Turn them on so chore and driveway alerts reach you',
      href: '/settings',
      level: 'note',
      rank: 8,
      at: nowMs,
    })
  }

  return items
    .filter(item => sectionEnabled[item.section](data))
    .sort((left, right) => left.rank - right.rank || left.at - right.at)
}

export function attentionCounts(items: AttentionItem[]) {
  const counts: Record<AttentionSection, number> = { chores: 0, money: 0, driveway: 0, settings: 0 }
  for (const item of items) if (item.level === 'action') counts[item.section] += 1
  return counts
}

// ── Money ──────────────────────────────────────────────────────────────

const SPENDING_LABELS: Record<SpendingCategory, string> = {
  ...Object.fromEntries(EXPENSE_CATEGORIES.map(option => [option.value, option.label])),
  rent: 'Rent',
  insurance: 'Insurance',
} as Record<SpendingCategory, string>

export const spendingLabel = (category: SpendingCategory) => SPENDING_LABELS[category] ?? 'Other'

export interface CategoryTotal {
  category: SpendingCategory
  label: string
  amountCents: number
  /** Share of the month, 0 to 1. */
  share: number
  count: number
}

/** A month of spending grouped by category, largest first. */
export function categoryTotals(data: AppSnapshot, month: string, memberId?: UUID) {
  const entries = monthlySpending(data, month, memberId)
  const totalCents = entries.reduce((sum, entry) => sum + entry.amountCents, 0)
  const byCategory = new Map<SpendingCategory, { amountCents: number; count: number }>()
  for (const entry of entries) {
    const current = byCategory.get(entry.category) ?? { amountCents: 0, count: 0 }
    byCategory.set(entry.category, { amountCents: current.amountCents + entry.amountCents, count: current.count + 1 })
  }
  const categories: CategoryTotal[] = [...byCategory.entries()]
    .map(([category, value]) => ({
      category,
      label: spendingLabel(category),
      amountCents: value.amountCents,
      share: totalCents ? value.amountCents / totalCents : 0,
      count: value.count,
    }))
    .sort((left, right) => right.amountCents - left.amountCents)
  return { entries, totalCents, categories }
}

export interface SpendCurve {
  month: string
  days: number
  totalCents: number
  /** Running total at the end of each day of the month. */
  cumulative: number[]
  /** Days with something to draw: today for the current month, the whole month otherwise. */
  through: number
}

/** Spending as a running total through the month. Bills land on their due date. */
export function spendCurve(data: AppSnapshot, month: string, nowMs: number, memberId?: UUID): SpendCurve {
  const days = daysInMonth(month)
  const perDay = Array.from({ length: days }, () => 0)
  const dueDayByPeriod = new Map(data.billPeriods.map(period => [
    `bill:${period.id}`,
    dateKeyInTimeZone(new Date(period.dueAt), data.household.timezone),
  ]))
  for (const entry of monthlySpending(data, month, memberId)) {
    const dated = dueDayByPeriod.get(entry.id) ?? entry.date
    const day = dated.slice(0, 7) === month ? Number(dated.slice(8, 10)) : dated.slice(0, 7) > month ? days : 1
    perDay[Math.min(days, Math.max(1, day)) - 1] += entry.amountCents
  }
  let running = 0
  const cumulative = perDay.map(amount => (running += amount))
  const today = todayKey(data, nowMs)
  const currentMonth = today.slice(0, 7)
  return {
    month,
    days,
    totalCents: running,
    cumulative,
    through: month < currentMonth ? days : month > currentMonth ? 0 : Number(today.slice(8, 10)),
  }
}

/** Month totals ending at `month`, oldest first. */
export function monthTotals(data: AppSnapshot, month: string, count = 6, memberId?: UUID) {
  return Array.from({ length: count }, (_, index) => {
    const key = shiftMonth(month, index - (count - 1))
    return {
      month: key,
      totalCents: monthlySpending(data, key, memberId).reduce((sum, entry) => sum + entry.amountCents, 0),
    }
  })
}
