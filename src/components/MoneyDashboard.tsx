import { useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Camera,
  Check,
  CheckCircle2,
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
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  FeatureCard,
  Inner,
  PageHeader,
  Pill,
  Segmented,
  Tile,
} from './ui'

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
    <div className="relative">
      <div className="hh-navpill flex p-0.75">
        <button
          className="hh-navitem h-7.5 px-2.5"
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          className="hh-navitem hh-navitem-on h-7.5 min-w-33 px-3 text-[.76rem]"
          type="button"
          onClick={() => setOpen((shown) => !shown)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          {monthNames[selectedMonth - 1]} {selectedYear}
        </button>
        <button
          className="hh-navitem h-7.5 px-2.5"
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {open && (
        <div
          className="hh-anim-pop hh-card absolute top-[calc(100%+8px)] right-0 z-20 grid w-64 gap-3 rounded-2xl p-3"
          role="dialog"
          aria-label="Choose month and year"
        >
          <div className="grid grid-cols-[1fr_92px] gap-2">
            <label className="grid gap-1 text-[.72rem] font-semibold text-(--text-3)">
              Month
              <select
                className="mt-0! h-10 px-3 py-0 text-[.8rem]"
                value={selectedMonth}
                onChange={(event) => setMonth(selectedYear, Number(event.target.value))}
              >
                {monthNames.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[.72rem] font-semibold text-(--text-3)">
              Year
              <select
                className="mt-0! h-10 px-3 py-0 text-[.8rem]"
                value={selectedYear}
                onChange={(event) => setMonth(Number(event.target.value), selectedMonth)}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
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
  const [activityFilter, setActivityFilter] = useState<'all' | 'expense' | 'settlement'>('all')
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [showAllBills, setShowAllBills] = useState(false)
  const currentMemberId = data.household.currentMemberId
  const currentMember = data.members.find((member) => member.id === currentMemberId)!
  const currentBalance = data.balances.find((balance) => balance.memberId === currentMemberId)
  const activeExpenses = data.expenses.filter((expense) => !expense.reversed)
  const totalHouseSpend = activeExpenses.reduce((sum, expense) => sum + expense.amountCents, 0)
  const currentMonthPurchases = activeExpenses.filter(
    (expense) => expense.purchasedAt.slice(0, 7) === selectedMonth,
  )
  const paidCents = currentBalance?.contributionCents ?? 0
  const usedCents = currentBalance?.resourceUseCents ?? 0
  const netCents = currentBalance?.netCents ?? 0
  const paidPercent = paidCents + usedCents > 0
    ? Math.round((paidCents / (paidCents + usedCents)) * 100)
    : 50
  const totalFundOwed = data.balances.reduce((sum, balance) => sum + balance.fundOwedCents, 0)
  const myFundOwed = currentBalance?.fundOwedCents ?? 0
  const selectedPeriods = data.billPeriods.filter(
    (period) => period.periodMonth.slice(0, 7) === selectedMonth,
  )

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
    <>
      <PageHeader
        title="Shared money"
        description="Every purchase, share and payment stays balanced and traceable."
        actions={
          <>
            <Button variant="secondary" onClick={onSettle}>
              <WalletCards size={16} /> Settle up
            </Button>
            <Button onClick={onAddPurchase}>
              <Plus size={16} /> Add purchase
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-[320px_minmax(0,1fr)_320px] items-stretch gap-5 max-[1240px]:grid-cols-[320px_minmax(0,1fr)] max-[860px]:grid-cols-1">
        <FeatureCard className="grid content-between gap-4 p-5.5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[.72rem] font-semibold tracking-[.06em] text-[rgba(255,255,255,.75)] uppercase">
              Your house balance
            </span>
            <span className="grid size-8.5 shrink-0 place-items-center rounded-full bg-[rgba(255,255,255,.18)] text-white">
              <ArrowUpRight size={16} />
            </span>
          </div>
          <div className="grid gap-1.5">
            <strong className="font-display text-[3rem] leading-none font-extrabold tracking-[-.03em] max-[640px]:text-[2.4rem]">
              {formatMoney(netCents, true)}
            </strong>
            <span className="text-[.82rem] font-semibold text-[rgba(255,255,255,.85)]">
              {netCents === 0
                ? 'You’re all settled up'
                : netCents < 0
                  ? 'You owe the house'
                  : 'The house owes you'}
              {' · '}
              house spend <strong>{formatMoney(totalHouseSpend)}</strong>
            </span>
            <span className="text-[.76rem] text-[rgba(255,255,255,.7)]">
              Across {currentMonthPurchases.length} purchase
              {currentMonthPurchases.length === 1 ? '' : 's'} this month
            </span>
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-0.5 rounded-xl bg-white px-3.5 py-2.5 text-(--bg)">
                <span className="text-[.68rem] font-semibold text-(--text-3)">Paid</span>
                <span className="text-[1rem] font-extrabold tabular-nums">{formatMoney(paidCents)}</span>
              </div>
              <div className="grid gap-0.5 rounded-xl border border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.16)] px-3.5 py-2.5">
                <span className="text-[.68rem] font-semibold text-[rgba(255,255,255,.75)]">Used</span>
                <span className="text-[1rem] font-extrabold tabular-nums">{formatMoney(usedCents)}</span>
              </div>
            </div>
            <div className="grid gap-1.5">
              <div className="flex h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,.25)]">
                <span className="bg-white transition-[width] duration-700" style={{ width: `${paidPercent}%` }} />
              </div>
              <div className="flex justify-between text-[.7rem] font-semibold text-[rgba(255,255,255,.8)]">
                <span>{paidPercent}% paid</span>
                <span>{100 - paidPercent}% used</span>
              </div>
            </div>
          </div>
        </FeatureCard>

        <Card className="grid grid-rows-[auto_1fr] pb-4 max-[1240px]:col-start-2 max-[860px]:col-start-auto">
          <CardHead
            title="Recent activity"
            action={
              <>
                <span className="text-(--text-3) max-[560px]:hidden">
                  <ListFilter size={16} />
                </span>
                <Segmented
                  label="Filter activity"
                  value={activityFilter}
                  onChange={setActivityFilter}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'expense', label: 'Purchases' },
                    { value: 'settlement', label: 'Payments' },
                  ]}
                />
              </>
            }
          />
          <div className="px-5 max-[640px]:px-3">
            {visibleActivities.map((activity, index) => {
              const previous = visibleActivities[index - 1]
              const showDate =
                !previous ||
                new Date(previous.date).toDateString() !== new Date(activity.date).toDateString()

              if (activity.kind === 'expense') {
                const expense = activity.item
                const payerNames = expense.payers
                  .map((payer) => data.members.find((member) => member.id === payer.memberId)?.displayName)
                  .filter(Boolean)
                const creator = data.members.find((member) => member.id === expense.createdBy)!
                return (
                  <div key={`expense-${expense.id}`}>
                    {showDate && (
                      <p className="pt-3.5 pb-1 text-[.68rem] font-bold tracking-[.06em] text-(--text-3) uppercase">
                        {activityDate.format(new Date(activity.date))}
                      </p>
                    )}
                    <div
                      className={cn(
                        'hh-row grid grid-cols-[40px_minmax(0,1fr)_140px_auto] items-center gap-3.5 border-b border-(--line) py-2.5 max-[820px]:grid-cols-[40px_minmax(0,1fr)_auto] max-[560px]:grid-cols-[40px_minmax(0,1fr)]',
                        expense.reversed && 'opacity-50',
                      )}
                    >
                      <ExpenseCategoryIcon category={expense.category} />
                      <div className="min-w-0">
                        <strong className="block truncate text-[.88rem]">{expense.title}</strong>
                        <span className="block truncate text-[.75rem] text-(--text-3)">
                          {getExpenseCategory(expense.category).description}
                          {expense.receiptPath ? ' · Receipt attached' : ''}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 max-[820px]:hidden">
                        <Avatar
                          initials={creator.initials}
                          color={creator.color}
                          imageUrl={creator.avatarUrl}
                          size="sm"
                        />
                        <span className="truncate text-[.76rem] text-(--text-3)">
                          {payerNames.join(' & ')} paid
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 max-[560px]:col-span-2 max-[560px]:justify-end">
                        <strong className="min-w-19 text-right text-[.88rem] font-bold tabular-nums">
                          {formatMoney(expense.amountCents)}
                        </strong>
                        {expense.receiptPath ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-8 px-0"
                            onClick={() => openReceipt(expense.receiptPath!)}
                            aria-label={`Open receipt for ${expense.title}`}
                          >
                            <Camera size={15} />
                          </Button>
                        ) : (
                          <ChevronRight className="mx-1.5 text-(--text-4)" size={16} />
                        )}
                        {!expense.reversed && expense.createdBy === currentMemberId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-8 px-0"
                            onClick={() => {
                              const reason = window.prompt('Why are you reversing this purchase?')
                              if (reason?.trim()) void reverseExpense(expense.id, reason.trim())
                            }}
                            aria-label={`Reverse ${expense.title}`}
                          >
                            <RotateCcw size={15} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }

              const settlement = activity.item
              const from = data.members.find((member) => member.id === settlement.fromMemberId)!
              const to = data.members.find((member) => member.id === settlement.toMemberId)!
              const awaitingMe =
                settlement.toMemberId === currentMemberId && settlement.status === 'pending'
              const signedAmount =
                settlement.fromMemberId === currentMemberId
                  ? -settlement.amountCents
                  : settlement.amountCents
              return (
                <div key={`settlement-${settlement.id}`}>
                  {showDate && (
                    <p className="pt-3.5 pb-1 text-[.68rem] font-bold tracking-[.06em] text-(--text-3) uppercase">
                      {activityDate.format(new Date(activity.date))}
                    </p>
                  )}
                  <div className="hh-row grid grid-cols-[40px_minmax(0,1fr)_140px_auto] items-center gap-3.5 border-b border-(--line) py-2.5 max-[820px]:grid-cols-[40px_minmax(0,1fr)_auto] max-[560px]:grid-cols-[40px_minmax(0,1fr)]">
                    <span className="grid size-10 place-items-center rounded-full bg-(--amber-soft) text-(--amber)">
                      <ArrowUpRight size={18} />
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate text-[.88rem]">
                        Payment to {to.displayName}
                      </strong>
                      <span className="block truncate text-[.75rem] text-(--text-3)">
                        {settlement.note || 'Shared expenses'}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 max-[820px]:hidden">
                      <Avatar
                        initials={from.initials}
                        color={from.color}
                        imageUrl={from.avatarUrl}
                        size="sm"
                      />
                      <span className="truncate text-[.76rem] text-(--text-3)">
                        {from.displayName} paid
                      </span>
                    </div>
                    <div className="flex items-center gap-2 max-[560px]:col-span-2 max-[560px]:justify-end">
                      <strong
                        className={cn(
                          'min-w-19 text-right text-[.88rem] font-bold tabular-nums',
                          signedAmount < 0 ? 'text-(--green)' : 'text-(--text)',
                        )}
                      >
                        {formatMoney(signedAmount, true)}
                      </strong>
                      {awaitingMe ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => void confirmSettlement(settlement.id, false)}>
                            Reject
                          </Button>
                          <Button size="sm" onClick={() => void confirmSettlement(settlement.id, true)}>
                            <Check size={14} /> Confirm
                          </Button>
                        </>
                      ) : (
                        <Badge
                          tone={
                            settlement.status === 'confirmed'
                              ? 'green'
                              : settlement.status === 'rejected'
                                ? 'red'
                                : 'amber'
                          }
                        >
                          {settlement.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {!visibleActivities.length && (
              <EmptyState
                icon={WalletCards}
                title="No activity yet"
                description="Purchases and payments will show up here."
              />
            )}
            {activities.length > 5 && (
              <button
                className="mt-3 border-0 bg-transparent py-1 text-[.8rem] font-bold text-(--text-2) hover:text-(--text)"
                type="button"
                onClick={() => setShowAllActivity((shown) => !shown)}
              >
                {showAllActivity ? 'Show less' : 'View all activity'}
              </button>
            )}
          </div>
        </Card>

        <Card className="grid grid-rows-[auto_1fr] pb-4 max-[1240px]:col-span-full">
          <CardHead
            title="Balances"
            description={`${paidPercent}% of your share paid`}
            action={
              <Button variant="ghost" size="sm" onClick={onSettle}>
                <WalletCards size={15} /> Settle
              </Button>
            }
          />
          <div className="px-5 max-[640px]:px-3">
            {data.balances.map((balance, index) => {
              const member = data.members.find((item) => item.id === balance.memberId)!
              const isMe = member.id === currentMemberId
              return (
                <div
                  key={member.id}
                  className={cn(
                    'flex items-center gap-3 py-3',
                    index > 0 && 'border-t border-(--line)',
                  )}
                >
                  <Avatar
                    initials={member.initials}
                    color={member.color}
                    imageUrl={member.avatarUrl}
                    size="md"
                  />
                  <div className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate text-[.86rem] font-bold">{member.displayName}</span>
                    <span className="truncate text-[.73rem] text-(--text-3)">
                      {isMe
                        ? 'You'
                        : balance.netCents > 0
                          ? 'Is owed'
                          : balance.netCents < 0
                            ? 'Owes'
                            : 'Settled'}
                      {balance.fundOwedCents > 0 && ` · ${formatMoney(balance.fundOwedCents)} penalty`}
                    </span>
                  </div>
                  <Badge
                    tone={balance.netCents < 0 ? 'red' : balance.netCents > 0 ? 'green' : 'neutral'}
                  >
                    {formatMoney(balance.netCents, true)}
                  </Badge>
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-[minmax(0,1.4fr)_minmax(360px,.8fr)] items-start gap-5 max-[1100px]:grid-cols-1">
        <Card className="pb-4" id="bills">
          <CardHead
            title="Utilities &amp; rent"
            description="Track your individual payment each month."
            action={
              <>
                <MonthNavigator value={selectedMonth} onChange={onMonthChange} />
                <Button size="sm" variant="secondary" onClick={onAddBill}>
                  <Plus size={15} /> Add bill
                </Button>
              </>
            }
          />
          <div className="px-5 max-[640px]:px-3">
            {visibleBills.map((bill) => {
              const period = selectedPeriods.find((item) => item.billId === bill.id)
              const paid = Boolean(period?.paidMemberIds.includes(currentMemberId))
              return (
                <div
                  className="hh-row grid grid-cols-[40px_minmax(0,1fr)_auto_32px] items-center gap-3.5 border-b border-(--line) py-2.5"
                  key={bill.id}
                >
                  <span
                    className={cn(
                      'grid size-10 place-items-center rounded-xl bg-(--blue-soft) text-[#7d9cff]',
                      bill.category === 'electricity' && 'bg-(--amber-soft) text-(--amber)',
                      bill.category === 'gas' && 'bg-(--red-soft) text-[#ff8080]',
                      bill.category === 'water' && 'bg-(--violet-soft) text-(--violet)',
                    )}
                  >
                    <BillIcon category={bill.category} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-[.88rem]">{bill.name}</strong>
                    <span className="block text-[.73rem] text-(--text-3)">
                      Due {period ? dueDate.format(new Date(period.dueAt)) : `day ${bill.dueDay}`}
                    </span>
                  </div>
                  <div className="grid text-right">
                    <strong className="text-[.88rem] font-bold tabular-nums">
                      {formatMoney(period?.amountCents ?? bill.amountCents ?? 0)}
                    </strong>
                    <span className="truncate text-[.71rem] text-(--text-3)">
                      {currentMember.displayName}
                    </span>
                  </div>
                  <label
                    className="grid size-8 cursor-pointer place-items-center"
                    title={paid ? 'Paid' : 'Mark paid'}
                  >
                    <input
                      className="sr-only"
                      type="checkbox"
                      checked={paid}
                      disabled={!period || busy === `bill:paid:${period.id}`}
                      onChange={(event) => {
                        if (period) void setBillPaid(period.id, event.target.checked)
                      }}
                    />
                    {paid ? (
                      <CheckCircle2 className="text-(--green)" size={21} />
                    ) : (
                      <Circle className="text-(--text-4)" size={21} />
                    )}
                  </label>
                </div>
              )
            })}
            {!data.bills.length && (
              <EmptyState
                icon={Building2}
                title="No monthly bills yet"
                description="Add rent or a utility and everyone gets their own payment check."
                action={<Button size="sm" onClick={onAddBill}><Plus size={15} /> Add bill</Button>}
              />
            )}
            {data.bills.length > 4 && (
              <button
                className="mt-3 border-0 bg-transparent py-1 text-[.8rem] font-bold text-(--text-2) hover:text-(--text)"
                type="button"
                onClick={() => setShowAllBills((shown) => !shown)}
              >
                {showAllBills ? 'Show fewer bills' : 'View all bills'}
              </button>
            )}
          </div>
        </Card>

        <Card className="grid content-start gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2>Penalty account</h2>
            <Pill>Kept separate</Pill>
          </div>
          <Inner className="flex items-center gap-3.5 px-4 py-3">
            <Tile icon={ArrowDownLeft} tone="pink" />
            <div className="grid min-w-0 gap-0.5">
              <strong className="text-[.88rem] tabular-nums">
                {formatMoney(totalFundOwed)} outstanding
              </strong>
              <span className="text-[.73rem] text-(--text-3)">
                Kept separate from shared purchase balances
              </span>
            </div>
            {myFundOwed > 0 ? (
              <Button
                className="ml-auto shrink-0"
                size="sm"
                variant="secondary"
                onClick={() => {
                  const amount = window.prompt('How much did you pay into the household fund?')
                  const amountCents = Math.round(Number(amount) * 100)
                  if (amountCents > 0) void proposeFundPayment(amountCents)
                }}
              >
                Record payment
              </Button>
            ) : (
              <ChevronRight className="ml-auto shrink-0 text-(--text-4)" size={17} />
            )}
          </Inner>
          {data.fundPayments.map((payment) => {
            const member = data.members.find((item) => item.id === payment.memberId)!
            const canConfirm = payment.memberId !== currentMemberId && payment.status === 'pending'
            return (
              <div
                className="flex items-center gap-2.5 border-t border-(--line) pt-3"
                key={payment.id}
              >
                <Avatar
                  initials={member.initials}
                  color={member.color}
                  imageUrl={member.avatarUrl}
                  size="sm"
                />
                <span className="min-w-0 flex-1 truncate text-[.8rem]">
                  {member.displayName} paid {formatMoney(payment.amountCents)}
                </span>
                {canConfirm ? (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void confirmFundPayment(payment.id, false)}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => void confirmFundPayment(payment.id, true)}>
                      Confirm
                    </Button>
                  </div>
                ) : (
                  <Badge
                    tone={
                      payment.status === 'confirmed'
                        ? 'green'
                        : payment.status === 'rejected'
                          ? 'red'
                          : 'amber'
                    }
                  >
                    {payment.status}
                  </Badge>
                )}
              </div>
            )
          })}
        </Card>
      </section>
    </>
  )
}
