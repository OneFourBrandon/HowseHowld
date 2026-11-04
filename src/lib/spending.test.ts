import { describe, expect, it } from 'vitest'
import { demoSnapshot } from '../data/demo'
import { cents, toIso } from './utils'
import { monthlySpending } from './spending'

function snapshot() {
  const data = structuredClone(demoSnapshot)
  data.expenses = [{ ...data.expenses[0], category: 'dining', purchasedAt: toIso(new Date('2026-11-01T02:00:00Z')),
    amountCents: cents(4000), payers: [{ memberId: 'member-brandon', amountCents: cents(4000) }],
    beneficiaries: [{ memberId: 'member-brandon', amountCents: cents(1000) }, { memberId: 'member-noah', amountCents: cents(3000) }] }]
  data.billPeriods = [{ ...data.billPeriods[0], periodMonth: '2026-10-01', amountCents: cents(8000),
    shares: [{ memberId: 'member-brandon', amountCents: cents(2000) }, { memberId: 'member-noah', amountCents: cents(6000) }] }]
  return data
}

describe('monthly spending', () => {
  it('uses the household month and separates spending shares from payer credits', () => {
    const data = snapshot()
    expect(monthlySpending(data, '2026-11')).toEqual([])
    expect(monthlySpending(data, '2026-10').reduce((sum, item) => sum + item.amountCents, 0)).toBe(12000)
    expect(monthlySpending(data, '2026-10', 'member-brandon').map(item => item.amountCents)).toEqual([1000, 2000])
    expect(monthlySpending(data, '2026-10', 'member-noah').map(item => item.amountCents)).toEqual([3000, 6000])
    expect(monthlySpending(data, '2026-10', 'member-maya')).toEqual([])
  })

  it('excludes reversed purchases, zero amounts, unknown prices and transfers', () => {
    const data = snapshot()
    data.expenses[0].reversed = true
    data.billPeriods[0].amountCents = undefined
    expect(monthlySpending(data, '2026-10')).toEqual([])
    data.expenses[0].reversed = false
    data.expenses[0].amountCents = cents(0)
    data.billPeriods[0].amountCents = cents(0)
    data.billPeriods[0].shares = []
    expect(monthlySpending(data, '2026-10')).toEqual([])
  })

  it('groups utility bills with utility purchases and falls back to allocated shares', () => {
    const data = snapshot()
    data.bills[0].category = 'electricity'
    data.billPeriods[0].shares = undefined
    expect(monthlySpending(data, '2026-10', 'member-brandon')[1]).toMatchObject({ category: 'utilities', amountCents: 2000 })
  })
})
