import { PurchaseDetails } from './PurchaseDetails'
import { ShareBar, SharePeek } from './ShareBreakdown'
import { expenseBreakdown } from '../lib/shares'
import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Droplets,
  Flame,
  Lightbulb,
  ListFilter,
  MoreHorizontal,
  Plus,
  RotateCcw,
  ShieldCheck,
  WalletCards,
  Wifi,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { formatMoney } from '../lib/utils'
import { getExpenseCategory } from '../lib/expenseCategories'
import { useAppData } from '../state/AppDataContext'
import type { Expense, HouseholdBillCategory, Settlement } from '../types'
import { ExpenseCategoryIcon } from './ExpenseCategoryIcon'
import { Avatar, Badge, Button } from './ui'

const activityDate = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const dueDate = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function MonthNavigator({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [yearValue, monthValue] = value.split('-').map(Number)
  const selectedYear = Number.isFinite(yearValue) ? yearValue : new Date().getFullYear()
  const selectedMonth = Number.isFinite(monthValue) ? monthValue : new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const firstYear = Math.min(currentYear - 10, selectedYear - 2)
  const lastYear = Math.max(currentYear + 10, selectedYear + 2)
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)

  const setMonth = (year: number, month: number) => {
    onChange(`${year}-${String(month).padStart(2, '0')}`)
  }

  const moveMonth = (offset: number) => {
    const date = new Date(selectedYear, selectedMonth - 1 + offset, 1)
    setMonth(date.getFullYear(), date.getMonth() + 1)
  }

  return (
    <div className="relative w-52 shrink-0">
      <div className="grid h-12 grid-cols-[44px_minmax(0,1fr)_44px] items-stretch overflow-hidden rounded-xl border border-(--line) bg-(--surface-strong)">
        <button className="grid place-items-center border-0 bg-transparent text-(--muted) hover:bg-(--sage-2) hover:text-(--forest)" type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
          <ChevronLeft size={15} />
        </button>
        <button className="flex min-w-0 flex-col items-center justify-center gap-0.5 border-0 bg-transparent px-1 font-sans text-(--ink) hover:bg-(--sage-2)" type="button" onClick={() => setOpen((shown) => !shown)} aria-label={`Choose month and year, ${monthNames[selectedMonth - 1]} ${selectedYear}`} aria-expanded={open} aria-haspopup="dialog">
          <span className="text-[.8rem] font-semibold leading-tight whitespace-nowrap">{monthNames[selectedMonth - 1]}</span>
          <span className="text-[.68rem] leading-tight text-(--muted) tabular-nums">{selectedYear}</span>
        </button>
        <button className="grid place-items-center border-0 bg-transparent text-(--muted) hover:bg-(--sage-2) hover:text-(--forest)" type="button" onClick={() => moveMonth(1)} aria-label="Next month">
          <ChevronRight size={15} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 grid w-64 max-w-[calc(100vw-4rem)] gap-3 rounded-[10px] border border-(--line-strong) bg-(--surface-strong) p-3 shadow-[0_12px_35px_rgba(20,35,28,.16)]" role="dialog" aria-label="Choose month and year">
          <div className="grid grid-cols-[1fr_92px] gap-2">
            <label className="grid gap-1 text-[.7rem] font-semibold text-(--muted)">
              Month
              <select className="mt-0! min-h-10 px-2.5 py-1.5 text-[.78rem]" value={selectedMonth} onChange={(event) => setMonth(selectedYear, Number(event.target.value))}>
                {monthNames.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[.7rem] font-semibold text-(--muted)">
              Year
              <select className="mt-0! min-h-10 px-2.5 py-1.5 text-[.78rem]" value={selectedYear} onChange={(event) => setMonth(Number(event.target.value), selectedMonth)}>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>
          <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
        </div>
      )}
    </div>
  )
}

function BillIcon({ category }: { category: HouseholdBillCategory }) {
  if (category === 'rent') return <Building2 size={19} />
  if (category === 'electricity') return <Lightbulb size={19} />
  if (category === 'water') return <Droplets size={19} />
  if (category === 'gas') return <Flame size={19} />
  if (category === 'internet') return <Wifi size={19} />
  if (category === 'insurance') return <ShieldCheck size={19} />
  return <MoreHorizontal size={19} />
}

type Activity =
  | { kind: 'expense'; date: string; item: Expense }
  | { kind: 'settlement'; date: string; item: Settlement }

export function MoneyDashboard({
  selectedMonth,
  onMonthChange,
  onSettle,
  onAddPurchase,
  onAddBill,
}: {
  selectedMonth: string
  onMonthChange: (month: string) => void
  onSettle: () => void
  onAddPurchase: () => void
  onAddBill: () => void
}) {
  const {
    data,
    busy,
    reverseExpense,
    confirmSettlement,
    proposeFundPayment,
    confirmFundPayment,
    setBillPaid,
    openReceipt,
  } = useAppData()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [peekId, setPeekId] = useState<string | null>(null)
  const selectedExpense = data.expenses.find(e => e.id === detailId)
  const [activityFilter, setActivityFilter] = useState<'all' | 'expense' | 'settlement'>('all')
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [showAllBills, setShowAllBills] = useState(false)
  const currentMemberId = data.household.currentMemberId
  const currentMember = data.members.find((member) => member.id === currentMemberId)!
  const currentBalance = data.balances.find((balance) => balance.memberId === currentMemberId)
  const activeExpenses = data.expenses.filter((expense) => !expense.reversed)
  const totalHouseSpend = activeExpenses.reduce((sum, expense) => sum + expense.amountCents, 0)
  const currentMonthPurchases = activeExpenses.filter((expense) => expense.purchasedAt.slice(0, 7) === selectedMonth)
  const paidCents = currentBalance?.contributionCents ?? 0
  const usedCents = currentBalance?.resourceUseCents ?? 0
  const netCents = currentBalance?.netCents ?? 0
  const paidPercent = paidCents + usedCents > 0 ? Math.round((paidCents / (paidCents + usedCents)) * 100) : 50
  const totalFundOwed = data.balances.reduce((sum, balance) => sum + balance.fundOwedCents, 0)
  const myFundOwed = currentBalance?.fundOwedCents ?? 0
  const selectedPeriods = data.billPeriods.filter((period) => period.periodMonth.slice(0, 7) === selectedMonth)

  const activities = useMemo(() => {
    const combined: Activity[] = [
      ...data.expenses.map((item): Activity => ({ kind: 'expense', date: item.purchasedAt, item })),
      ...data.settlements.map((item): Activity => ({ kind: 'settlement', date: item.createdAt, item })),
    ]
    return combined
      .filter((activity) => activityFilter === 'all' || activity.kind === activityFilter)
      .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
  }, [activityFilter, data.expenses, data.settlements])

  const visibleActivities = showAllActivity ? activities : activities.slice(0, 5)
  const visibleBills = showAllBills ? data.bills : data.bills.slice(0, 4)

  return (
    <div className="grid gap-5.5">
      {selectedExpense && <PurchaseDetails key={selectedExpense.id} expense={selectedExpense} onClose={() => setDetailId(null)} />}
      <header className="flex items-end justify-between gap-8 max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-4">
        <div className="grid gap-1">
          <h1 className="page-title">Shared money</h1>
          <p className="text-[.94rem] text-(--muted)">Every purchase, share and payment stays balanced and traceable.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-[500px]:w-full">
          <Button variant="ghost" onClick={onSettle}>
            <WalletCards size={18} /> Settle up
          </Button>
          <Button onClick={onAddPurchase}>
            <Plus size={18} /> Add purchase
          </Button>
        </div>
      </header>

      <section className="grid min-h-46 grid-cols-[minmax(0,.8fr)_minmax(0,1.1fr)_minmax(0,1.2fr)] gap-3 rounded-2xl border border-(--line) bg-(--surface-strong) p-3 max-[1120px]:grid-cols-[280px_minmax(0,1fr)] max-[760px]:grid-cols-1">
        <div className="flex min-w-0 items-center rounded-2xl bg-(--surface) px-6 py-6 max-[760px]:px-5 max-[760px]:py-5">
          <div>
            <p className="text-[.73rem] font-extrabold tracking-[.06em] text-(--gold)">HOUSE SPEND</p>
            <strong className="mt-1 block font-display text-[3rem] leading-none text-(--forest)">{formatMoney(totalHouseSpend)}</strong>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[.88rem] font-bold text-(--forest-2)">
              {netCents === 0 ? <>You&apos;re all settled up <CheckCircle2 size={17} /></> : <>Your balance is {formatMoney(netCents, true)}</>}
            </span>
            <span className="mt-3 block text-[.78rem] text-(--muted)">Across {currentMonthPurchases.length} purchases this month</span>
          </div>
        </div>

        <div className="grid min-w-0 content-center grid-cols-2 gap-x-5 gap-y-4 rounded-2xl bg-(--surface) px-5 py-5 max-[520px]:grid-cols-1">
          {data.balances.map((balance) => {
            const member = data.members.find((item) => item.id === balance.memberId)!
            return (
              <div className="flex min-w-0 items-center gap-3" key={member.id}>
                <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="md" />
                <div className="min-w-0">
                  <strong className="block truncate text-[.9rem]">{member.displayName}</strong>
                  <span className="block text-[.73rem] text-(--muted)">{member.id === currentMemberId ? 'You' : balance.netCents > 0 ? 'Is owed' : balance.netCents < 0 ? 'Owes' : 'Settled'}</span>
                  <strong className={cn('mt-0.5 block font-sans text-[.9rem] tabular-nums', balance.netCents < 0 ? 'text-(--coral)' : 'text-(--green)')}>
                    {formatMoney(balance.netCents, true)}
                  </strong>
                </div>
              </div>
            )
          })}
        </div>

        <div className="balance-metrics col-span-1 grid min-w-0 content-center gap-5 rounded-2xl bg-(--surface) px-6 py-6 max-[1120px]:col-span-2 max-[760px]:col-span-1 max-[760px]:px-5">
          <div className="grid grid-cols-3 gap-5">
            <div><span className="block text-[.76rem]">Paid</span><strong className="mt-1 block font-sans tabular-nums">{formatMoney(paidCents)}</strong></div>
            <div><span className="block text-[.76rem]">Used</span><strong className="mt-1 block font-sans tabular-nums">{formatMoney(usedCents)}</strong></div>
            <div className="text-right"><span className="block text-[.76rem]">Net</span><strong className={cn('mt-1 block font-sans tabular-nums', netCents < 0 ? 'text-(--coral)' : 'text-(--green)')}>{formatMoney(netCents, true)}</strong></div>
          </div>
          <div>
            <div className="flex h-2 overflow-hidden rounded-full bg-[#bfd4b8]">
              <span className="bg-(--forest)" style={{ width: `${paidPercent}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[.73rem] text-(--muted)"><span>{paidPercent}% paid</span><span>{100 - paidPercent}% used</span></div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[1.2fr_.92fr] items-start gap-5 max-[980px]:grid-cols-1">
        <section className="rounded-2xl border border-(--line) bg-(--surface-strong) p-3">
          <div className="rounded-xl bg-(--surface) px-4 py-3">
          <div className="flex items-center justify-between gap-4 border-b border-(--line) pb-3">
            <h2 className="text-[1.25rem]!">Recent activity</h2>
            <label className="relative inline-flex items-center gap-2 text-[.8rem] font-semibold text-(--muted)">
              <ListFilter size={18} />
              <select className="mt-0! min-h-0 appearance-none border-0 bg-transparent py-1 pr-8! pl-4! text-[.8rem] shadow-none" value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as typeof activityFilter)}>
                <option value="all">All activity</option>
                <option value="expense">Purchases</option>
                <option value="settlement">Payments</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5" size={14} />
            </label>
          </div>

          <div>
            {visibleActivities.map((activity, index) => {
              const previous = visibleActivities[index - 1]
              const showDate = !previous || new Date(previous.date).toDateString() !== new Date(activity.date).toDateString()
              if (activity.kind === 'expense') {
                const expense = activity.item
                const breakdown = expenseBreakdown(expense, data.members, currentMemberId)
                const payerNames = expense.payers.map((payer) => data.members.find((member) => member.id === payer.memberId)?.displayName).filter(Boolean)
                const creator = data.members.find((member) => member.id === expense.createdBy)!
                return (
                  <div key={`expense-${expense.id}`}>
                    {showDate && <p className="pt-3 pb-1 text-[.72rem] font-semibold text-(--muted)">{activityDate.format(new Date(activity.date))}</p>}
                    <div
                      className={cn('grid min-h-15 cursor-pointer grid-cols-[42px_minmax(0,1.15fr)_minmax(135px,.8fr)_auto] items-center gap-3 rounded-xl border-b border-(--line) px-2 py-2.5 transition-colors hover:bg-(--sage-2) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--green) max-[620px]:grid-cols-[40px_1fr_auto]', expense.reversed && 'opacity-50')}
                      role="button"
                      tabIndex={0}
                      aria-label={`View breakdown for ${expense.title}`}
                      onClick={() => { setPeekId(null); setDetailId(expense.id) }}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setPeekId(null)
                          setDetailId(expense.id)
                        }
                      }}
                    >
                      <ExpenseCategoryIcon category={expense.category} />
                      <div className="min-w-0"><strong className="block truncate text-[.86rem]">{expense.title}</strong><span className="block truncate text-[.73rem] text-(--muted)">{getExpenseCategory(expense.category).description}{expense.receiptPath ? ' · Receipt attached' : ''}</span></div>
                      <div className="grid min-w-0 gap-2 max-[620px]:hidden"><div className="flex min-w-0 items-center gap-2"><Avatar initials={creator.initials} color={creator.color} imageUrl={creator.avatarUrl} size="sm" /><span className="truncate text-[.76rem] text-(--muted)">{payerNames.join(' & ')} paid</span></div><div className="flex items-center gap-2"><ShareBar className="w-20 shrink-0" height={6} breakdown={breakdown} /><span className="whitespace-nowrap text-[.65rem] text-(--muted)">{(breakdown.mine?.percent ?? 0).toFixed(0)}% you</span></div></div>
                      <div className="flex items-center gap-2">
                        <div className="relative" onMouseEnter={() => setPeekId(expense.id)} onMouseLeave={() => setPeekId(null)}>
                          <strong className="block min-w-18 px-1 py-2 text-right font-sans text-[.84rem] font-bold tabular-nums">{formatMoney(expense.amountCents)}</strong>
                          {peekId === expense.id && <SharePeek className="pointer-events-none absolute bottom-full right-0 z-30 mb-1 max-[620px]:hidden" title={expense.title} breakdown={breakdown} />}
                        </div>
                        {expense.receiptPath ? (
                          <button className="grid size-8 place-items-center rounded-full border-0 bg-transparent text-(--muted) hover:bg-(--surface-strong)" type="button" onClick={event => { event.stopPropagation(); openReceipt(expense.receiptPath!) }} aria-label={`Open receipt for ${expense.title}`}><Camera size={16} /></button>
                        ) : null}
                        {!expense.reversed && expense.createdBy === currentMemberId && (
                          <button className="grid size-8 place-items-center rounded-full border-0 bg-transparent text-(--muted) hover:bg-(--gold-soft)" type="button" onClick={event => { event.stopPropagation(); const reason = window.prompt('Why are you reversing this purchase?'); if (reason?.trim()) void reverseExpense(expense.id, reason.trim()) }} aria-label={`Reverse ${expense.title}`}><RotateCcw size={15} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }

              const settlement = activity.item
              const from = data.members.find((member) => member.id === settlement.fromMemberId)!
              const to = data.members.find((member) => member.id === settlement.toMemberId)!
              const awaitingMe = settlement.toMemberId === currentMemberId && settlement.status === 'pending'
              const signedAmount = settlement.fromMemberId === currentMemberId ? -settlement.amountCents : settlement.amountCents
              return (
                <div key={`settlement-${settlement.id}`}>
                  {showDate && <p className="pt-3 pb-1 text-[.72rem] font-semibold text-(--muted)">{activityDate.format(new Date(activity.date))}</p>}
                  <div className="grid min-h-15 grid-cols-[42px_minmax(0,1.15fr)_minmax(135px,.8fr)_auto] items-center gap-3 border-b border-(--line) py-2.5 max-[620px]:grid-cols-[40px_1fr_auto]">
                    <div className="grid size-10 place-items-center rounded-full bg-(--gold-soft) text-[#8b6413] dark:text-(--gold)"><ArrowUpRight size={19} /></div>
                    <div className="min-w-0"><strong className="block truncate text-[.86rem]">Payment to {to.displayName}</strong><span className="block truncate text-[.73rem] text-(--muted)">{settlement.note || 'Shared expenses'}</span></div>
                    <div className="flex min-w-0 items-center gap-2 max-[620px]:hidden"><Avatar initials={from.initials} color={from.color} imageUrl={from.avatarUrl} size="sm" /><span className="truncate text-[.76rem] text-(--muted)">{from.displayName} paid</span></div>
                    <div className="flex items-center gap-2">
                      <strong className={cn('min-w-18 text-right font-sans text-[.84rem] tabular-nums', signedAmount < 0 ? 'text-(--green)' : 'text-(--ink)')}>{formatMoney(signedAmount, true)}</strong>
                      {awaitingMe ? <><Button size="sm" variant="ghost" onClick={() => void confirmSettlement(settlement.id, false)}>Reject</Button><Button size="sm" onClick={() => void confirmSettlement(settlement.id, true)}><Check size={14} /> Confirm</Button></> : <Badge tone={settlement.status === 'confirmed' ? 'green' : settlement.status === 'rejected' ? 'red' : 'amber'}>{settlement.status}</Badge>}
                    </div>
                  </div>
                </div>
              )
            })}
            {!visibleActivities.length && <p className="py-10 text-center text-[.82rem] text-(--muted)">No activity yet.</p>}
          </div>
          {activities.length > 5 && <button className="mt-2 border-0 bg-transparent py-1 text-[.8rem] font-bold text-(--forest)" type="button" onClick={() => setShowAllActivity((shown) => !shown)}>{showAllActivity ? 'Show less' : 'View all activity'}</button>}
          </div>
        </section>

        <div className="grid gap-4">
          <section className="rounded-2xl border border-(--line) bg-(--surface-strong) p-3" id="bills">
            <div className="rounded-xl bg-(--surface) px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) pb-3 max-[520px]:flex-col max-[520px]:items-stretch">
              <div className="flex min-w-44 flex-1 self-stretch flex-col justify-center">
                <h2 className="text-[1.18rem]! leading-tight!">Utilities &amp; rent</h2>
                <p className="mt-0.5 text-[.66rem] leading-tight text-(--muted)">Track your individual payment each month.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MonthNavigator value={selectedMonth} onChange={onMonthChange} />
                <Button size="sm" variant="ghost" onClick={onAddBill}><Plus size={16} /> Add bill</Button>
              </div>
            </div>

            <div>
              {visibleBills.map((bill) => {
                const period = selectedPeriods.find((item) => item.billId === bill.id)
                const paid = Boolean(period?.paidMemberIds.includes(currentMemberId))
                return (
                  <div className="grid min-h-15 grid-cols-[42px_minmax(0,1fr)_90px_34px] items-center gap-3 border-b border-(--line) py-2.5" key={bill.id}>
                    <div className={cn('grid size-10 place-items-center rounded-[9px] bg-(--sage) text-(--forest)', bill.category === 'electricity' && 'bg-(--gold-soft) text-[#8b6413] dark:text-(--gold)', bill.category === 'gas' && 'bg-[#fbe8dd] dark:bg-(--coral-soft) text-[#a34e28] dark:text-(--coral)')}><BillIcon category={bill.category} /></div>
                    <div className="min-w-0"><strong className="block truncate text-[.83rem]">{bill.name}</strong><span className="block text-[.71rem] text-(--muted)">Due {period ? dueDate.format(new Date(period.dueAt)) : `day ${bill.dueDay}`}</span></div>
                    <div className="text-right"><strong className="block font-sans text-[.82rem] tabular-nums">{formatMoney(period?.amountCents ?? bill.amountCents ?? 0)}</strong><span className="block truncate text-[.7rem] text-(--muted)">{currentMember.displayName}</span></div>
                    <label className="grid size-8 cursor-pointer place-items-center" title={paid ? 'Paid' : 'Mark paid'}>
                      <input className="sr-only" type="checkbox" checked={paid} disabled={!period || busy === `bill:paid:${period.id}`} onChange={(event) => { if (period) void setBillPaid(period.id, event.target.checked) }} />
                      {paid ? <CheckCircle2 className="text-[#6ca177] dark:text-(--green)" size={20} /> : <Circle className="text-(--muted)" size={20} />}
                    </label>
                  </div>
                )
              })}
              {!data.bills.length && <p className="py-8 text-center text-[.8rem] text-(--muted)">No monthly bills yet.</p>}
            </div>
            {data.bills.length > 4 && <button className="mt-2 border-0 bg-transparent py-1 text-[.8rem] font-bold text-(--forest)" type="button" onClick={() => setShowAllBills((shown) => !shown)}>{showAllBills ? 'Show fewer bills' : 'View all bills'}</button>}
            </div>
          </section>

          <section className="rounded-2xl border border-(--line) bg-(--surface-strong) p-3">
            <div className="rounded-xl bg-(--surface) px-4 py-3">
            <h2 className="text-[1.18rem]! leading-tight!">Penalty account</h2>
            <div className="mt-3 flex min-h-13 items-center gap-3 border-t border-(--line) pt-3">
              <div className="grid size-10 place-items-center rounded-[9px] bg-(--sage) text-(--forest)"><ArrowDownLeft size={19} /></div>
              <div><strong className="block text-[.82rem]">{formatMoney(totalFundOwed)} outstanding</strong><span className="block text-[.7rem] text-(--muted)">Kept separate from shared purchase balances</span></div>
              {myFundOwed > 0 ? <Button className="ml-auto" size="sm" variant="ghost" onClick={() => { const amount = window.prompt('How much did you pay into the household fund?'); const amountCents = Math.round(Number(amount) * 100); if (amountCents > 0) void proposeFundPayment(amountCents) }}>Record payment</Button> : <ChevronRight className="ml-auto text-(--muted)" size={17} />}
            </div>
            {data.fundPayments.map((payment) => {
              const member = data.members.find((item) => item.id === payment.memberId)!
              const canConfirm = payment.memberId !== currentMemberId && payment.status === 'pending'
              return <div className="mt-2 flex items-center gap-2 border-t border-(--line) pt-3" key={payment.id}><Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" /><span className="text-[.76rem]">{member.displayName} paid {formatMoney(payment.amountCents)}</span>{canConfirm ? <div className="ml-auto flex gap-1"><Button size="sm" variant="ghost" onClick={() => void confirmFundPayment(payment.id, false)}>Reject</Button><Button size="sm" onClick={() => void confirmFundPayment(payment.id, true)}>Confirm</Button></div> : <span className="ml-auto"><Badge tone={payment.status === 'confirmed' ? 'green' : payment.status === 'rejected' ? 'red' : 'amber'}>{payment.status}</Badge></span>}</div>
            })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
