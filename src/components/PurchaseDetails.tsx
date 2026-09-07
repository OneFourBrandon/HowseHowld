import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { expenseBreakdown, shareOfTotal } from '../lib/shares'
import { formatMoney } from '../lib/utils'
import { getExpenseCategory } from '../lib/expenseCategories'
import { useAppData } from '../state/AppDataContext'
import type { Expense } from '../types'
import { Avatar, Button, Modal } from './ui'
import { ShareBar, ShareDonut, ShareRow } from './ShareBreakdown'

export function PurchaseDetails({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const { data, busy, updateExpenseAmount } = useAppData()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState((expense.amountCents / 100).toFixed(2))
  const [expectedAmount, setExpectedAmount] = useState(expense.amountCents)
  const [error, setError] = useState('')
  const breakdown = expenseBreakdown(expense, data.members, data.household.currentMemberId)
  const monthTotal = data.expenses.filter(e => !e.reversed && e.purchasedAt.slice(0, 7) === expense.purchasedAt.slice(0, 7)).reduce((sum, e) => sum + e.amountCents, 0)
  const canEdit = !expense.reversed && expense.createdBy === data.household.currentMemberId
  return <Modal open onClose={onClose} title={expense.title} description={getExpenseCategory(expense.category).description}>
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-5">
        <ShareDonut breakdown={breakdown} size={136} label={formatMoney(breakdown.mine?.owedCents ?? 0)} sublabel="your share" />
        <div><strong className="block text-3xl">{formatMoney(expense.amountCents)}</strong>
          <p className="mt-1 text-xs text-(--muted)">{new Date(expense.purchasedAt).toLocaleString()}</p>
          <p className="mt-2 text-sm">Split {expense.beneficiaries.length} ways{expense.reversed ? ' · Reversed' : ''}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[['Your share', formatMoney(breakdown.mine?.owedCents ?? 0)], ['Your net', formatMoney(breakdown.mine?.netCents ?? 0, true)], ['Month share', shareOfTotal(expense.amountCents, monthTotal).toFixed(1) + '%']].map(([label, value]) =>
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
      {canEdit && (editing ? <form className="grid gap-3 border-t border-(--line) pt-4" onSubmit={async event => {
        event.preventDefault()
        setError('')
        try { await updateExpenseAmount(expense.id, Math.round(Number(amount) * 100), expectedAmount); setEditing(false) }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update purchase.') }
      }}>
        <label>Correct total (including tax)<input aria-label="Correct purchase total" inputMode="decimal" value={amount} onChange={event => { if (/^\d*(\.\d{0,2})?$/.test(event.target.value)) setAmount(event.target.value) }} required /></label>
        <p className="text-xs text-(--muted)">Everyone keeps the same proportion of the purchase. Shares and balances update together.</p>
        {error && <p role="alert" className="text-sm text-(--coral)">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button disabled={busy === 'expense:edit:' + expense.id || Number(amount) <= 0}>Save total</Button></div>
      </form> : <Button variant="secondary" onClick={() => {
        setAmount((expense.amountCents / 100).toFixed(2))
        setExpectedAmount(expense.amountCents)
        setEditing(true)
      }}><Pencil size={16} /> Edit price</Button>)}
    </div>
  </Modal>
}
