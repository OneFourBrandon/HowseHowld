import { describe, expect, it } from 'vitest'
import {
  blockerIds,
  isLedgerBalanced,
  nextRotationMember,
  penaltyForPriorMisses,
  resolvePeerVote,
  splitEvenly,
} from './utils'

describe('shared expense splitting', () => {
  it('distributes every cent deterministically', () => {
    const shares = splitEvenly(1001, ['member-c', 'member-a', 'member-b'])
    expect(shares).toEqual([
      { memberId: 'member-a', amountCents: 334 },
      { memberId: 'member-b', amountCents: 334 },
      { memberId: 'member-c', amountCents: 333 },
    ])
    expect(shares.reduce((sum, share) => sum + share.amountCents, 0)).toBe(1001)
  })
})

describe('penalty escalation', () => {
  it.each([
    [0, 1000],
    [1, 1500],
    [2, 2000],
    [4, 3000],
    [20, 3000],
  ])('maps %i prior misses to %i cents', (prior, expected) => {
    expect(penaltyForPriorMisses(prior)).toBe(expected)
  })
})

describe('driveway blockers', () => {
  it('returns only cars between a vehicle and the street', () => {
    expect(blockerIds(['street', 'middle', 'back'], 'back')).toEqual([
      'street',
      'middle',
    ])
    expect(blockerIds(['street', 'middle', 'back'], 'street')).toEqual([])
  })
})

describe('independent task rotations', () => {
  it('wraps deterministically without sharing state between tasks', () => {
    expect(nextRotationMember(['a', 'b', 'c'], 0)).toBe('a')
    expect(nextRotationMember(['a', 'b', 'c'], 4)).toBe('b')
    expect(nextRotationMember(['c', 'a'], 4)).toBe('c')
    expect(nextRotationMember([], 3)).toBeNull()
  })
})

describe('peer voting', () => {
  it('resolves as soon as either side reaches two votes', () => {
    expect(resolvePeerVote(2, 0)).toBe('upheld')
    expect(resolvePeerVote(0, 2)).toBe('excused')
    expect(resolvePeerVote(1, 1)).toBe('disputed')
  })
})

describe('double-entry ledger', () => {
  it('accepts balanced postings and rejects an unbalanced cent', () => {
    expect(isLedgerBalanced([1001, -334, -334, -333])).toBe(true)
    expect(isLedgerBalanced([1001, -334, -334, -332])).toBe(false)
  })
})

describe('Toronto daylight-saving boundaries', () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  it('keeps a 23:59 local deadline while its UTC offset changes', () => {
    expect(formatter.format(new Date('2026-03-08T04:59:00Z'))).toContain('03-07, 23:59')
    expect(formatter.format(new Date('2026-03-09T03:59:00Z'))).toContain('03-08, 23:59')
  })
})
