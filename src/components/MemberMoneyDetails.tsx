import { useState } from 'react'
import { useAppData } from '../state/AppDataContext'
import { allocateBillShares } from '../lib/shares'
import { dateKeyInTimeZone, formatMoney } from '../lib/utils'
import { Avatar, Badge, Modal } from './ui'
import type { Member } from '../types'

export function MemberMoneyDetails({ member, netCents, onClose }: { member: Member; netCents: number; onClose: () => void }) {
  const { data } = useAppData()
  const [filter, setFilter] = useState('all')
  const month = dateKeyInTimeZone(new Date(), data.household.timezone).slice(0, 7)
  const name = (id: string) => data.members.find(person => person.id === id)?.displayName ?? 'Household member'
  const rows: { id: string; kind: string; title: string; date: string; detail: string; amount: number; status?: string }[] = []
  for (const expense of data.expenses) {
    const paid = expense.payers.filter(share => share.memberId === member.id).reduce((sum, share) => sum + share.amountCents, 0)
    const used = expense.beneficiaries.filter(share => share.memberId === member.id).reduce((sum, share) => sum + share.amountCents, 0)
    if (!paid && !used) continue
    rows.push({ id: `expense:${expense.id}`, kind: 'Purchases', title: expense.title, date: expense.purchasedAt,
      detail: `Paid ${formatMoney(paid)} · Share ${formatMoney(used)}`, amount: expense.reversed ? 0 : paid - used, status: expense.reversed ? 'Deleted' : undefined })
  }
  for (const period of data.billPeriods) {
    const bill = data.bills.find(item => item.id === period.billId)
    if (!bill) continue
    const payee = period.payeeMemberId ?? bill.payeeMemberId
    const shares = period.shares?.length ? period.shares : allocateBillShares(period.amountCents ?? 0, bill)
    const ownShare = shares.find(share => share.memberId === member.id)?.amountCents ?? 0
    if (member.id !== payee && !shares.some(share => share.memberId === member.id)) continue
    const future = period.periodMonth.slice(0, 7) > month
    const pending = period.amountCents == null
    const credit = shares.filter(share => share.memberId !== payee).reduce((sum, share) => sum + share.amountCents, 0)
    rows.push({ id: `bill:${period.id}`, kind: 'Bills', title: bill.name, date: period.periodMonth,
      detail: member.id === payee ? `Paid ${formatMoney(period.amountCents ?? 0)} · Own share ${formatMoney(ownShare)}` : `Share ${formatMoney(ownShare)} · Owed to ${name(payee)}`,
      amount: pending || future ? 0 : member.id === payee ? credit : -ownShare, status: pending ? 'Price pending' : future ? 'Upcoming' : undefined })
  }
  for (const payment of data.settlements) {
    if (payment.fromMemberId !== member.id && payment.toMemberId !== member.id) continue
    const sent = payment.fromMemberId === member.id
    rows.push({ id: `payment:${payment.id}`, kind: 'Payments', title: `${sent ? 'Sent to' : 'Received from'} ${name(sent ? payment.toMemberId : payment.fromMemberId)}`, date: payment.createdAt,
      detail: `${formatMoney(payment.amountCents)}${payment.note ? ` · ${payment.note}` : ''}`, amount: payment.status === 'confirmed' ? (sent ? payment.amountCents : -payment.amountCents) : 0, status: payment.status })
  }
  for (const infraction of data.infractions.filter(item => item.memberId === member.id)) {
    rows.push({ id: `penalty:${infraction.id}`, kind: 'Penalties', title: infraction.taskTitle,
      date: infraction.resolvedAt ?? infraction.disputeDeadline,
      detail: `Penalty ${formatMoney(infraction.amountCents)}`, status: infraction.status,
      amount: infraction.status === 'upheld' || infraction.status === 'paid' ? -infraction.amountCents : 0 })
  }
  for (const payment of data.fundPayments.filter(item => item.memberId === member.id)) {
    rows.push({ id: `fund:${payment.id}`, kind: 'Payments', title: 'Paid into penalty account', date: payment.createdAt,
      detail: formatMoney(payment.amountCents), status: payment.status, amount: payment.status === 'confirmed' ? payment.amountCents : 0 })
  }
  const remainder = netCents - rows.reduce((sum, row) => sum + row.amount, 0)
  const visible = rows.filter(row => filter === 'all' || row.kind === filter).sort((a, b) => b.date.localeCompare(a.date))
  return <Modal open onClose={onClose} title={`${member.displayName}'s balance`} description="All months. Positive amounts add credit; negative amounts add owing.">
    <div className="flex items-center gap-4 rounded-xl bg-(--sage-2) p-4">
      <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="md" />
      <div><span className="block text-xs text-(--muted)">{netCents > 0 ? 'Is owed' : netCents < 0 ? 'Owes' : 'Settled'}</span><strong className="text-3xl tabular-nums">{formatMoney(Math.abs(netCents))}</strong></div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter balance history">
      {['all', 'Purchases', 'Bills', 'Payments', 'Penalties'].map(option => <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)} className={`rounded-full border border-(--line) px-3 py-2 text-xs font-semibold ${filter === option ? 'bg-(--forest) text-white' : 'bg-(--surface) text-(--ink)'}`}>{option === 'all' ? 'Everything' : option}</button>)}
    </div>
    <div className="mt-3 divide-y divide-(--line)">
      {visible.map(row => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-4">
        <div className="min-w-0"><span className="text-[.68rem] text-(--muted)">{row.kind} · {row.date.slice(0, 10)}</span><strong className="block text-sm">{row.title}</strong><p className="mt-1 break-words text-xs text-(--muted)">{row.detail}</p>{row.status && <div className="mt-2"><Badge>{row.status}</Badge></div>}</div>
        <strong className={`text-sm tabular-nums ${row.amount < 0 ? 'text-(--coral)' : 'text-(--forest)'}`}>{formatMoney(row.amount, true)}</strong>
      </div>)}
      {!visible.length && <p className="py-8 text-center text-sm text-(--muted)">No {filter === 'all' ? 'activity' : filter.toLowerCase()} yet.</p>}
    </div>
    {remainder !== 0 && <div className="mt-3 flex justify-between gap-4 rounded-xl bg-(--surface) p-3 text-xs"><span>Other ledger adjustments<br /><span className="text-(--muted)">Balance entries outside the activity shown above</span></span><strong className="tabular-nums">{formatMoney(remainder, true)}</strong></div>}
    <p className="mt-4 text-xs text-(--muted)">Pending and rejected payments do not change the balance. Upcoming bills count when their month begins.</p>
  </Modal>
}
