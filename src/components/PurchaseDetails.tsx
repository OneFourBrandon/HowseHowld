import { useState } from 'react'
import { Pencil, UserRound, UsersRound } from 'lucide-react'
import { expenseBreakdown, shareOfTotal } from '../lib/shares'
import { cents, formatMoney, splitEvenly } from '../lib/utils'
import { getExpenseCategory } from '../lib/expenseCategories'
import { useAppData } from '../state/AppDataContext'
import type { Expense } from '../types'
import { Avatar, Button, Modal } from './ui'
import { ShareBar, ShareDonut, ShareRow } from './ShareBreakdown'
import { cn } from '../lib/cn'

function shareAmountFields(expense: Expense) {
  return Object.fromEntries(expense.beneficiaries.map(share => [share.memberId, (share.amountCents / 100).toFixed(2)]))
}

function hasEqualShares(expense: Expense) {
  const equal = splitEvenly(expense.amountCents, expense.beneficiaries.map(share => share.memberId))
  return equal.every(share => expense.beneficiaries.some(current => current.memberId === share.memberId && current.amountCents === share.amountCents))
}

export function PurchaseDetails({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const { data, busy, updateExpenseAmount, updateExpenseShares } = useAppData()
  const [editingAmount, setEditingAmount] = useState(false)
  const [editingShares, setEditingShares] = useState(false)
  const [amount, setAmount] = useState((expense.amountCents / 100).toFixed(2))
  const [expectedAmount, setExpectedAmount] = useState(expense.amountCents)
  const [beneficiaries, setBeneficiaries] = useState(() => new Set(expense.beneficiaries.map(share => share.memberId)))
  const [customShares, setCustomShares] = useState(() => !hasEqualShares(expense))
  const [shareAmounts, setShareAmounts] = useState<Record<string, string>>(() => shareAmountFields(expense))
  const [error, setError] = useState('')
  const breakdown = expenseBreakdown(expense, data.members, data.household.currentMemberId)
  const monthTotal = data.expenses.filter(e => !e.reversed && e.purchasedAt.slice(0, 7) === expense.purchasedAt.slice(0, 7)).reduce((sum, e) => sum + e.amountCents, 0)
  const canEdit = !expense.reversed && expense.createdBy === data.household.currentMemberId
  const beneficiaryPreview = customShares
    ? [...beneficiaries].map(memberId => ({ memberId, amountCents: cents(Math.round(Number(shareAmounts[memberId] || 0) * 100)) }))
    : splitEvenly(expense.amountCents, [...beneficiaries])
  const shareTotal = beneficiaryPreview.reduce((sum, share) => sum + share.amountCents, 0)
  const openShareEditor = () => {
    setBeneficiaries(new Set(expense.beneficiaries.map(share => share.memberId)))
    setCustomShares(!hasEqualShares(expense))
    setShareAmounts(shareAmountFields(expense))
    setError('')
    setEditingShares(true)
  }
  return <Modal open onClose={onClose} title={expense.title} description={getExpenseCategory(expense.category).description}>
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-5">
        <ShareDonut breakdown={breakdown} size={132} label={`${breakdown.mine?.percent.toFixed(breakdown.mine.percent < 10 ? 1 : 0) ?? 0}%`} sublabel="of purchase" />
        <div><strong className="block text-3xl">{formatMoney(expense.amountCents)}</strong>
          <p className="mt-1 text-xs text-(--muted)">{new Date(expense.purchasedAt).toLocaleString()}</p>
          <p className="mt-2 text-sm">Split {expense.beneficiaries.length} ways{expense.reversed ? ' · Reversed' : ''}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[["Your net", formatMoney(breakdown.mine?.netCents ?? 0, true)], ['Month share', shareOfTotal(expense.amountCents, monthTotal).toFixed(1) + '%']].map(([label, value]) =>
          <div key={label} className="min-w-0 rounded-xl border border-(--line) bg-(--sage-2) p-3"><span className="block text-[.65rem] uppercase text-(--muted)">{label}</span><strong className="mt-1 block text-base tabular-nums">{value}</strong></div>)}
      </div>
      <section><h3 className="mb-2 text-sm font-bold">Who paid</h3>
        {breakdown.payers.map(share => <div key={share.member.id} className="flex items-center gap-3 rounded-xl border border-(--line) p-3">
          <Avatar initials={share.member.initials} color={share.member.color} imageUrl={share.member.avatarUrl} size="sm" />
          <span className="flex-1 text-sm">{share.member.displayName}</span><strong className="text-sm text-(--green)">{formatMoney(share.paidCents)}</strong>
        </div>)}
      </section>
      <section><h3 className="mb-3 text-sm font-bold">Who owes what</h3>
        <ShareBar breakdown={breakdown} />
        <div className="mt-2 divide-y divide-(--line)">{breakdown.shares.map(share => <ShareRow key={share.member.id} share={share} />)}</div>
      </section>
      {canEdit && <div className="grid gap-2 border-t border-(--line) pt-4">
      {editingAmount ? <form className="grid gap-3" onSubmit={async event => {
        event.preventDefault()
        setError('')
        try { await updateExpenseAmount(expense.id, Math.round(Number(amount) * 100), expectedAmount); setEditingAmount(false) }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update purchase.') }
      }}>
        <label>Correct total (including tax)<input aria-label="Correct purchase total" inputMode="decimal" value={amount} onChange={event => { if (/^\d*(\.\d{0,2})?$/.test(event.target.value)) setAmount(event.target.value) }} required /></label>
        <p className="text-xs text-(--muted)">Everyone keeps the same proportion of the purchase. Shares and balances update together.</p>
        {error && <p role="alert" className="text-sm text-(--coral)">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingAmount(false)}>Cancel</Button><Button disabled={busy === 'expense:edit:' + expense.id || Number(amount) <= 0}>Save total</Button></div>
      </form> : <Button variant="secondary" onClick={() => {
        setAmount((expense.amountCents / 100).toFixed(2))
        setExpectedAmount(expense.amountCents)
        setEditingShares(false)
        setError('')
        setEditingAmount(true)
      }}><Pencil size={16} /> Edit price</Button>}

      {editingShares ? <form className="mt-1 grid gap-3 rounded-xl bg-(--surface) p-3" onSubmit={async event => {
        event.preventDefault()
        setError('')
        if (!beneficiaryPreview.length) { setError('Choose at least one person.'); return }
        if (beneficiaryPreview.some(share => share.amountCents < 1) || shareTotal !== expense.amountCents) { setError('Shares must be positive and equal the purchase total.'); return }
        try { await updateExpenseShares(expense.id, beneficiaryPreview, expense.amountCents); setEditingShares(false) }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update shares.') }
      }}>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-(--line-strong) bg-(--surface-strong)">
          <button className={cn('inline-flex min-h-10 items-center justify-center gap-2 border-0 bg-transparent px-2 text-xs font-semibold', !customShares && 'bg-(--sage-2)! text-(--forest)')} type="button" onClick={() => setCustomShares(false)}><UsersRound size={16} /> Equal split</button>
          <button className={cn('inline-flex min-h-10 items-center justify-center gap-2 border-0 border-l border-(--line) bg-transparent px-2 text-xs font-semibold', customShares && 'bg-(--sage-2)! text-(--forest)')} type="button" onClick={() => setCustomShares(true)}><UserRound size={16} /> Custom shares</button>
        </div>
        <div className="grid gap-2">
          {data.members.map(member => {
            const selected = beneficiaries.has(member.id)
            return <div className={cn('grid min-h-12 grid-cols-[minmax(0,1fr)_112px] items-center gap-2 rounded-lg border border-(--line) bg-(--surface-strong) px-3 max-[480px]:grid-cols-1 max-[480px]:py-2', selected && 'border-(--line-strong)')} key={member.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-(--ink)">
                <input type="checkbox" checked={selected} onChange={event => setBeneficiaries(current => { const next = new Set(current); if (event.target.checked) next.add(member.id); else next.delete(member.id); return next })} />
                <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                <span className="truncate">{member.displayName}</span>
              </label>
              {customShares && selected && <label className="flex items-center rounded-lg border border-(--line) bg-(--surface-strong) px-2 text-(--muted)">$<input className="mt-0! min-w-0 border-0! bg-transparent! px-1.5 py-2 text-right text-(--ink) shadow-none! focus:shadow-none!" type="text" inputMode="decimal" aria-label={`${member.displayName} share amount`} value={shareAmounts[member.id] ?? ''} onChange={event => { if (/^\d*(\.\d{0,2})?$/.test(event.target.value)) setShareAmounts(current => ({ ...current, [member.id]: event.target.value })) }} /></label>}
            </div>
          })}
        </div>
        <div className="flex items-center justify-between text-xs"><span className="text-(--muted)">Share total</span><strong className={cn('tabular-nums', shareTotal !== expense.amountCents && 'text-(--coral)')}>{formatMoney(shareTotal)} / {formatMoney(expense.amountCents)}</strong></div>
        {error && <p role="alert" className="text-sm text-(--coral)">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingShares(false)}>Cancel</Button><Button disabled={busy === 'expense:shares:' + expense.id || !beneficiaryPreview.length || shareTotal !== expense.amountCents}>Save shares</Button></div>
      </form> : <Button variant="secondary" disabled={editingAmount} onClick={() => { setEditingAmount(false); openShareEditor() }}><UsersRound size={16} /> Edit shares</Button>}
      </div>}
    </div>
  </Modal>
}
