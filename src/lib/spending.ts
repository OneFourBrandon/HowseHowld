import type { AppSnapshot, ExpenseCategory } from '../types'
import { allocateBillShares } from './shares'
import { dateKeyInTimeZone } from './utils'

export type SpendingCategory = ExpenseCategory | 'rent' | 'insurance'
export interface SpendingEntry {
  id: string
  title: string
  date: string
  category: SpendingCategory
  amountCents: number
}

// Spending measures consumption, independently of who paid or later settled up.
export function monthlySpending(data: AppSnapshot, month: string, memberId?: string): SpendingEntry[] {
  const entries: SpendingEntry[] = []
  for (const expense of data.expenses) {
    if (expense.reversed) continue
    const date = dateKeyInTimeZone(new Date(expense.purchasedAt), data.household.timezone)
    if (date.slice(0, 7) !== month) continue
    const amountCents = memberId == null ? expense.amountCents : expense.beneficiaries
      .filter(share => share.memberId === memberId).reduce((sum, share) => sum + share.amountCents, 0)
    if (amountCents > 0) entries.push({ id: `expense:${expense.id}`, title: expense.title, date, category: expense.category, amountCents })
  }
  for (const period of data.billPeriods) {
    if (period.periodMonth.slice(0, 7) !== month || period.amountCents == null) continue
    const bill = data.bills.find(item => item.id === period.billId)
    if (!bill) continue
    const shares = period.shares?.length ? period.shares : allocateBillShares(period.amountCents, bill)
    const amountCents = memberId == null ? period.amountCents : shares
      .filter(share => share.memberId === memberId).reduce((sum, share) => sum + share.amountCents, 0)
    const category: SpendingCategory = bill.category === 'rent' || bill.category === 'insurance' || bill.category === 'other' ? bill.category : 'utilities'
    if (amountCents > 0) entries.push({ id: `bill:${period.id}`, title: bill.name, date: period.periodMonth.slice(0, 10), category, amountCents })
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date))
}
