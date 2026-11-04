import { describe, expect, it } from 'vitest'
import {
  claimDeadlineFor,
  claimForInfraction,
  claimOutcome,
  claimRewardFor,
  claimVoterIds,
  choresUpForGrabs,
  formatGracePeriod,
  graceEndsAt,
  isInGracePeriod,
  listNames,
  zonedMidnight,
} from './chores'
import { isInfractionReviewOpen } from './infractions'
import { taskCompletionAvailability } from './utils'
import type { AppSnapshot, ChoreClaim, Infraction, Member, TaskOccurrence } from '../types'

const member = (id: string, active = true) => ({ id, active }) as Member
const toronto = 'America/Toronto'

describe('chore grace period', () => {
  const occurrence = { status: 'assigned' as const, dueAt: '2026-08-04T03:59:00Z' }

  it('runs from the due time until the grace period ends', () => {
    expect(graceEndsAt(occurrence.dueAt, 240).toISOString()).toBe('2026-08-04T07:59:00.000Z')
    expect(isInGracePeriod(occurrence, 240, Date.parse('2026-08-04T03:58:00Z'))).toBe(false)
    expect(isInGracePeriod(occurrence, 240, Date.parse('2026-08-04T05:00:00Z'))).toBe(true)
    expect(isInGracePeriod(occurrence, 240, Date.parse('2026-08-04T07:59:00Z'))).toBe(true)
    expect(isInGracePeriod(occurrence, 240, Date.parse('2026-08-04T08:00:00Z'))).toBe(false)
  })

  it('never applies to finished chores or a zero grace period', () => {
    const during = Date.parse('2026-08-04T05:00:00Z')
    expect(isInGracePeriod({ ...occurrence, status: 'completed' }, 240, during)).toBe(false)
    expect(isInGracePeriod(occurrence, 0, during)).toBe(false)
  })

  it('lets the assignee finish after midnight while the grace period lasts', () => {
    // Due 11:59 PM Toronto on Aug 3; 2:00 AM on Aug 4 is inside a four hour grace period.
    const afterMidnight = new Date('2026-08-04T06:00:00Z')
    expect(taskCompletionAvailability('2026-08-03', occurrence.dueAt, toronto, afterMidnight, 240)).toBe('available')
    expect(taskCompletionAvailability('2026-08-03', occurrence.dueAt, toronto, new Date('2026-08-04T08:00:00Z'), 240)).toBe('expired')
    expect(taskCompletionAvailability('2026-08-03', occurrence.dueAt, toronto, afterMidnight)).toBe('expired')
  })

  it('describes the grace period in words', () => {
    expect(formatGracePeriod(0)).toBe('No grace period')
    expect(formatGracePeriod(240)).toBe('4 hours')
    expect(formatGracePeriod(90)).toBe('1 hour 30 minutes')
    expect(formatGracePeriod(15)).toBe('15 minutes')
  })
})

describe('claim window', () => {
  it('finds midnight in the household time zone', () => {
    expect(zonedMidnight('2026-08-05', toronto).toISOString()).toBe('2026-08-05T04:00:00.000Z')
    expect(zonedMidnight('2026-12-05', toronto).toISOString()).toBe('2026-12-05T05:00:00.000Z')
  })

  it('handles days when daylight saving time changes', () => {
    expect(zonedMidnight('2026-03-08', toronto).toISOString()).toBe('2026-03-08T05:00:00.000Z')
    expect(zonedMidnight('2026-03-09', toronto).toISOString()).toBe('2026-03-09T04:00:00.000Z')
    expect(zonedMidnight('2026-11-01', toronto).toISOString()).toBe('2026-11-01T04:00:00.000Z')
    expect(zonedMidnight('2026-11-02', toronto).toISOString()).toBe('2026-11-02T05:00:00.000Z')
  })

  it('starts the day after the gap where clocks skip midnight, like Postgres', () => {
    // Santiago skips 00:00-01:00 on Sept 6, 2026, so the day starts at 01:00 local.
    expect(zonedMidnight('2026-09-06', 'America/Santiago').toISOString()).toBe('2026-09-06T04:00:00.000Z')
  })

  it('closes at the end of the day after the chore was due', () => {
    expect(claimDeadlineFor('2026-08-03', toronto).toISOString()).toBe('2026-08-05T04:00:00.000Z')
  })
})

describe('claim rewards and votes', () => {
  it('pays $10, or the whole penalty when it is smaller', () => {
    expect(claimRewardFor(1000)).toBe(1000)
    expect(claimRewardFor(1500)).toBe(1000)
    expect(claimRewardFor(500)).toBe(500)
  })

  it('approves ties and empty votes and rejects only on more rejections', () => {
    expect(claimOutcome(0, 0)).toBe('approved')
    expect(claimOutcome(1, 1)).toBe('approved')
    expect(claimOutcome(2, 0)).toBe('approved')
    expect(claimOutcome(0, 1)).toBe('rejected')
    expect(claimOutcome(1, 2)).toBe('rejected')
  })

  it('lets only active roommates outside the claim vote', () => {
    const members = [member('ashton'), member('greg'), member('maya'), member('noah'), member('former', false)]
    expect(claimVoterIds(members, { claimerId: 'greg', assigneeId: 'ashton' })).toEqual(['maya', 'noah'])
  })

  it('uses the reviewers fixed at submission once the after photo is in', () => {
    const members = [member('ashton'), member('greg'), member('maya'), member('noah'), member('newcomer')]
    expect(claimVoterIds(members, { claimerId: 'greg', assigneeId: 'ashton', voterIds: ['maya', 'gone'] })).toEqual(['maya', 'gone'])
  })

  it('lists names the way a sentence would', () => {
    expect(listNames(['Noah'])).toBe('Noah')
    expect(listNames(['Noah', 'Maya'])).toBe('Noah and Maya')
    expect(listNames(['Noah', 'Maya', 'Liam'])).toBe('Noah, Maya, and Liam')
  })

  it('uses the live claim over an earlier lapsed one', () => {
    const lapsed = { id: 'old', infractionId: 'i', status: 'lapsed', createdAt: '2026-08-04T10:00:00Z' } as ChoreClaim
    const live = { id: 'new', infractionId: 'i', status: 'claimed', createdAt: '2026-08-04T12:00:00Z' } as ChoreClaim
    expect(claimForInfraction([lapsed, live], 'i')?.id).toBe('new')
    expect(claimForInfraction([lapsed], 'i')?.id).toBe('old')
    expect(claimForInfraction([lapsed], 'other')).toBeUndefined()
  })

  it('keeps an infraction under review while its claim is live', () => {
    const infraction = { status: 'pending', disputeDeadline: '2026-08-01T00:00:00Z' } as Infraction
    const now = Date.parse('2026-08-04T12:00:00Z')
    expect(isInfractionReviewOpen(infraction, now)).toBe(false)
    expect(isInfractionReviewOpen(infraction, now, { status: 'submitted' })).toBe(true)
    expect(isInfractionReviewOpen({ ...infraction, disputeDeadline: '2026-08-09T00:00:00Z' } as Infraction, now, { status: 'approved' })).toBe(false)
  })
})

describe('chores up for grabs', () => {
  const now = Date.parse('2026-08-04T12:00:00Z')
  const occurrence = {
    id: 'occ', taskId: 'task', taskTitle: 'Dishes', area: 'Kitchen', assigneeId: 'ashton',
    scheduledDate: '2026-08-03', dueAt: '2026-08-04T03:59:00Z', status: 'missed', reminderLabel: '',
  } as TaskOccurrence
  const infraction = {
    id: 'inf', occurrenceId: 'occ', memberId: 'ashton', taskTitle: 'Dishes', amountCents: 1500,
    status: 'pending', disputeDeadline: '2026-08-11T08:00:00Z', upholdVotes: [], excuseVotes: [],
  } as unknown as Infraction
  const snapshot = (overrides: Partial<AppSnapshot> = {}) => ({
    household: { timezone: toronto } as AppSnapshot['household'],
    members: [member('ashton'), member('greg'), member('maya')],
    occurrences: [occurrence],
    infractions: [infraction],
    choreClaims: [] as ChoreClaim[],
    ...overrides,
  })

  it('lists a missed chore with a capped reward until the window closes', () => {
    const [item] = choresUpForGrabs(snapshot(), now)
    expect(item.rewardCents).toBe(1000)
    expect(item.deadline.toISOString()).toBe('2026-08-05T04:00:00.000Z')
    expect(choresUpForGrabs(snapshot(), Date.parse('2026-08-05T04:00:00Z'))).toEqual([])
  })

  it('needs at least three active roommates', () => {
    expect(choresUpForGrabs(snapshot({ members: [member('ashton'), member('greg'), member('maya', false)] }), now)).toEqual([])
  })

  it('skips excused misses and claims that are already in review', () => {
    expect(choresUpForGrabs(snapshot({ infractions: [{ ...infraction, status: 'excused' }] }), now)).toEqual([])
    const submitted = { id: 'c', infractionId: 'inf', occurrenceId: 'occ', status: 'submitted', claimDeadline: '2026-08-05T04:00:00Z', createdAt: '2026-08-04T10:00:00Z' } as ChoreClaim
    expect(choresUpForGrabs(snapshot({ choreClaims: [submitted] }), now)).toEqual([])
  })

  it('shows the claimer their own claim while the house reviews it', () => {
    const submitted = { id: 'c', infractionId: 'inf', occurrenceId: 'occ', claimerId: 'greg', status: 'submitted', rewardCents: 1000, claimDeadline: '2026-08-05T04:00:00Z', voteDeadline: '2026-08-06T12:00:00Z', createdAt: '2026-08-04T10:00:00Z' } as ChoreClaim
    const [item] = choresUpForGrabs(snapshot({ choreClaims: [submitted] }), now, 'greg')
    expect(item.claim?.status).toBe('submitted')
    expect(item.deadline.toISOString()).toBe('2026-08-06T12:00:00.000Z')
    expect(choresUpForGrabs(snapshot({ choreClaims: [submitted] }), now, 'maya')).toEqual([])
  })

  it('keeps a claim that is waiting for its after photo', () => {
    const claimed = { id: 'c', infractionId: 'inf', occurrenceId: 'occ', status: 'claimed', rewardCents: 1000, claimDeadline: '2026-08-05T04:00:00Z', createdAt: '2026-08-04T10:00:00Z' } as ChoreClaim
    expect(choresUpForGrabs(snapshot({ choreClaims: [claimed] }), now)[0].claim?.id).toBe('c')
  })
})
