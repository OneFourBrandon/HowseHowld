import { describe, expect, it } from 'vitest'
import { allocateBillShares, billBalanceAdjustments } from './shares'
import { cents, toIso } from './utils'
import type { HouseholdBill, HouseholdBillPeriod } from '../types'

const bill: HouseholdBill = {
  id: 'bill', householdId: 'house', name: 'Rent', category: 'rent', amountCents: cents(20001),
  payeeMemberId: 'a',
  dueDay: 1, reminderDaysBefore: [], active: true,
  memberIds: ['a', 'b'], memberShares: [{ memberId: 'a', shareWeight: 12000 }, { memberId: 'b', shareWeight: 8000 }],
}

describe('bill shares and owing', () => {
  it('splits every cent by configured weights', () => {
    const shares = allocateBillShares(20001, bill)
    expect(shares.reduce((sum, share) => sum + share.amountCents, 0)).toBe(20001)
    expect(shares.map(share => share.amountCents)).toEqual([12001, 8000])
  })

  it('credits the payer and debits only unpaid roommates without changing older payees', () => {
    const periods: HouseholdBillPeriod[] = [
      { id: 'old', billId: 'bill', payeeMemberId: 'b', periodMonth: '2026-08-01', dueAt: toIso(new Date('2026-08-01T13:00:00Z')),
        amountCents: cents(20000), paidMemberIds: [], shares: [{ memberId: 'a', amountCents: cents(12000) }, { memberId: 'b', amountCents: cents(8000) }] },
      { id: 'current', billId: 'bill', payeeMemberId: 'a', periodMonth: '2026-09-01', dueAt: toIso(new Date('2026-09-01T13:00:00Z')),
        amountCents: cents(20000), paidMemberIds: [], shares: [{ memberId: 'a', amountCents: cents(12000) }, { memberId: 'b', amountCents: cents(8000) }] },
      { id: 'future', billId: 'bill', payeeMemberId: 'a', periodMonth: '2026-10-01', dueAt: toIso(new Date('2026-10-01T13:00:00Z')),
        amountCents: cents(20000), paidMemberIds: [], shares: [{ memberId: 'a', amountCents: cents(12000) }, { memberId: 'b', amountCents: cents(8000) }] },
      { id: 'pending', billId: 'bill', payeeMemberId: 'a', periodMonth: '2026-09-01', dueAt: toIso(new Date('2026-09-01T13:00:00Z')),
        paidMemberIds: [], shares: [] },
    ]
    const before = billBalanceAdjustments([bill], periods, 'America/Toronto', new Date('2026-09-25T12:00:00Z'))
    expect(before.get('a')).toBe(-4000)
    expect(before.get('b')).toBe(4000)
    periods[1].paidMemberIds.push('b')
    const after = billBalanceAdjustments([bill], periods, 'America/Toronto', new Date('2026-09-25T12:00:00Z'))
    expect(after.get('a')).toBe(-4000)
    expect(after.get('b')).toBe(4000)
  })
})
