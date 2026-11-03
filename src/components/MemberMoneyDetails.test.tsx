import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { demoSnapshot } from '../data/demo'
import { cents, toIso } from '../lib/utils'
import { MemberMoneyDetails } from './MemberMoneyDetails'

const { state } = vi.hoisted(() => ({ state: { data: {} as typeof demoSnapshot } }))
vi.mock('../state/AppDataContext', () => ({ useAppData: () => state }))

describe('member money details', () => {
  it('hides zero history rows but includes real spending with zero net balance in categories', () => {
    state.data = structuredClone(demoSnapshot)
    const member = state.data.members[0]
    state.data.expenses = [{ ...state.data.expenses[0], title: 'Solo takeout', category: 'dining',
      purchasedAt: toIso(new Date('2026-10-10T16:00:00Z')), amountCents: cents(2500),
      payers: [{ memberId: member.id, amountCents: cents(2500) }], beneficiaries: [{ memberId: member.id, amountCents: cents(2500) }] }]
    state.data.billPeriods = [{ ...state.data.billPeriods[0], amountCents: undefined }]
    state.data.infractions = []
    render(<MemberMoneyDetails member={member} netCents={0} initialMonth="2026-10" onClose={() => {}} />)
    expect(screen.getByText('No non-zero activity yet.')).toBeVisible()
    expect(screen.queryByText('Monthly rent')).not.toBeInTheDocument()
    expect(screen.queryByText('Received from Noah')).not.toBeInTheDocument()
    const summary = within(screen.getByRole('region', { name: 'Monthly spending' }))
    fireEvent.click(summary.getByRole('button', { name: /Dining out/ }))
    expect(summary.getByText('Solo takeout')).toBeVisible()
    expect(summary.getByText('Dining out · $25.00')).toBeVisible()
    fireEvent.change(summary.getByLabelText('Spending month'), { target: { value: '2026-09' } })
    expect(summary.queryByText('Solo takeout')).not.toBeInTheDocument()
    expect(summary.getByText('No spending in dining out this month.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }))
    expect(screen.getByText('No non-zero payments yet.')).toBeVisible()
  })
})
