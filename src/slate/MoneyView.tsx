import { type CSSProperties, useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  Building2,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Flame,
  Lightbulb,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  ShieldCheck,
  Trash2,
  Wifi,
} from 'lucide-react'
import { ExpenseCategoryIcon } from '../components/ExpenseCategoryIcon'
import { MemberMoneyDetails } from '../components/MemberMoneyDetails'
import { PurchaseDetails } from '../components/PurchaseDetails'
import { ShareBar } from '../components/ShareBreakdown'
import { cn } from '../lib/cn'
import { getExpenseCategory } from '../lib/expenseCategories'
import { categoryTotals, shiftMonth, spendCurve, todayKey } from '../lib/insights'
import { billBreakdown, expenseBreakdown } from '../lib/shares'
import type { SpendingCategory } from '../lib/spending'
import { dateKeyInTimeZone, formatMoney } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { Expense, HouseholdBillCategory, Settlement } from '../types'
import { AskDialog } from './AskDialog'
import { AreaChart } from './charts'
import { Chip, Empty, Face, Meter, Panel, Segmented, Stat, Stats, Tile } from './ui'
import { useHouse } from './useHouse'

const monthTitle = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthName = new Intl.DateTimeFormat('en-CA', { month: 'long', timeZone: 'UTC' })
const dayLabel = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
const dueLabel = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' })
const compactMoney = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', notation: 'compact', maximumFractionDigits: 1,
})

const monthDate = (month: string) => new Date(`${month}-01T12:00:00Z`)

function BillIcon({ category }: { category: HouseholdBillCategory }) {
  const size = 16
  if (category === 'rent') return <Building2 size={size} />
  if (category === 'electricity') return <Lightbulb size={size} />
  if (category === 'water') return <Droplets size={size} />
  if (category === 'gas') return <Flame size={size} />
  if (category === 'internet') return <Wifi size={size} />
  if (category === 'insurance') return <ShieldCheck size={size} />
  return <Receipt size={size} />
}

type Activity =
  | { kind: 'expense'; date: string; item: Expense }
  | { kind: 'settlement'; date: string; item: Settlement }

type Ask =
  | { type: 'delete-expense'; expense: Expense }
  | { type: 'delete-settlement'; settlement: Settlement; label: string }
  | { type: 'fund-payment' }

/** The slate layout for Money. The dialogs for bills, purchases and payments stay with MoneyPage. */
export function MoneyView({
  selectedMonth,
  onMonthChange,
  onSettle,
  onAddPurchase,
  onAddBill,
  onEditBill,
}: {
  selectedMonth: string
  onMonthChange: (month: string) => void
  onSettle: () => void
  onAddPurchase: () => void
  onAddBill: () => void
  onEditBill: (id: string) => void
}) {
  const {
    data,
    busy,
    reverseExpense,
    confirmSettlement,
    deleteSettlement,
    proposeFundPayment,
    confirmFundPayment,
    openReceipt,
  } = useAppData()
  const { now, me, isOwner, money, balances } = useHouse()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [memberDetailId, setMemberDetailId] = useState<string | null>(null)
  const [activityFilter, setActivityFilter] = useState<'all' | 'expense' | 'settlement'>('all')
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null)
  const [category, setCategory] = useState<SpendingCategory | null>(null)
  const [ask, setAsk] = useState<Ask | null>(null)

  const currentMonth = todayKey(data, now).slice(0, 7)
  // MoneyPage opens on the device's month, so that is the month this button goes back to.
  const device = new Date(now)
  const deviceMonth = `${device.getFullYear()}-${String(device.getMonth() + 1).padStart(2, '0')}`
  const memberById = (id?: string) => data.members.find(member => member.id === id)
  const selectedExpense = data.expenses.find(expense => expense.id === detailId)
  const detailMember = memberById(memberDetailId ?? undefined)

  const mine = money.get(me.id)
  const paidCents = mine?.paidCents ?? 0
  const usedCents = mine?.usedCents ?? 0
  const netCents = mine?.netCents ?? 0
  const flowPeak = Math.max(paidCents, usedCents, 1)

  const spending = useMemo(() => categoryTotals(data, selectedMonth), [data, selectedMonth])
  const curve = useMemo(() => spendCurve(data, selectedMonth, now), [data, now, selectedMonth])
  const previous = useMemo(() => spendCurve(data, shiftMonth(selectedMonth, -1), now), [data, now, selectedMonth])
  const compare = previous.totalCents > 0
    ? Array.from({ length: curve.days }, (_, index) => previous.cumulative[Math.min(index, previous.days - 1)])
    : undefined
  const change = previous.totalCents > 0 ? (curve.totalCents - previous.totalCents) / previous.totalCents : null
  const purchaseCount = spending.entries.filter(entry => entry.id.startsWith('expense:')).length
  const billCount = spending.entries.length - purchaseCount
  const listed = category ? spending.entries.filter(entry => entry.category === category) : spending.entries
  const dueDayByEntry = new Map(data.billPeriods.map(period => [
    `bill:${period.id}`,
    dateKeyInTimeZone(new Date(period.dueAt), data.household.timezone),
  ]))

  const maxBalance = Math.max(1, ...[...balances.values()].map(Math.abs))

  const activities = useMemo(() => {
    const combined: Activity[] = [
      ...data.expenses.map((item): Activity => ({ kind: 'expense', date: item.purchasedAt, item })),
      ...data.settlements.map((item): Activity => ({ kind: 'settlement', date: item.createdAt, item })),
    ]
    return combined
      .filter(activity => activityFilter === 'all' || activity.kind === activityFilter)
      .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
  }, [activityFilter, data.expenses, data.settlements])
  const visibleActivities = showAllActivity ? activities : activities.slice(0, 8)

  const selectedPeriods = data.billPeriods.filter(period => period.periodMonth.slice(0, 7) === selectedMonth)
  const totalFundOwed = data.balances.reduce((sum, balance) => sum + balance.fundOwedCents, 0)
  const myFundOwed = mine?.fundOwedCents ?? 0

  return (
    <>
      {selectedExpense && <PurchaseDetails key={selectedExpense.id} expense={selectedExpense} onClose={() => setDetailId(null)} />}
      {detailMember && (
        <MemberMoneyDetails
          key={detailMember.id}
          member={detailMember}
          initialMonth={selectedMonth}
          netCents={balances.get(detailMember.id) ?? 0}
          onClose={() => setMemberDetailId(null)}
        />
      )}
      {ask?.type === 'delete-expense' && (
        <AskDialog
          title={`Delete ${ask.expense.title}?`}
          description="The charge is reversed for everyone it was split with. Your reason is kept in the house history."
          field={{ label: 'Why are you deleting it?', kind: 'text', placeholder: 'Entered twice, wrong amount…' }}
          confirmLabel="Delete charge"
          danger
          onConfirm={reason => reverseExpense(ask.expense.id, reason)}
          onClose={() => setAsk(null)}
        />
      )}
      {ask?.type === 'delete-settlement' && (
        <AskDialog
          title="Delete this payment?"
          description={`${ask.label}. Balances go back to what they were before it.`}
          field={{ label: 'Why are you deleting it?', kind: 'text', placeholder: 'Recorded by mistake…' }}
          confirmLabel="Delete payment"
          danger
          onConfirm={reason => deleteSettlement(ask.settlement.id, reason)}
          onClose={() => setAsk(null)}
        />
      )}
      {ask?.type === 'fund-payment' && (
        <AskDialog
          title="Record a penalty payment"
          description={`You owe ${formatMoney(myFundOwed)} to the penalty account. A roommate confirms the payment before it counts.`}
          field={{ label: 'Amount paid (CAD)', kind: 'money', placeholder: (myFundOwed / 100).toFixed(2) }}
          confirmLabel="Record payment"
          onConfirm={value => proposeFundPayment(Math.round(Number(value) * 100))}
          onClose={() => setAsk(null)}
        />
      )}

      <div className="sl-toolbar">
        <div className="sl-toolbar-group">
          <div className="sl-seg" role="group" aria-label="Month">
            <button type="button" className="px-1.5!" onClick={() => onMonthChange(shiftMonth(selectedMonth, -1))} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <span className="grid min-w-34 place-items-center px-2 text-(length:--sl-fs-meta) font-[560] text-(--sl-ink)" aria-live="polite">
              {monthTitle.format(monthDate(selectedMonth))}
            </span>
            <button type="button" className="px-1.5!" onClick={() => onMonthChange(shiftMonth(selectedMonth, 1))} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          {selectedMonth !== deviceMonth && (
            <button type="button" className="sl-btn sl-btn-sm" onClick={() => onMonthChange(deviceMonth)}>Back to this month</button>
          )}
        </div>
        <div className="sl-toolbar-group">
          <button type="button" className="sl-btn sl-btn-secondary" onClick={onSettle}>
            <ArrowRightLeft size={15} /> Settle up
          </button>
          <button type="button" className="sl-btn sl-btn-primary" onClick={onAddPurchase}>
            <Plus size={16} strokeWidth={2.2} /> Add purchase
          </button>
        </div>
      </div>

      <div className="sl-grid">
        <Panel className="col-span-12 lg:col-span-4" title="Your balance" note="Across every month">
          <p className={cn('sl-reading sl-reading-lg', netCents < 0 ? 'text-(--sl-brick)' : netCents > 0 ? 'text-(--sl-moss)' : undefined)}>
            {formatMoney(Math.abs(netCents))}
          </p>
          <p className="sl-meta mt-1.5">
            {netCents < 0 ? 'You owe the house. Pay a roommate, then record it with Settle up.'
              : netCents > 0 ? 'The house owes you.'
                : 'You are settled up with the house.'}
          </p>
          <div className="mt-5 grid gap-2">
            <Meter tone="moss" label="You paid" display={formatMoney(paidCents)} value={paidCents / flowPeak} />
            <Meter tone="steel" label="Your share" display={formatMoney(usedCents)} value={usedCents / flowPeak} />
          </div>
        </Panel>

        <Panel
          className="col-span-12 lg:col-span-8"
          title={`Spending in ${monthName.format(monthDate(selectedMonth))}`}
          note="Shared purchases and bills, as a running total"
        >
          <Stats cols={4} colsSm={2} className="mb-5">
            <Stat tone="moss" label="Month total" value={formatMoney(curve.totalCents)} />
            <Stat
              tone="ink"
              label={`${monthName.format(monthDate(previous.month))} total`}
              value={previous.totalCents ? formatMoney(previous.totalCents) : '–'}
              note={change === null ? undefined : `${change >= 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(change * 100))}% since`}
            />
            <Stat tone="steel" label="Purchases" value={purchaseCount} />
            <Stat tone="brass" label="Bills" value={billCount} />
          </Stats>
          {curve.totalCents > 0 ? (
            <>
              <AreaChart
                label={`Running total of spending in ${monthTitle.format(monthDate(selectedMonth))}, ${formatMoney(curve.totalCents)} in all`}
                values={curve.cumulative}
                through={curve.through}
                compare={compare}
                formatY={value => compactMoney.format(value / 100)}
                xLabels={[1, 8, 15, 22, curve.days].map(day => ({ at: day - 1, label: String(day) }))}
              />
              <ul className="sl-micro mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                <li className="flex items-center gap-2"><i className="sl-key sl-tone-moss" data-fill="solid" />Spent so far</li>
                {curve.through < curve.days && (
                  <li className="flex items-center gap-2"><i className="sl-key sl-tone-moss" data-fill="hatch" />Bills still to come</li>
                )}
                {compare && <li className="flex items-center gap-2"><i className="sl-key-line" />{monthName.format(monthDate(previous.month))}</li>}
              </ul>
            </>
          ) : (
            <Empty title={selectedMonth > currentMonth ? 'Nothing is scheduled for this month yet' : 'Nothing spent this month'}>
              Purchases and bills with a price show up here.
            </Empty>
          )}
        </Panel>

        <Panel
          className="col-span-12 lg:col-span-5"
          title="Where it went"
          note={category ? 'Showing one category. Pick it again to clear.' : 'Pick a category to see what is in it.'}
        >
          <div className="grid gap-2" role="group" aria-label="Spending categories">
            {spending.categories.map(item => (
              <button
                type="button"
                key={item.category}
                className={cn('sl-meter-btn', category && category !== item.category && 'opacity-45')}
                aria-pressed={category === item.category}
                onClick={() => setCategory(category === item.category ? null : item.category)}
              >
                <Meter
                  tone={item.category === 'rent' ? 'brass' : item.category === 'utilities' || item.category === 'insurance' ? 'steel' : 'moss'}
                  label={item.label}
                  hint={`${Math.round(item.share * 100)}%`}
                  display={formatMoney(item.amountCents)}
                  value={item.share}
                />
              </button>
            ))}
          </div>
          {!spending.categories.length && <Empty title="No spending to break down" />}
          {listed.length > 0 && (
            <ul className="mt-4 border-t border-(--sl-line)" aria-live="polite">
              {listed.slice(0, 6).map(entry => (
                <li key={entry.id} className="flex items-center justify-between gap-3 border-b border-(--sl-line) py-2.5">
                  <span className="min-w-0">
                    <span className="sl-cell-main font-[480]">{entry.title}</span>
                    <span className="sl-cell-sub">
                      {dueDayByEntry.has(entry.id) ? 'Bill, due ' : ''}
                      {dueLabel.format(new Date(`${dueDayByEntry.get(entry.id) ?? entry.date}T12:00:00`))}
                    </span>
                  </span>
                  <span className="sl-num sl-strong">{formatMoney(entry.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
          {listed.length > 6 && <p className="sl-micro mt-2.5">And {listed.length - 6} more this month.</p>}
          <p className="sl-micro mt-3">Leaves out deleted purchases, bills without a price, penalties and transfers.</p>
        </Panel>

        <Panel className="col-span-12 lg:col-span-7" flush title="Balances" note="Pick a roommate to see how their balance adds up.">
          <div className="mt-3">
            <table className="sl-table">
              <thead>
                <tr>
                  <th>Roommate</th>
                  <th className="is-num max-sm:hidden">Paid</th>
                  <th className="is-num max-sm:hidden">Share</th>
                  <th className="max-md:hidden"><span className="sr-only">Balance, drawn</span></th>
                  <th className="is-num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {[...money].map(([memberId, row]) => {
                  const member = memberById(memberId)
                  if (!member) return null
                  const net = row.netCents
                  const open = () => setMemberDetailId(member.id)
                  return (
                    // The row stays a table row so its figures are read out. The button is the keyboard way in;
                    // clicking anywhere on the row is a shortcut for the mouse.
                    <tr key={member.id} className="is-link" onClick={open}>
                      <td>
                        <button
                          type="button"
                          className="sl-plain-btn flex items-center gap-2.5"
                          aria-label={`View balance for ${member.displayName}`}
                          onClick={event => {
                            event.stopPropagation()
                            open()
                          }}
                        >
                          <Face member={member} size={28} />
                          <span className="min-w-0">
                            <span className="sl-cell-main">{member.displayName}</span>
                            <span className="sl-cell-sub">{member.id === me.id ? 'You' : net > 0 ? 'Is owed' : net < 0 ? 'Owes' : 'Settled'}</span>
                          </span>
                        </button>
                      </td>
                      <td className="is-num max-sm:hidden">{formatMoney(row.paidCents)}</td>
                      <td className="is-num max-sm:hidden">{formatMoney(row.usedCents)}</td>
                      <td className="max-md:hidden">
                        <span
                          className={cn('sl-diverge', net < 0 ? 'sl-tone-brick' : 'sl-tone-moss')}
                          data-side={net < 0 ? 'owes' : net > 0 ? 'owed' : 'even'}
                          style={{ '--value': `${(Math.abs(net) / maxBalance) * 50}%` } as CSSProperties}
                          aria-hidden="true"
                        ><i /></span>
                      </td>
                      <td className={cn('is-num font-[560]', net < 0 ? 'text-(--sl-brick)' : net > 0 ? 'text-(--sl-moss)' : 'text-(--sl-muted)')}>
                        {net === 0 ? 'Settled' : formatMoney(net, true)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          className="col-span-12 lg:col-span-7 lg:row-span-2"
          flush
          title="Activity"
          tools={(
            <Segmented
              label="Filter activity"
              value={activityFilter}
              onChange={setActivityFilter}
              options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Purchases' }, { value: 'settlement', label: 'Payments' }]}
            />
          )}
        >
          <div className="mt-3">
            {visibleActivities.map((activity, index) => {
              const earlier = visibleActivities[index - 1]
              const showDate = !earlier || new Date(earlier.date).toDateString() !== new Date(activity.date).toDateString()
              const dateBand = showDate && <h3 className="sl-subhead">{dayLabel.format(new Date(activity.date))}</h3>

              if (activity.kind === 'expense') {
                const expense = activity.item
                const breakdown = expenseBreakdown(expense, data.members, me.id)
                const payers = expense.payers.map(payer => memberById(payer.memberId)?.displayName).filter(Boolean)
                const canDelete = !expense.reversed && (expense.createdBy === me.id || isOwner)
                const open = () => setDetailId(expense.id)
                return (
                  <div key={`expense-${expense.id}`}>
                    {dateBand}
                    <div
                      className={cn('sl-row cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto] transition-colors hover:bg-(--sl-hover) max-sm:grid-cols-[auto_minmax(0,1fr)_auto]', expense.reversed && 'opacity-50')}
                      role="button"
                      tabIndex={0}
                      aria-label={`View breakdown for ${expense.title}`}
                      onClick={open}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          open()
                        }
                      }}
                    >
                      <ExpenseCategoryIcon category={expense.category} className="size-8! rounded-lg! [&_svg]:size-4!" />
                      <div className="min-w-0">
                        <span className="sl-cell-main">{expense.title}{expense.reversed && ' (deleted)'}</span>
                        <span className="sl-cell-sub">
                          {payers.join(' and ')} paid, {getExpenseCategory(expense.category).label.toLowerCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 max-sm:hidden">
                        <ShareBar className="w-20 shrink-0" height={5} breakdown={breakdown} />
                        <span className="sl-micro sl-num w-24 whitespace-nowrap">
                          Your share {formatMoney(breakdown.mine?.owedCents ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <strong className="sl-num mr-1.5 min-w-16 text-right font-[560]">{formatMoney(expense.amountCents)}</strong>
                        {expense.receiptPath && (
                          <button type="button" className="sl-icon-btn" onClick={event => { event.stopPropagation(); void openReceipt(expense.receiptPath!) }} aria-label={`Open receipt for ${expense.title}`}>
                            <Camera size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className="sl-icon-btn" onClick={event => { event.stopPropagation(); setAsk({ type: 'delete-expense', expense }) }} aria-label={`Delete charge ${expense.title}`}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }

              const settlement = activity.item
              const from = memberById(settlement.fromMemberId)
              const to = memberById(settlement.toMemberId)
              const awaitingMe = settlement.toMemberId === me.id && settlement.status === 'pending'
              const label = `${from?.displayName ?? 'A roommate'} paid ${to?.id === me.id ? 'you' : to?.displayName ?? 'a roommate'} ${formatMoney(settlement.amountCents)}`
              return (
                <div key={`settlement-${settlement.id}`}>
                  {dateBand}
                  <div className="sl-row grid-cols-[auto_minmax(0,1fr)_auto] max-sm:grid-cols-[auto_minmax(0,1fr)]">
                    <Tile tone="brass"><ArrowRightLeft size={16} /></Tile>
                    <div className="min-w-0">
                      <span className="sl-cell-main">
                        {settlement.toMemberId === me.id ? `Payment from ${from?.displayName}` : `Payment to ${to?.displayName}`}
                      </span>
                      <span className="sl-cell-sub">{settlement.note || 'Direct payment'}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 max-sm:col-span-full">
                      <strong className="sl-num font-[560]">{formatMoney(settlement.amountCents)}</strong>
                      {awaitingMe ? (
                        <>
                          <button type="button" className="sl-btn sl-btn-sm" disabled={busy === `settlement:${settlement.id}`} onClick={() => void confirmSettlement(settlement.id, false).catch(() => {})}>Reject</button>
                          <button type="button" className="sl-btn sl-btn-primary sl-btn-sm" disabled={busy === `settlement:${settlement.id}`} onClick={() => void confirmSettlement(settlement.id, true).catch(() => {})}>
                            <Check size={14} /> Confirm
                          </button>
                        </>
                      ) : (
                        <Chip tone={settlement.status === 'confirmed' ? 'moss' : settlement.status === 'rejected' ? 'brick' : 'brass'}>
                          {settlement.status === 'confirmed' ? 'Confirmed' : settlement.status === 'rejected' ? 'Rejected' : 'Awaiting confirmation'}
                        </Chip>
                      )}
                      {(settlement.fromMemberId === me.id || isOwner) && (
                        <button
                          type="button"
                          className="sl-icon-btn"
                          disabled={busy === `settlement:delete:${settlement.id}`}
                          aria-label={`Delete payment from ${from?.displayName} to ${to?.displayName}`}
                          onClick={() => setAsk({ type: 'delete-settlement', settlement, label })}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {!activities.length && (
            <Empty title="No activity yet">
              Add a purchase and it is split and tracked from here.
            </Empty>
          )}
          {activities.length > 8 && (
            <div className="border-t border-(--sl-line) px-(--sl-pad) py-2.5">
              <button type="button" className="sl-link" onClick={() => setShowAllActivity(shown => !shown)}>
                {showAllActivity ? 'Show less' : `Show all ${activities.length}`}
              </button>
            </div>
          )}
        </Panel>

        <Panel
          className="col-span-12 lg:col-span-5"
          flush
          id="bills"
          title="Rent and utilities"
          note={`${monthTitle.format(monthDate(selectedMonth))}. Shares are settled with direct payments.`}
          tools={<button type="button" className="sl-btn sl-btn-secondary sl-btn-sm" onClick={onAddBill}><Plus size={14} /> Add bill</button>}
        >
          <div className="sl-rows mt-3 border-t border-(--sl-line)">
            {data.bills.map(bill => {
              const period = selectedPeriods.find(item => item.billId === bill.id)
              const amount = period?.amountCents
              const pending = amount == null
              const breakdown = billBreakdown(bill, period, data.members, me.id)
              const payeeId = period?.payeeMemberId ?? bill.payeeMemberId
              const payee = memberById(payeeId)
              const expanded = expandedBillId === bill.id
              const toggle = () => setExpandedBillId(expanded ? null : bill.id)
              const myShare = payeeId === me.id ? 0 : breakdown.mine?.owedCents
              return (
                <div key={bill.id}>
                  <div
                    className="sl-row cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto] transition-colors hover:bg-(--sl-hover)"
                    role="button"
                    tabIndex={0}
                    aria-label={`View payment breakdown for ${bill.name}`}
                    aria-expanded={expanded}
                    onClick={event => {
                      if ((event.target as HTMLElement).closest('button')) return
                      toggle()
                    }}
                    onKeyDown={event => {
                      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault()
                        toggle()
                      }
                    }}
                  >
                    <Tile tone={bill.category === 'rent' ? 'brass' : 'steel'}><BillIcon category={bill.category} /></Tile>
                    <div className="min-w-0">
                      <span className="sl-cell-main">{bill.name}</span>
                      <span className="sl-cell-sub">
                        Due {period ? dueLabel.format(new Date(period.dueAt)) : `day ${bill.dueDay}`}, owed to {payeeId === me.id ? 'you' : payee?.displayName ?? 'the bill payer'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={cn('sl-cell-main sl-num', pending && 'text-(--sl-muted)')}>
                        {pending ? (bill.requiresMonthlyPrice || period ? 'Pending' : 'No price') : formatMoney(amount)}
                      </span>
                      {!pending && myShare != null && (
                        <span className="sl-cell-sub sl-num">{payeeId === me.id ? 'You collect it' : `Yours ${formatMoney(myShare)}`}</span>
                      )}
                    </div>
                    <div className="flex items-center">
                      {isOwner && (
                        <button type="button" className="sl-icon-btn" aria-label={`Edit ${bill.name}`} onClick={() => onEditBill(bill.id)}>
                          <Pencil size={14} />
                        </button>
                      )}
                      <ChevronDown size={16} className={cn('text-(--sl-muted) transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                    </div>
                  </div>
                  {expanded && (
                    <div className="grid gap-0 bg-(--sl-well) px-(--sl-pad) py-3" aria-label={`${bill.name} payment breakdown`}>
                      <p className="sl-micro pb-2">
                        {pending
                          ? 'The price for this month has not been entered yet.'
                          : `Record a direct payment to ${payeeId === me.id ? 'yourself' : payee?.displayName ?? 'the bill payer'} with Settle up. Confirmed payments lower your balance.`}
                      </p>
                      {breakdown.shares.map(share => (
                        <div className="flex min-h-10 items-center gap-2.5 border-t border-(--sl-line)" key={share.member.id}>
                          <Face member={share.member} size={24} />
                          <span className="min-w-0 flex-1">
                            <span className="sl-cell-main font-[480]">{share.member.displayName}</span>
                          </span>
                          <span className="sl-micro">{share.member.id === payeeId ? 'Pays the bill' : 'Owes their share'}</span>
                          <span className="sl-num w-20 text-right font-[560]">
                            {pending ? 'Pending' : formatMoney(share.member.id === payeeId ? 0 : share.owedCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {!data.bills.length && (
            <Empty title="No monthly bills yet">
              Add rent or a utility and each roommate’s share is worked out every month.
            </Empty>
          )}
        </Panel>

        <Panel
          className="col-span-12 lg:col-span-5"
          flush
          title="Penalty account"
          note="Fines from missed chores. Kept apart from shared purchases."
          tools={myFundOwed > 0
            ? <button type="button" className="sl-btn sl-btn-secondary sl-btn-sm" onClick={() => setAsk({ type: 'fund-payment' })}>Record payment</button>
            : undefined}
        >
          <div className="flex items-center gap-3 px-(--sl-pad) pt-1 pb-4">
            <Tile tone={totalFundOwed > 0 ? 'brass' : 'moss'}><PiggyBank size={16} /></Tile>
            <div>
              <p className="sl-reading text-[1.25rem]!">{formatMoney(totalFundOwed)}</p>
              <p className="sl-micro mt-1">
                {totalFundOwed === 0 ? 'Nothing is owed to the account.'
                  : myFundOwed > 0 ? `Outstanding, ${formatMoney(myFundOwed)} of it yours.` : 'Outstanding across the house.'}
              </p>
            </div>
          </div>
          {data.fundPayments.length > 0 && (
            <div className="sl-rows border-t border-(--sl-line)">
              {data.fundPayments.map(payment => {
                const member = memberById(payment.memberId)
                const canConfirm = payment.memberId !== me.id && payment.status === 'pending'
                return (
                  <div className="sl-row grid-cols-[auto_minmax(0,1fr)_auto]" key={payment.id}>
                    {member ? <Face member={member} size={24} /> : <span />}
                    <span className="min-w-0 truncate">{member?.displayName ?? 'A roommate'} paid <span className="sl-num sl-strong">{formatMoney(payment.amountCents)}</span></span>
                    {canConfirm ? (
                      <span className="flex gap-1.5">
                        <button type="button" className="sl-btn sl-btn-sm" disabled={busy === `fund:${payment.id}`} onClick={() => void confirmFundPayment(payment.id, false).catch(() => {})}>Reject</button>
                        <button type="button" className="sl-btn sl-btn-primary sl-btn-sm" disabled={busy === `fund:${payment.id}`} onClick={() => void confirmFundPayment(payment.id, true).catch(() => {})}>Confirm</button>
                      </span>
                    ) : (
                      <Chip tone={payment.status === 'confirmed' ? 'moss' : payment.status === 'rejected' ? 'brick' : 'brass'}>
                        {payment.status === 'confirmed' ? 'Confirmed' : payment.status === 'rejected' ? 'Rejected' : 'Awaiting confirmation'}
                      </Chip>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
