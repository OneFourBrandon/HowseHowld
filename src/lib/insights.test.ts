import { describe, expect, it } from 'vitest'
import { demoSnapshot } from '../data/demo'
import { axisMax } from '../slate/kinds'
import type { AppSnapshot, ISODateTime, Infraction, TaskOccurrence } from '../types'
import {
  attentionCounts,
  attentionItems,
  buildAgenda,
  categoryTotals,
  choreCounts,
  completionGrid,
  dayLoad,
  daysBetween,
  daysInMonth,
  memberStats,
  moneyByMember,
  netBalances,
  onTimeRate,
  shiftMonth,
  spendCurve,
  todayKey,
  weekRange,
} from './insights'
import { billBalanceAdjustments } from './shares'
import { monthlySpending } from './spending'
import { cents } from './utils'

// Wednesday 11 March 2026, 3:00 PM in Toronto.
const NOW = Date.parse('2026-03-11T15:00:00-04:00')
const iso = (value: string) => new Date(value).toISOString() as ISODateTime
const ME = 'member-brandon'

/** The demo house with its dated records cleared, so each test states its own. */
function house(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    ...structuredClone(demoSnapshot),
    occurrences: [],
    infractions: [],
    choreClaims: [],
    expenses: [],
    settlements: [],
    fundPayments: [],
    bills: [],
    billPeriods: [],
    events: [],
    departures: [],
    notificationHealth: { permission: 'granted', subscribed: true, installed: true },
    balances: demoSnapshot.balances.map(balance => ({
      ...balance,
      contributionCents: cents(0),
      resourceUseCents: cents(0),
      settlementAdjustmentCents: cents(0),
      netCents: cents(0),
      fundOwedCents: cents(0),
    })),
    ...overrides,
  }
}

function chore(id: string, patch: Partial<TaskOccurrence>): TaskOccurrence {
  return {
    id,
    taskId: `task-${id}`,
    taskTitle: `Chore ${id}`,
    area: 'Kitchen',
    assigneeId: ME,
    scheduledDate: '2026-03-11',
    dueAt: iso('2026-03-11T23:59:00-04:00'),
    status: 'assigned',
    reminderLabel: '',
    ...patch,
  }
}

function infraction(id: string, patch: Partial<Infraction>): Infraction {
  return {
    id,
    occurrenceId: `occ-${id}`,
    memberId: 'member-liam',
    taskTitle: `Missed ${id}`,
    amountCents: cents(1_000),
    status: 'pending',
    disputeDeadline: iso('2026-03-15T12:00:00-04:00'),
    upholdVotes: [],
    excuseVotes: [],
    ...patch,
  }
}

const rent = {
  bills: [{
    id: 'bill-rent',
    householdId: 'house-maple',
    name: 'Rent',
    category: 'rent' as const,
    payeeMemberId: ME,
    amountCents: cents(200_000),
    dueDay: 20,
    reminderDaysBefore: [1],
    active: true,
    memberIds: ['member-brandon', 'member-maya', 'member-liam', 'member-noah'],
  }],
  billPeriods: [{
    id: 'period-rent',
    billId: 'bill-rent',
    payeeMemberId: ME,
    periodMonth: '2026-03-01',
    dueAt: iso('2026-03-20T09:00:00-04:00'),
    amountCents: cents(200_000),
    paidMemberIds: [],
  }],
}

describe('dates', () => {
  it('reads today in the household time zone', () => {
    expect(todayKey(house(), NOW)).toBe('2026-03-11')
    // 1:30 AM UTC on the 12th is still the evening of the 11th in Toronto.
    expect(todayKey(house(), Date.parse('2026-03-12T01:30:00Z'))).toBe('2026-03-11')
  })

  it('runs a week from Monday to Sunday', () => {
    expect(weekRange('2026-03-11')).toEqual({ start: '2026-03-09', end: '2026-03-15' })
    expect(weekRange('2026-03-15')).toEqual({ start: '2026-03-09', end: '2026-03-15' })
    expect(weekRange('2026-03-09')).toEqual({ start: '2026-03-09', end: '2026-03-15' })
  })

  it('steps months across a year boundary', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3)
  })
})

describe('chores', () => {
  const data = house({
    occurrences: [
      chore('done', { scheduledDate: '2026-03-09', dueAt: iso('2026-03-09T23:59:00-04:00'), status: 'completed' }),
      chore('missed', { scheduledDate: '2026-03-10', dueAt: iso('2026-03-10T23:59:00-04:00'), status: 'missed', assigneeId: 'member-noah' }),
      chore('open', {}),
      // Due an hour ago with a four hour grace period.
      chore('grace', { dueAt: iso('2026-03-11T14:00:00-04:00'), assigneeId: 'member-maya' }),
      chore('next-week', { scheduledDate: '2026-03-17', dueAt: iso('2026-03-17T23:59:00-04:00') }),
    ],
  })

  it('counts a week of chores by where they stand', () => {
    expect(choreCounts(data, '2026-03-09', '2026-03-15', NOW)).toEqual({ done: 1, open: 1, grace: 1, missed: 1, total: 4 })
    expect(choreCounts(data, '2026-03-09', '2026-03-15', NOW, ME)).toEqual({ done: 1, open: 1, grace: 0, missed: 0, total: 2 })
  })

  it('reports on-time rate only once something is decided', () => {
    expect(onTimeRate({ done: 3, missed: 1 })).toBe(0.75)
    expect(onTimeRate({ done: 0, missed: 0 })).toBeNull()
  })

  it('summarises each roommate', () => {
    const stats = memberStats(data, NOW, new Map([[ME, 500]]))
    const mine = stats.find(stat => stat.member.id === ME)!
    expect(mine.counts.done).toBe(1)
    expect(mine.onTime).toBe(1)
    expect(mine.balanceCents).toBe(500)
    expect(mine.next?.id).toBe('open')
    expect(stats.find(stat => stat.member.id === 'member-noah')!.onTime).toBe(0)
    expect(stats.find(stat => stat.member.id === 'member-liam')!.onTime).toBeNull()
  })

  it('lays chores out by roommate and day', () => {
    const grid = completionGrid(data, NOW, 2, 1)
    expect(grid.days).toEqual(['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12'])
    const mine = grid.rows.find(row => row.member.id === ME)!
    expect(mine.cells.map(cell => [cell.done, cell.missed, cell.open])).toEqual([[1, 0, 0], [0, 0, 0], [0, 0, 1], [0, 0, 0]])
  })
})

describe('agenda', () => {
  const data = house({
    ...rent,
    occurrences: [
      chore('grace', { scheduledDate: '2026-03-10', dueAt: iso('2026-03-11T14:00:00-04:00') }),
      chore('missed', { scheduledDate: '2026-03-10', dueAt: iso('2026-03-10T09:00:00-04:00'), status: 'missed' }),
    ],
    events: [{
      id: 'lecture',
      title: 'CSC 209 lecture',
      startAt: iso('2026-03-12T14:00:00-04:00'),
      endAt: iso('2026-03-12T15:00:00-04:00'),
      allDay: false,
      creatorId: 'member-liam',
      audience: 'self',
      audienceMemberIds: [],
      kind: 'class',
      reminderOffsets: [],
    }],
    departures: [{
      id: 'exit',
      vehicleId: 'vehicle-maya',
      ownerMemberId: 'member-maya',
      requiredAt: iso('2026-03-11T18:00:00-04:00'),
      source: 'manual',
      sourceLabel: 'Work',
      warningMinutes: 60,
      blockerVehicleIds: [],
    }],
  })
  const agenda = buildAgenda(data, NOW)
  const byId = (id: string) => agenda.find(entry => entry.id === id)!

  it('keeps a chore in its grace period on today', () => {
    expect(byId('chore-grace')).toMatchObject({ dateKey: '2026-03-11', state: 'grace', mine: true })
    expect(byId('chore-missed')).toMatchObject({ dateKey: '2026-03-10', state: 'missed' })
  })

  it('describes a bill from the reader’s side', () => {
    expect(byId('bill-period-rent')).toMatchObject({ dateKey: '2026-03-20', state: 'ahead', mine: true, amountCents: 200_000 })
    expect(byId('bill-period-rent').detail).toBe('Roommates owe you their shares')

    const asMaya = buildAgenda({ ...data, household: { ...data.household, currentMemberId: 'member-maya' } }, NOW)
    const bill = asMaya.find(entry => entry.id === 'bill-period-rent')!
    expect(bill.amountCents).toBe(50_000)
    expect(bill.detail).toBe('Your share, owed to Brandon')
  })

  it('marks whose a private class is', () => {
    expect(byId('event-lecture')).toMatchObject({ kind: 'class', mine: false, memberId: 'member-liam' })
  })

  it('leaves out features that are switched off', () => {
    const noDriveway = { ...data, household: { ...data.household, enabledFeatures: data.household.enabledFeatures.filter(item => item !== 'driveway') } }
    expect(buildAgenda(noDriveway, NOW).some(entry => entry.kind === 'exit')).toBe(false)
  })

  it('draws what happened solid, what is ahead hatched, and a miss in its own colour', () => {
    const load = dayLoad(agenda, '2026-03-11', 1, 1)
    expect(load.map(day => day.relation)).toEqual(['past', 'today', 'future'])
    expect(load[0].blocks).toEqual([{ kind: 'chore', fill: 'missed' }])
    expect(load[1].blocks).toEqual([{ kind: 'chore', fill: 'hatch' }, { kind: 'exit', fill: 'hatch' }])
    expect(load[2].blocks).toEqual([{ kind: 'class', fill: 'hatch' }])
  })
})

describe('needs you', () => {
  it('lists what is waiting on the member, most urgent first', () => {
    const data = house({
      occurrences: [
        chore('today', {}),
        chore('grace', { scheduledDate: '2026-03-10', dueAt: iso('2026-03-11T14:00:00-04:00') }),
        chore('tomorrow', { scheduledDate: '2026-03-12', dueAt: iso('2026-03-12T23:59:00-04:00') }),
        chore('someone-else', { assigneeId: 'member-noah' }),
      ],
      infractions: [
        infraction('theirs', {}),
        infraction('voted', { upholdVotes: [ME] }),
        infraction('mine', { memberId: ME }),
        infraction('closed', { disputeDeadline: iso('2026-03-01T12:00:00-05:00') }),
      ],
      settlements: [
        { id: 'to-me', fromMemberId: 'member-noah', toMemberId: ME, amountCents: cents(1_200), status: 'pending', createdAt: iso('2026-03-11T09:00:00-04:00') },
        { id: 'from-me', fromMemberId: ME, toMemberId: 'member-noah', amountCents: cents(500), status: 'pending', createdAt: iso('2026-03-11T09:00:00-04:00') },
      ],
      notificationHealth: { permission: 'default', subscribed: false, installed: false },
    })
    const items = attentionItems(data, NOW, new Map([[ME, -2_500]]))

    expect(items.map(item => item.id)).toEqual([
      'chore:grace',
      'chore:today',
      'vote:theirs',
      'settlement:to-me',
      'my-miss:mine',
      'owe-house',
      'reminders-off',
    ])
    expect(items[0]).toMatchObject({ tone: 'brick', quick: { type: 'complete', occurrenceId: 'grace' } })
    expect(items[3].quick).toEqual({ type: 'confirm-settlement', settlementId: 'to-me', label: 'Confirm' })
    expect(attentionCounts(items)).toEqual({ chores: 3, money: 1, driveway: 0, settings: 0 })
  })

  it('asks the admin for a missing monthly price', () => {
    const data = house({
      bills: [{ ...rent.bills[0], amountCents: undefined, requiresMonthlyPrice: true }],
      billPeriods: [{ ...rent.billPeriods[0], amountCents: undefined }],
    })
    expect(attentionItems(data, NOW).map(item => item.id)).toEqual(['bill-price:bill-rent'])
    const asMember = { ...data, household: { ...data.household, currentMemberId: 'member-maya' } }
    expect(attentionItems(asMember, NOW)).toEqual([])
  })

  it('tells a driver when their car is in the way', () => {
    const data = house({
      departures: [{
        id: 'exit',
        vehicleId: 'vehicle-brandon',
        ownerMemberId: ME,
        requiredAt: iso('2026-03-11T18:00:00-04:00'),
        source: 'manual',
        sourceLabel: 'Work',
        warningMinutes: 60,
        blockerVehicleIds: [],
      }],
    })
    // The demo lot is one lane: Maya, then Noah, then Brandon at the back.
    const asMaya = { ...data, household: { ...data.household, currentMemberId: 'member-maya' } }
    const [item] = attentionItems(asMaya, NOW)
    expect(item).toMatchObject({ id: 'blocking:exit', section: 'driveway', level: 'action' })
    expect(item.title).toContain('Blue Civic')
    expect(attentionItems(data, NOW)).toEqual([])
  })

  it('drops anything from a feature that is switched off', () => {
    const data = house({ occurrences: [chore('today', {})] })
    const withoutChores = { ...data, household: { ...data.household, enabledFeatures: ['money' as const] } }
    expect(attentionItems(withoutChores, NOW)).toEqual([])
  })
})

describe('money', () => {
  const data = house({
    ...rent,
    expenses: [{
      id: 'groceries',
      title: 'Groceries',
      category: 'groceries',
      purchasedAt: iso('2026-03-05T18:00:00-05:00'),
      createdBy: ME,
      amountCents: cents(8_000),
      payers: [{ memberId: ME, amountCents: cents(8_000) }],
      beneficiaries: demoSnapshot.members.map(member => ({ memberId: member.id, amountCents: cents(2_000) })),
      reversed: false,
    }, {
      id: 'deleted',
      title: 'Deleted',
      category: 'dining',
      purchasedAt: iso('2026-03-06T18:00:00-05:00'),
      createdBy: ME,
      amountCents: cents(9_900),
      payers: [{ memberId: ME, amountCents: cents(9_900) }],
      beneficiaries: [{ memberId: ME, amountCents: cents(9_900) }],
      reversed: true,
    }],
  })

  it('folds bill shares into the demo balances the way the database view does', () => {
    const money = moneyByMember(data, true, NOW)
    expect(money.get(ME)).toMatchObject({ paidCents: 150_000, usedCents: 0, netCents: 150_000 })
    expect(money.get('member-maya')).toMatchObject({ paidCents: 0, usedCents: 50_000, netCents: -50_000 })

    const adjustments = billBalanceAdjustments(data.bills, data.billPeriods, data.household.timezone, new Date(NOW))
    for (const [memberId, net] of netBalances(data, true, NOW)) expect(net).toBe(adjustments.get(memberId) ?? 0)
  })

  it('trusts the database view for live data', () => {
    expect(moneyByMember(data, false, NOW).get(ME)).toEqual({ paidCents: 0, usedCents: 0, netCents: 0, fundOwedCents: 0 })
  })

  it('groups a month by category, largest first', () => {
    const { totalCents, categories } = categoryTotals(data, '2026-03')
    expect(totalCents).toBe(208_000)
    expect(categories.map(item => [item.category, item.amountCents])).toEqual([['rent', 200_000], ['groceries', 8_000]])
    expect(categories.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1)
    expect(categoryTotals(data, '2026-03', 'member-maya').totalCents).toBe(52_000)
  })

  it('runs a total through the month with bills on their due date', () => {
    const curve = spendCurve(data, '2026-03', NOW)
    expect(curve.days).toBe(31)
    expect(curve.through).toBe(11)
    expect(curve.cumulative[3]).toBe(0)
    expect(curve.cumulative[4]).toBe(8_000)
    expect(curve.cumulative[18]).toBe(8_000)
    expect(curve.cumulative[19]).toBe(208_000)
    expect(curve.totalCents).toBe(monthlySpending(data, '2026-03').reduce((sum, entry) => sum + entry.amountCents, 0))
  })

  it('draws a past month whole and a future month not at all', () => {
    expect(spendCurve(data, '2026-02', NOW).through).toBe(28)
    expect(spendCurve(data, '2026-04', NOW).through).toBe(0)
  })
})

describe('axisMax', () => {
  it('rounds up to four tidy steps', () => {
    expect(axisMax(336_136)).toBe(400_000)
    expect(axisMax(7_236)).toBe(8_000)
    expect(axisMax(100)).toBe(100)
    expect(axisMax(101)).toBe(200)
    expect(axisMax(0)).toBe(4)
  })
})
