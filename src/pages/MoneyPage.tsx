import { cn } from '../lib/cn'
import { type SubmitEvent, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  Building2,
  Camera,
  Check,
  CircleDollarSign,
  Droplets,
  Flame,
  Lightbulb,
  MoreHorizontal,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  WalletCards,
  Wifi,
} from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { Avatar, Badge, Button, Card, Modal, SectionHeader } from '../components/ui'
import { cents, formatDateTime, formatMoney, splitEvenly } from '../lib/utils'
import type { HouseholdBillCategory } from '../types'

const monthValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

function BillIcon({ category }: { category: HouseholdBillCategory }) {
  if (category === 'rent') return <Building2 />
  if (category === 'electricity') return <Lightbulb />
  if (category === 'water') return <Droplets />
  if (category === 'gas') return <Flame />
  if (category === 'internet') return <Wifi />
  if (category === 'insurance') return <ShieldCheck />
  return <MoreHorizontal />
}

export function MoneyPage() {
  const {
    data,
    busy,
    addExpense,
    reverseExpense,
    addSettlement,
    confirmSettlement,
    proposeFundPayment,
    confirmFundPayment,
    addBill,
    setBillPaid,
    openReceipt,
  } = useAppData()
  const [expenseModal, setExpenseModal] = useState(false)
  const [settleModal, setSettleModal] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(monthValue)
  const [billName, setBillName] = useState('')
  const [billCategory, setBillCategory] = useState<HouseholdBillCategory>('rent')
  const [billAmount, setBillAmount] = useState('')
  const [billDueDay, setBillDueDay] = useState('1')
  const [billReminders, setBillReminders] = useState(() => new Set([7, 3, 1, 0]))
  const [billMembers, setBillMembers] = useState(
    () => new Set(data.members.map((member) => member.id)),
  )
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [receipt, setReceipt] = useState<File | undefined>()
  const [beneficiaries, setBeneficiaries] = useState(
    () => new Set(data.members.map((member) => member.id)),
  )
  const [payers, setPayers] = useState(
    () => new Set([data.household.currentMemberId]),
  )
  const [customShares, setCustomShares] = useState(false)
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({})
  const [shareAmounts, setShareAmounts] = useState<Record<string, string>>({})
  const [settleTo, setSettleTo] = useState(
    data.members.find((member) => member.id !== data.household.currentMemberId)?.id ?? '',
  )
  const [settleAmount, setSettleAmount] = useState('')
  const currentMemberId = data.household.currentMemberId
  const totalHouseSpend = data.expenses
    .filter((expense) => !expense.reversed)
    .reduce((sum, expense) => sum + expense.amountCents, 0)
  const selectedPeriods = data.billPeriods.filter(
    (period) => period.periodMonth.slice(0, 7) === selectedMonth,
  )

  const submitExpense = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amountCents = Math.round(Number(amount) * 100)
    if (!title.trim() || amountCents <= 0 || !beneficiaries.size) return
    const payerSplit = Object.keys(payerAmounts).length
      ? [...payers].map((memberId) => ({
          memberId,
          amountCents: cents(Math.round(Number(payerAmounts[memberId] ?? 0) * 100)),
        }))
      : splitEvenly(amountCents, [...payers])
    const beneficiarySplit = customShares
      ? [...beneficiaries].map((memberId) => ({
          memberId,
          amountCents: cents(Math.round(Number(shareAmounts[memberId] ?? 0) * 100)),
        }))
      : splitEvenly(amountCents, [...beneficiaries])
    if (
      !payers.size
      || payerSplit.reduce((sum, item) => sum + item.amountCents, 0) !== amountCents
      || beneficiarySplit.reduce((sum, item) => sum + item.amountCents, 0) !== amountCents
    ) return
    await addExpense({
      title: title.trim(),
      amountCents: cents(amountCents),
      payers: payerSplit,
      beneficiaries: beneficiarySplit,
      receipt,
    })
    setTitle('')
    setAmount('')
    setReceipt(undefined)
    setExpenseModal(false)
  }

  return (
    <div className={"page-stack grid gap-14.5 max-[980px]:gap-13 max-[640px]:gap-11.5"}>
      <header className="page-header flex items-end justify-between gap-10 border-b border-b-(--line-strong) pb-7.5 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-5.5 max-[640px]:pb-4.5">
        <div className="grid gap-3.75">
          <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>NO SPREADSHEETS, NO GUESSING</p>
          <h1 className="text-[clamp(3.15rem,4.5vw,4.8rem)] max-[640px]:text-[clamp(2.55rem,13vw,3.35rem)]">Shared money</h1>
          <p>Every purchase, share and payment stays balanced and traceable.</p>
        </div>
        <div className="button-row flex flex-wrap items-center gap-2.25 max-[640px]:w-full">
          <Button variant="secondary" onClick={() => setSettleModal(true)}>
            <WalletCards size={18} /> Settle up
          </Button>
          <Button onClick={() => setExpenseModal(true)}>
            <Plus size={18} /> Add purchase
          </Button>
        </div>
      </header>

      <div className={"money-overview grid items-stretch max-[980px]:gap-8 grid-cols-[minmax(290px,.62fr)_minmax(0,1.38fr)] gap-14.5 max-[640px]:grid-cols-1 max-[640px]:gap-7.5"}>
        <Card className="spend-card flex min-h-55 items-center justify-between border-0 border-l-[3px] border-l-(--gold) bg-transparent p-[32px_34px] text-(--ink) max-[640px]:min-h-39.5 max-[640px]:p-[24px_0_24px_22px]">
          <div>
            <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>HOUSE SPEND</p>
            <strong className="mt-2.5 block font-display text-[2.8rem] font-[720]">{formatMoney(totalHouseSpend)}</strong>
            <span className="mt-1.25 block text-[.78rem] text-(--muted)">Across {data.expenses.filter((item) => !item.reversed).length} purchases</span>
          </div>
          <div className={"spend-orb w-10.5 h-10.5 grid place-items-center rounded-lg text-(--forest) bg-(--gold-soft)"}><CircleDollarSign /></div>
        </Card>
        <Card className={"balance-table-card p-0 border-t border-t-(--line) border-b border-b-(--line)"}>
          {data.balances.map((balance) => {
            const member = data.members.find((item) => item.id === balance.memberId)!
            return (
              <div className="balance-row grid min-h-21.5 grid-cols-[42px_minmax(140px,1fr)_auto_96px] items-center gap-x-4 border-t border-(--line) px-1 first:border-t-0 max-[640px]:grid-cols-[42px_1fr_auto]" key={member.id}>
                <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                <div><strong className="block text-[.88rem]">{member.displayName}</strong><span className="block text-[.75rem] leading-[1.4] text-(--muted)">{member.id === currentMemberId ? 'You' : 'Roommate'}</span></div>
                <div className={"balance-breakdown flex gap-7 font-sans tabular-nums max-[640px]:hidden"}>
                  <span>Paid {formatMoney(balance.contributionCents)}</span>
                  <span>Used {formatMoney(balance.resourceUseCents)}</span>
                </div>
                <strong className={cn('text-right font-sans text-[.88rem] tabular-nums', balance.netCents >= 0 ? 'money-positive text-(--green)!' : 'money-negative text-(--coral)!')}>
                  {formatMoney(balance.netCents, true)}
                </strong>
              </div>
            )
          })}
        </Card>
      </div>

      <section className={"bill-section grid gap-4.5 py-[10px_22px] border-y border-(--line)"} id="bills">
        <div className="bill-section-heading flex items-end justify-between gap-7 max-[760px]:flex-col max-[760px]:items-stretch">
          <div className="grid gap-1.5">
            <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>MONTHLY HOUSE COSTS</p>
            <h2 className="text-[clamp(1.65rem,2.4vw,2.15rem)]">Utilities &amp; rent</h2>
            <p>Check off your own payment each month. Unpaid roommates receive the selected reminders.</p>
          </div>
          <div className="bill-section-actions flex items-end gap-2.5 max-[760px]:justify-between max-[420px]:flex-col max-[420px]:items-stretch">
            <label className="grid gap-1.25 text-[.72rem] font-bold text-(--muted)">
              <span>Month</span>
              <input
                className="min-h-10.5 py-1.75 max-[420px]:w-full"
                aria-label="Bills month"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </label>
            <Button className="max-[420px]:w-full" variant="secondary" onClick={() => setBillModal(true)}>
              <Plus size={18} /> Add bill
            </Button>
          </div>
        </div>
        <div className={"bill-list border-t border-t-(--line)"}>
          {data.bills.map((bill) => {
            const period = selectedPeriods.find((item) => item.billId === bill.id)
            const paid = Boolean(period?.paidMemberIds.includes(currentMemberId))
            const assignedMembers = data.members.filter((member) =>
              bill.memberIds.includes(member.id),
            )
            return (
              <div className={"bill-row grid grid-cols-[46px_minmax(190px,1.35fr)_minmax(120px,.75fr)_auto_minmax(112px,auto)] items-center gap-4.5 min-h-22 p-[14px_2px] border-b border-b-(--line) max-[760px]:grid-cols-[42px_minmax(0,1fr)_auto] max-[760px]:gap-[10px_12px] max-[760px]:py-4"} key={bill.id}>
                <div
                  className={cn(
                    'bill-icon grid h-10.5 w-10.5 place-items-center rounded-[10px] bg-(--sage-2) text-(--forest) max-[760px]:row-[1]',
                    bill.category === 'electricity' && 'bg-[#fff3c8]! text-[#8a6a00]',
                    bill.category === 'gas' && 'bg-[#fbe8dd]! text-[#a34e28]',
                    bill.category === 'internet' && 'bg-[#e8e6f7]! text-[#5c5795]',
                    bill.category === 'rent' && 'bg-(--gold-soft)! text-[#8b6413]',
                    bill.category === 'water' && 'bg-[#e2f3f6]! text-[#287488]',
                  )}
                >
                  <BillIcon category={bill.category} />
                </div>
                <div className="bill-main grid gap-1.5 max-[760px]:col-[2/4]">
                  <strong className="text-[.94rem]">{bill.name}</strong>
                  <span className="flex items-center gap-1.25 text-[.75rem] text-(--muted)">
                    Due {period ? formatDateTime(period.dueAt) : `day ${bill.dueDay}`}
                    {' · '}
                    <BellRing size={13} />
                    {bill.reminderDaysBefore.map((day) => day === 0 ? 'due day' : `${day}d`).join(', ')}
                  </span>
                </div>
                <div className="bill-roommates flex min-w-29.5 items-center max-[760px]:col-[2] max-[760px]:min-w-0" aria-label={`${period?.paidMemberIds.length ?? 0} roommates paid`}>
                  {assignedMembers.map((member) => (
                    <span
                      className={cn(
                        'relative -ml-1.25 inline-grid opacity-[.42] first:ml-0', period?.paidMemberIds.includes(member.id) && 'is-paid opacity-100',
                      )}
                      key={member.id}
                      title={`${member.displayName}: ${period?.paidMemberIds.includes(member.id) ? 'paid' : 'unpaid'}`}
                    >
                      <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                      {period?.paidMemberIds.includes(member.id) && <Check className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full bg-(--forest) p-0.5 text-white shadow-[0_0_0_2px_var(--paper)]" size={11} />}
                    </span>
                  ))}
                </div>
                <strong className={"bill-amount min-w-23 text-right text-[.92rem] max-[760px]:col-[3] max-[760px]:row-[2]"}>
                  {period?.amountCents != null
                    ? formatMoney(period.amountCents)
                    : bill.amountCents != null
                      ? formatMoney(bill.amountCents)
                      : 'Variable'}
                </strong>
                {bill.memberIds.includes(currentMemberId) ? (
                  <label className="bill-paid-check inline-flex min-w-28 cursor-pointer items-center justify-start gap-2 text-[.82rem] font-[750] text-(--ink) max-[760px]:col-[2/4]">
                    <input
                      className="peer h-4.75 w-4.75"
                      type="checkbox"
                      checked={paid}
                      disabled={!period || busy === `bill:paid:${period.id}`}
                      onChange={(event) => {
                        if (period) void setBillPaid(period.id, event.target.checked)
                      }}
                    />
                    <span className="peer-checked:text-(--forest)">{paid ? 'Paid' : period ? 'Mark paid' : 'No period'}</span>
                  </label>
                ) : (
                  <span className={"bill-not-assigned text-(--muted) text-[.76rem] max-[760px]:col-[2/4]"}>Not assigned</span>
                )}
              </div>
            )
          })}
          {!data.bills.length && (
            <div className="bill-empty flex min-h-27.5 items-center gap-3.5 text-(--muted)">
              <Building2 />
              <div className="grid gap-0.75"><strong className="text-(--ink)">No monthly bills yet</strong><span className="text-[.8rem]">Add rent or a utility to start tracking payments.</span></div>
            </div>
          )}
        </div>
      </section>

      <div className={"content-grid-two grid grid-cols-[minmax(0,1.12fr)_minmax(300px,.88fr)] gap-6.25 items-start max-[980px]:grid-cols-1 max-[980px]:gap-12.5 money-content grid-cols-[1.15fr_.85fr] max-[980px]:grid-cols-1 gap-14.5 max-[980px]:gap-12.5"}>
        <section>
          <SectionHeader eyebrow="LEDGER" title="Recent purchases" />
          <div className={"expense-list grid gap-0"}>
            {data.expenses.map((expense) => {
              const creator = data.members.find((member) => member.id === expense.createdBy)!
              return (
                <Card
                  className={cn(
                    'expense-card grid min-h-28 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-b-(--line) px-1 py-5.5 max-[640px]:px-0',
                    expense.reversed && 'is-reversed opacity-[.58]',
                  )}
                  key={expense.id}
                >
                  <div className={"expense-icon w-9.75 h-9.75 grid place-items-center text-(--gold) bg-(--gold-soft) rounded-[7px]"}><ReceiptText /></div>
                  <div className="expense-detail grid gap-1.25">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-[.9rem]">{expense.title}</strong>
                      {expense.reversed && <Badge tone="red">Reversed</Badge>}
                      {expense.receiptPath && <Badge><Camera size={12} /> Receipt</Badge>}
                    </div>
                    <span>Added by {creator.displayName} · {formatDateTime(expense.purchasedAt)}</span>
                    <div className="share-avatars mt-1.75 flex items-center gap-0.75">
                      {expense.beneficiaries.map((share) => {
                        const member = data.members.find((item) => item.id === share.memberId)!
                        return <Avatar key={member.id} initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                      })}
                      <span className="ml-1.25 text-[.75rem] text-(--muted)">sharing</span>
                    </div>
                    {expense.receiptPath && (
                      <button
                        className={"inline-link inline-flex items-center gap-1.5 border-0 p-[4px_0] bg-transparent text-(--forest) [font:inherit] text-[.82rem] font-bold cursor-pointer"}
                        type="button"
                        onClick={() => openReceipt(expense.receiptPath!)}
                      >
                        <Camera size={14} /> View private receipt
                      </button>
                    )}
                  </div>
                  <div className="expense-amount grid justify-items-end gap-1.75 font-sans tabular-nums">
                    <strong className="text-[.9rem]">{formatMoney(expense.amountCents)}</strong>
                    {!expense.reversed && expense.createdBy === currentMemberId && (
                      <button className="inline-flex items-center gap-1 border-0 bg-transparent text-[.75rem] text-(--muted)"
                        onClick={() => {
                          const reason = window.prompt('Why are you reversing this purchase?')
                          if (reason?.trim()) reverseExpense(expense.id, reason.trim())
                        }}
                        aria-label={`Reverse ${expense.title}`}
                      >
                        <RotateCcw size={14} /> Reverse
                      </button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>

        <section>
          <SectionHeader eyebrow="CONFIRMATIONS" title="Payments" />
          <div className={"settlement-list grid gap-0"}>
            {data.settlements.map((settlement) => {
              const from = data.members.find((member) => member.id === settlement.fromMemberId)!
              const to = data.members.find((member) => member.id === settlement.toMemberId)!
              const awaitingMe = settlement.toMemberId === currentMemberId && settlement.status === 'pending'
              return (
                <Card className="settlement-card grid min-h-27 grid-cols-[auto_1fr_auto] items-center gap-2.5 border-b border-b-(--line) px-1 py-5.5 max-[640px]:px-0" key={settlement.id}>
                  <div className="settlement-people flex items-center gap-0.75">
                    <Avatar initials={from.initials} color={from.color} imageUrl={from.avatarUrl} size="sm" />
                    <ArrowUpRight className="text-(--muted)" size={17} />
                    <Avatar initials={to.initials} color={to.color} imageUrl={to.avatarUrl} size="sm" />
                  </div>
                  <div>
                    <strong className="block text-[.82rem]">{from.displayName} paid {to.displayName}</strong>
                    <span className="mt-0.75 block text-[.75rem] text-(--muted)">{settlement.note || formatDateTime(settlement.createdAt)}</span>
                  </div>
                  <strong className="text-[.82rem]">{formatMoney(settlement.amountCents)}</strong>
                  {awaitingMe ? (
                    <div className={"button-row flex items-center gap-2.25 flex-wrap"}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => confirmSettlement(settlement.id, false)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => confirmSettlement(settlement.id, true)}
                      >
                        <Check size={15} /> Confirm
                      </Button>
                    </div>
                  ) : (
                    <Badge tone={settlement.status === 'confirmed' ? 'green' : settlement.status === 'rejected' ? 'red' : 'amber'}>
                      {settlement.status}
                    </Badge>
                  )}
                </Card>
              )
            })}
          </div>

          <div className={"fund-section pt-2 max-[640px]:mt-11 mt-16.5"}>
            <SectionHeader eyebrow="HOUSEHOLD FUND" title="Penalty account" />
            <Card className="fund-card flex min-h-24 items-center gap-3 border-b border-b-(--line) px-1 py-5.25">
              <div className={"fund-icon w-10.5 h-10.5 grid place-items-center text-(--forest) bg-(--sage) rounded-lg"}><ArrowDownLeft /></div>
              <div>
                <strong className="block text-[.84rem]">{formatMoney(data.balances.reduce((sum, item) => sum + item.fundOwedCents, 0))} outstanding</strong>
                <span className="mt-0.75 block text-[.75rem] text-(--muted)">Kept separate from shared purchase balances</span>
              </div>
              {(data.balances.find((item) => item.memberId === currentMemberId)?.fundOwedCents ?? 0) > 0 && (
                <Button
                  className="ml-auto"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const amount = window.prompt('How much did you pay into the household fund?')
                    const amountCents = Math.round(Number(amount) * 100)
                    if (amountCents > 0) proposeFundPayment(amountCents)
                  }}
                >
                  Record payment
                </Button>
              )}
            </Card>
            {data.fundPayments.map((payment) => {
              const member = data.members.find((item) => item.id === payment.memberId)!
              const canConfirm = payment.memberId !== currentMemberId && payment.status === 'pending'
              return (
                <Card className="fund-payment-row mt-2 grid min-h-20 grid-cols-[auto_1fr_auto] items-center gap-2.25 border-b border-b-(--line) px-1 py-3.25" key={payment.id}>
                  <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                  <div>
                    <strong className="block text-[.84rem]">{member.displayName} paid {formatMoney(payment.amountCents)}</strong>
                    <span className="mt-0.75 block font-sans text-[.75rem] text-(--muted) tabular-nums">{formatDateTime(payment.createdAt)}</span>
                  </div>
                  {canConfirm ? (
                    <div className={"button-row flex items-center gap-2.25 flex-wrap"}>
                      <Button size="sm" variant="ghost" onClick={() => confirmFundPayment(payment.id, false)}>Reject</Button>
                      <Button size="sm" onClick={() => confirmFundPayment(payment.id, true)}>Confirm</Button>
                    </div>
                  ) : (
                    <Badge tone={payment.status === 'confirmed' ? 'green' : payment.status === 'rejected' ? 'red' : 'amber'}>
                      {payment.status}
                    </Badge>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      </div>

      <Modal
        open={billModal}
        onClose={() => setBillModal(false)}
        title="Add utilities or rent"
        description="A payment check is tracked separately for every assigned roommate each month."
      >
        <form
          className={"form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"}
          onSubmit={async (event) => {
            event.preventDefault()
            if (!billName.trim() || !billMembers.size) return
            const amountCents = billAmount ? Math.round(Number(billAmount) * 100) : undefined
            await addBill({
              name: billName.trim(),
              category: billCategory,
              amountCents: amountCents && amountCents > 0 ? cents(amountCents) : undefined,
              dueDay: Number(billDueDay),
              reminderDaysBefore: [...billReminders].sort((a, b) => b - a),
              memberIds: [...billMembers],
            })
            setBillName('')
            setBillAmount('')
            setBillModal(false)
          }}
        >
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Name
            <input value={billName} onChange={(event) => setBillName(event.target.value)} placeholder="Hydro" required />
          </label>
          <label>Type
            <select value={billCategory} onChange={(event) => setBillCategory(event.target.value as HouseholdBillCategory)}>
              <option value="rent">Rent</option>
              <option value="electricity">Electricity</option>
              <option value="water">Water</option>
              <option value="gas">Gas</option>
              <option value="internet">Internet</option>
              <option value="insurance">Insurance</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Household amount (CAD) <span className={"optional"}>Optional</span>
            <input type="number" min="0.01" step="0.01" value={billAmount} onChange={(event) => setBillAmount(event.target.value)} placeholder="Variable" />
          </label>
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Due day
            <input type="number" min="1" max="28" value={billDueDay} onChange={(event) => setBillDueDay(event.target.value)} required />
          </label>
          <fieldset className={"field-span-2 col-span-full max-[640px]:col-[1] compact-options py-[8px_14px] border-0 border-b border-b-(--line)"}>
            <legend>Remind unpaid roommates</legend>
            <div className="bill-reminder-options mt-1.75 grid grid-cols-2 gap-0 max-[420px]:grid-cols-1">
              {[7, 3, 1, 0].map((day) => (
                <label className="flex min-h-10.5 items-center gap-2.25 border-b border-b-(--line) text-[.84rem] font-[650]" key={day}>
                  <input
                    type="checkbox"
                    checked={billReminders.has(day)}
                    onChange={(event) => setBillReminders((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(day)
                      else next.delete(day)
                      return next
                    })}
                  />
                  {day === 0 ? 'Due day' : `${day} day${day === 1 ? '' : 's'} before`}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={"field-span-2 col-span-full max-[640px]:col-[1] compact-options py-[8px_14px] border-0 border-b border-b-(--line)"}>
            <legend>Who needs to pay?</legend>
            <div className="bill-member-options mt-1.75 grid gap-0">
              {data.members.map((member) => (
                <label className="flex min-h-10.5 items-center gap-2.25 border-b border-b-(--line) text-[.84rem] font-[650]" key={member.id}>
                  <input
                    type="checkbox"
                    checked={billMembers.has(member.id)}
                    onChange={(event) => setBillMembers((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(member.id)
                      else next.delete(member.id)
                      return next
                    })}
                  />
                  <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                  {member.displayName}
                </label>
              ))}
            </div>
          </fieldset>
          <div className={"modal-actions flex justify-end gap-2.25 mt-1.5 field-span-2 col-span-full max-[640px]:col-[1]"}>
            <Button type="button" variant="ghost" onClick={() => setBillModal(false)}>Cancel</Button>
            <Button type="submit" disabled={busy === 'bill:new'}>Add monthly bill</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
        title="Add a shared purchase"
        description="Amounts are stored in cents and posted as an immutable transaction."
      >
        <form className={"form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"} onSubmit={submitExpense}>
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>What did you buy?
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Toilet paper" required />
          </label>
          <label>Amount (CAD)
            <input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required />
          </label>
          <label>Receipt photo
            <input type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0])} />
          </label>
          <fieldset className={"field-span-2 col-span-full max-[640px]:col-[1]"}>
            <legend>Who paid?</legend>
            <div className={"member-amount-list grid gap-1.5 my-2"}>
              {data.members.map((member) => {
                const selected = payers.has(member.id)
                return (
                  <div className="member-amount-row grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 max-[560px]:grid-cols-1" key={member.id}>
                    <label className="member-check flex items-center gap-1.75 rounded-[10px] border border-(--line) bg-white p-2.25">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => setPayers((current) => {
                          const next = new Set(current)
                          if (event.target.checked) next.add(member.id)
                          else next.delete(member.id)
                          setPayerAmounts({})
                          return next
                        })}
                      />
                      <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                      {member.displayName}
                    </label>
                    {selected && (
                      <input
                        className="min-h-10"
                        aria-label={`${member.displayName} paid amount`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Equal"
                        value={payerAmounts[member.id] ?? ''}
                        onChange={(event) => setPayerAmounts((current) => ({
                          ...current,
                          [member.id]: event.target.value,
                        }))}
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <button type="button" className={"inline-link inline-flex items-center gap-1.5 border-0 p-[4px_0] bg-transparent text-(--forest) [font:inherit] text-[.82rem] font-bold cursor-pointer"} onClick={() => setPayerAmounts({})}>
              Use an equal payer split
            </button>
          </fieldset>
          <fieldset className={"field-span-2 col-span-full max-[640px]:col-[1]"}>
            <legend>Who used it?</legend>
            <label className={"compact-toggle text-(--muted) text-[.86rem]"}>
              <input
                type="checkbox"
                checked={customShares}
                onChange={(event) => setCustomShares(event.target.checked)}
              />
              Enter custom shares
            </label>
            <div className={"member-check-grid grid grid-cols-2 gap-2 max-[640px]:grid-cols-1"}>
              {data.members.map((member) => (
                <label className="member-check flex items-center gap-1.75 rounded-[10px] border border-(--line) bg-white p-2.25" key={member.id}>
                  <input
                    type="checkbox"
                    checked={beneficiaries.has(member.id)}
                    onChange={(event) => {
                      setBeneficiaries((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(member.id)
                        else next.delete(member.id)
                        return next
                      })
                    }}
                  />
                  <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                  {member.displayName}
                  {customShares && beneficiaries.has(member.id) && (
                    <input
                      aria-label={`${member.displayName} share amount`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={shareAmounts[member.id] ?? ''}
                      onChange={(event) => setShareAmounts((current) => ({
                        ...current,
                        [member.id]: event.target.value,
                      }))}
                    />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
          <div className={"split-preview p-[11px_13px] flex items-center justify-between rounded-[10px] text-[#5d6b64] bg-(--sage-2) text-[.78rem] field-span-2 col-span-full max-[640px]:col-[1]"}>
            <span>{customShares ? 'Custom share total' : 'Deterministic split preview'}</span>
            <strong>
              {beneficiaries.size && amount
                ? customShares
                  ? `${formatMoney(Object.values(shareAmounts).reduce(
                      (sum, value) => sum + Math.round(Number(value || 0) * 100),
                      0,
                    ))} of ${formatMoney(Math.round(Number(amount) * 100))}`
                  : splitEvenly(Math.round(Number(amount) * 100), [...beneficiaries])
                      .map((share) => `${data.members.find((member) => member.id === share.memberId)?.displayName}: ${formatMoney(share.amountCents)}`)
                      .join(' · ')
                : '—'}
            </strong>
          </div>
          <div className={"modal-actions flex justify-end gap-2.25 mt-1.5 field-span-2 col-span-full max-[640px]:col-[1]"}>
            <Button type="button" variant="ghost" onClick={() => setExpenseModal(false)}>Cancel</Button>
            <Button type="submit" disabled={busy === 'expense:new'}>Post purchase</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={settleModal}
        onClose={() => setSettleModal(false)}
        title="Record a direct payment"
        description="The recipient must confirm before balances change."
      >
        <form
          className={"form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"}
          onSubmit={async (event) => {
            event.preventDefault()
            const amountCents = Math.round(Number(settleAmount) * 100)
            if (!settleTo || amountCents <= 0) return
            await addSettlement({
              toMemberId: settleTo,
              amountCents: cents(amountCents),
              note: 'Direct household settlement',
            })
            setSettleAmount('')
            setSettleModal(false)
          }}
        >
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Paid to
            <select value={settleTo} onChange={(event) => setSettleTo(event.target.value)}>
              {data.members.filter((member) => member.id !== currentMemberId).map((member) => (
                <option key={member.id} value={member.id}>{member.displayName}</option>
              ))}
            </select>
          </label>
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Amount (CAD)
            <input type="number" min="0.01" step="0.01" value={settleAmount} onChange={(event) => setSettleAmount(event.target.value)} required />
          </label>
          <div className={"modal-actions flex justify-end gap-2.25 mt-1.5 field-span-2 col-span-full max-[640px]:col-[1]"}>
            <Button type="button" variant="ghost" onClick={() => setSettleModal(false)}>Cancel</Button>
            <Button type="submit">Send for confirmation</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
