import type {
  Expense,
  HouseholdBill,
  HouseholdBillPeriod,
  Member,
  UUID,
} from '../types'
import { splitEvenly } from './utils'

/** One person's stake in a single item: what they put in, what they owe, and the gap. */
export interface MemberShare {
  member: Member
  /** What this person paid toward the item. */
  paidCents: number
  /** What this person is on the hook for. */
  owedCents: number
  /** paidCents - owedCents. Positive means the item left them up. */
  netCents: number
  /** owedCents as a percentage of the item total. */
  percent: number
  isCurrentMember: boolean
  /** Bills only: has this person ticked their payment off for the period. */
  settled?: boolean
}

export interface ShareBreakdown {
  totalCents: number
  shares: MemberShare[]
  /** Every share is the same size, so the item can be described as "split N ways". */
  evenSplit: boolean
  /** The share belonging to the signed-in member, when they have one. */
  mine?: MemberShare
  payers: MemberShare[]
}

function assemble(
  totalCents: number,
  rows: Array<{ member: Member; paidCents: number; owedCents: number; settled?: boolean }>,
  currentMemberId: UUID,
): ShareBreakdown {
  const shares: MemberShare[] = rows
    .map((row) => ({
      member: row.member,
      paidCents: row.paidCents,
      owedCents: row.owedCents,
      netCents: row.paidCents - row.owedCents,
      percent: totalCents > 0 ? (row.owedCents / totalCents) * 100 : 0,
      isCurrentMember: row.member.id === currentMemberId,
      settled: row.settled,
    }))
    .sort((left, right) => right.owedCents - left.owedCents)

  const owedAmounts = shares.filter((share) => share.owedCents > 0).map((share) => share.owedCents)
  // Deterministic cent splitting leaves at most a 1c spread across an even split.
  const evenSplit =
    owedAmounts.length > 1 && Math.max(...owedAmounts) - Math.min(...owedAmounts) <= 1

  return {
    totalCents,
    shares,
    evenSplit,
    mine: shares.find((share) => share.isCurrentMember),
    payers: shares.filter((share) => share.paidCents > 0),
  }
}

export function expenseBreakdown(
  expense: Expense,
  members: Member[],
  currentMemberId: UUID,
): ShareBreakdown {
  const involved = new Set<UUID>([
    ...expense.payers.map((share) => share.memberId),
    ...expense.beneficiaries.map((share) => share.memberId),
  ])

  const rows = members
    .filter((member) => involved.has(member.id))
    .map((member) => ({
      member,
      paidCents: expense.payers.find((share) => share.memberId === member.id)?.amountCents ?? 0,
      owedCents:
        expense.beneficiaries.find((share) => share.memberId === member.id)?.amountCents ?? 0,
    }))

  return assemble(expense.amountCents, rows, currentMemberId)
}

export function billBreakdown(
  bill: HouseholdBill,
  period: HouseholdBillPeriod | undefined,
  members: Member[],
  currentMemberId: UUID,
): ShareBreakdown {
  const totalCents = period?.amountCents ?? bill.amountCents ?? 0
  const split = splitEvenly(totalCents, bill.memberIds)

  const rows = members
    .filter((member) => bill.memberIds.includes(member.id))
    .map((member) => {
      const owedCents = split.find((share) => share.memberId === member.id)?.amountCents ?? 0
      const settled = Boolean(period?.paidMemberIds.includes(member.id))
      return { member, paidCents: settled ? owedCents : 0, owedCents, settled }
    })

  return assemble(totalCents, rows, currentMemberId)
}

/** Share of a running total, used for "this is 12% of the month" style stats. */
export function shareOfTotal(amountCents: number, totalCents: number) {
  if (totalCents <= 0) return 0
  return Math.min(100, (amountCents / totalCents) * 100)
}

const ordinals = ['1st', '2nd', '3rd']

export function ordinal(position: number) {
  return ordinals[position - 1] ?? `${position}th`
}
