import { describe, expect, it } from 'vitest'
import { isInfractionReviewOpen } from './infractions'
import type { Infraction } from '../types'

describe('infraction review window', () => {
  const now = Date.parse('2026-09-08T12:00:00Z')
  const infraction = { status: 'disputed', disputeDeadline: '2026-09-09T12:00:00Z' } as Infraction
  it('counts pending and disputed reviews before the deadline', () => {
    expect(isInfractionReviewOpen(infraction, now)).toBe(true)
    expect(isInfractionReviewOpen({ ...infraction, status: 'pending' }, now)).toBe(true)
  })
  it('closes at the deadline even before the scheduler updates the status', () => {
    expect(isInfractionReviewOpen(infraction, Date.parse(infraction.disputeDeadline))).toBe(false)
  })
  it('excludes resolved reviews even with a future deadline', () => {
    for (const status of ['upheld', 'excused', 'paid'] as const) {
      expect(isInfractionReviewOpen({ ...infraction, status }, now)).toBe(false)
    }
  })
})
