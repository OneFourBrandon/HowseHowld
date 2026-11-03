import { useState } from 'react'
import { EXPENSE_CATEGORIES } from '../lib/expenseCategories'
import { monthlySpending, type SpendingCategory } from '../lib/spending'
import { formatMoney } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'

const categories = [
  ...EXPENSE_CATEGORIES,
  { value: 'rent' as const, label: 'Rent' },
  { value: 'insurance' as const, label: 'Insurance' },
]

export function SpendingSummary({ month, onMonthChange, memberId }: {
  month: string
  onMonthChange?: (month: string) => void
  memberId?: string
}) {
  const { data } = useAppData()
  const [category, setCategory] = useState<SpendingCategory | 'all'>('all')
  const entries = monthlySpending(data, month, memberId)
  const visible = entries.filter(entry => category === 'all' || entry.category === category)
  const total = entries.reduce((sum, entry) => sum + entry.amountCents, 0)
  const selectedTotal = visible.reduce((sum, entry) => sum + entry.amountCents, 0)
  const label = categories.find(item => item.value === category)?.label ?? 'All categories'

  return <section aria-label="Monthly spending" className="mt-4 rounded-xl border border-(--line) bg-(--surface) p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-semibold">Monthly spending</h3><p className="mt-1 text-xs text-(--muted)">{memberId ? 'Their share of purchases and bills' : 'Household purchases and bills'} · {month}</p></div>
      {onMonthChange && <label className="text-xs">Spending month<input aria-label="Spending month" type="month" value={month} onChange={event => { if (event.target.value) onMonthChange(event.target.value) }} /></label>}
    </div>
    <p className="mt-3 text-sm">Month total <strong className="tabular-nums">{formatMoney(total)}</strong></p>
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Spending categories">
      {[{ value: 'all' as const, label: 'All categories' }, ...categories].map(option => {
        const amount = option.value === 'all' ? total : entries.filter(entry => entry.category === option.value).reduce((sum, entry) => sum + entry.amountCents, 0)
        if (option.value !== 'all' && amount === 0 && category !== option.value) return null
        return <button key={option.value} type="button" aria-pressed={category === option.value} onClick={() => setCategory(option.value)} className={`rounded-xl border border-(--line) px-3 py-2 text-left text-xs ${category === option.value ? 'bg-(--forest) text-white' : 'bg-(--surface-strong) text-(--ink)'}`}><span className="block font-semibold">{option.label}</span><span className="tabular-nums">{formatMoney(amount)}</span></button>
      })}
    </div>
    <div className="mt-3" aria-live="polite">
      <p className="text-sm font-semibold">{label} · {formatMoney(selectedTotal)}</p>
      {visible.length ? <ul className="mt-2 divide-y divide-(--line)">
        {visible.map(entry => <li key={entry.id} className="flex justify-between gap-3 py-2 text-xs">
          <div className="min-w-0 break-words"><span>{entry.title}</span><span className="mt-1 block text-(--muted)">{entry.date}</span></div>
          <strong className="shrink-0 tabular-nums">{formatMoney(entry.amountCents)}</strong>
        </li>)}
      </ul> : <p className="mt-2 text-xs text-(--muted)">No spending in {category === 'all' ? 'this month' : `${label.toLowerCase()} this month`}.</p>}
    </div>
    <p className="mt-3 text-xs text-(--muted)">Excludes deleted purchases, bills without a price, penalties and transfers.</p>
  </section>
}
