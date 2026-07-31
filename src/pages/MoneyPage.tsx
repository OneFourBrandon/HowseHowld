import { useState } from 'react'
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

  const submitExpense = async (event: React.FormEvent) => {
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
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">NO SPREADSHEETS, NO GUESSING</p>
          <h1>Shared money</h1>
          <p>Every purchase, share and payment stays balanced and traceable.</p>
        </div>
        <div className="button-row">
          <Button variant="secondary" onClick={() => setSettleModal(true)}>
            <WalletCards size={18} /> Settle up
          </Button>
          <Button onClick={() => setExpenseModal(true)}>
            <Plus size={18} /> Add purchase
          </Button>
        </div>
      </header>

      <div className="money-overview">
        <Card className="spend-card">
          <div>
            <p className="eyebrow">HOUSE SPEND</p>
            <strong>{formatMoney(totalHouseSpend)}</strong>
            <span>Across {data.expenses.filter((item) => !item.reversed).length} purchases</span>
          </div>
          <div className="spend-orb"><CircleDollarSign /></div>
        </Card>
        <Card className="balance-table-card">
          {data.balances.map((balance) => {
            const member = data.members.find((item) => item.id === balance.memberId)!
            return (
              <div className="balance-row" key={member.id}>
                <Avatar initials={member.initials} color={member.color} size="sm" />
                <div><strong>{member.displayName}</strong><span>{member.id === currentMemberId ? 'You' : 'Roommate'}</span></div>
                <div className="balance-breakdown">
                  <span>Paid {formatMoney(balance.contributionCents)}</span>
                  <span>Used {formatMoney(balance.resourceUseCents)}</span>
                </div>
                <strong className={balance.netCents >= 0 ? 'money-positive' : 'money-negative'}>
                  {formatMoney(balance.netCents, true)}
                </strong>
              </div>
            )
          })}
        </Card>
      </div>

      <section className="bill-section" id="bills">
        <div className="bill-section-heading">
          <div>
            <p className="eyebrow">MONTHLY HOUSE COSTS</p>
            <h2>Utilities &amp; rent</h2>
            <p>Check off your own payment each month. Unpaid roommates receive the selected reminders.</p>
          </div>
          <div className="bill-section-actions">
            <label>
              <span>Month</span>
              <input
                aria-label="Bills month"
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </label>
            <Button variant="secondary" onClick={() => setBillModal(true)}>
              <Plus size={18} /> Add bill
            </Button>
          </div>
        </div>
        <div className="bill-list">
          {data.bills.map((bill) => {
            const period = selectedPeriods.find((item) => item.billId === bill.id)
            const paid = Boolean(period?.paidMemberIds.includes(currentMemberId))
            const assignedMembers = data.members.filter((member) =>
              bill.memberIds.includes(member.id),
            )
            return (
              <div className="bill-row" key={bill.id}>
                <div className={`bill-icon bill-icon-${bill.category}`}>
                  <BillIcon category={bill.category} />
                </div>
                <div className="bill-main">
                  <strong>{bill.name}</strong>
                  <span>
                    Due {period ? formatDateTime(period.dueAt) : `day ${bill.dueDay}`}
                    {' · '}
                    <BellRing size={13} />
                    {bill.reminderDaysBefore.map((day) => day === 0 ? 'due day' : `${day}d`).join(', ')}
                  </span>
                </div>
                <div className="bill-roommates" aria-label={`${period?.paidMemberIds.length ?? 0} roommates paid`}>
                  {assignedMembers.map((member) => (
                    <span
                      className={period?.paidMemberIds.includes(member.id) ? 'is-paid' : ''}
                      key={member.id}
                      title={`${member.displayName}: ${period?.paidMemberIds.includes(member.id) ? 'paid' : 'unpaid'}`}
                    >
                      <Avatar initials={member.initials} color={member.color} size="sm" />
                      {period?.paidMemberIds.includes(member.id) && <Check size={11} />}
                    </span>
                  ))}
                </div>
                <strong className="bill-amount">
                  {period?.amountCents != null
                    ? formatMoney(period.amountCents)
                    : bill.amountCents != null
                      ? formatMoney(bill.amountCents)
                      : 'Variable'}
                </strong>
                {bill.memberIds.includes(currentMemberId) ? (
                  <label className="bill-paid-check">
                    <input
                      type="checkbox"
                      checked={paid}
                      disabled={!period || busy === `bill:paid:${period.id}`}
                      onChange={(event) => {
                        if (period) void setBillPaid(period.id, event.target.checked)
                      }}
                    />
                    <span>{paid ? 'Paid' : period ? 'Mark paid' : 'No period'}</span>
                  </label>
                ) : (
                  <span className="bill-not-assigned">Not assigned</span>
                )}
              </div>
            )
          })}
          {!data.bills.length && (
            <div className="bill-empty">
              <Building2 />
              <div><strong>No monthly bills yet</strong><span>Add rent or a utility to start tracking payments.</span></div>
            </div>
          )}
        </div>
      </section>

      <div className="content-grid-two money-content">
        <section>
          <SectionHeader eyebrow="LEDGER" title="Recent purchases" />
          <div className="expense-list">
            {data.expenses.map((expense) => {
              const creator = data.members.find((member) => member.id === expense.createdBy)!
              return (
                <Card className={`expense-card ${expense.reversed ? 'is-reversed' : ''}`} key={expense.id}>
                  <div className="expense-icon"><ReceiptText /></div>
                  <div className="expense-detail">
                    <div>
                      <strong>{expense.title}</strong>
                      {expense.reversed && <Badge tone="red">Reversed</Badge>}
                      {expense.receiptPath && <Badge><Camera size={12} /> Receipt</Badge>}
                    </div>
                    <span>Added by {creator.displayName} · {formatDateTime(expense.purchasedAt)}</span>
                    <div className="share-avatars">
                      {expense.beneficiaries.map((share) => {
                        const member = data.members.find((item) => item.id === share.memberId)!
                        return <Avatar key={member.id} initials={member.initials} color={member.color} size="sm" />
                      })}
                      <span>sharing</span>
                    </div>
                    {expense.receiptPath && (
                      <button
                        className="inline-link"
                        type="button"
                        onClick={() => openReceipt(expense.receiptPath!)}
                      >
                        <Camera size={14} /> View private receipt
                      </button>
                    )}
                  </div>
                  <div className="expense-amount">
                    <strong>{formatMoney(expense.amountCents)}</strong>
                    {!expense.reversed && expense.createdBy === currentMemberId && (
                      <button
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
          <div className="settlement-list">
            {data.settlements.map((settlement) => {
              const from = data.members.find((member) => member.id === settlement.fromMemberId)!
              const to = data.members.find((member) => member.id === settlement.toMemberId)!
              const awaitingMe = settlement.toMemberId === currentMemberId && settlement.status === 'pending'
              return (
                <Card className="settlement-card" key={settlement.id}>
                  <div className="settlement-people">
                    <Avatar initials={from.initials} color={from.color} size="sm" />
                    <ArrowUpRight size={17} />
                    <Avatar initials={to.initials} color={to.color} size="sm" />
                  </div>
                  <div>
                    <strong>{from.displayName} paid {to.displayName}</strong>
                    <span>{settlement.note || formatDateTime(settlement.createdAt)}</span>
                  </div>
                  <strong>{formatMoney(settlement.amountCents)}</strong>
                  {awaitingMe ? (
                    <div className="button-row">
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

          <div className="fund-section">
            <SectionHeader eyebrow="HOUSEHOLD FUND" title="Penalty account" />
            <Card className="fund-card">
              <div className="fund-icon"><ArrowDownLeft /></div>
              <div>
                <strong>{formatMoney(data.balances.reduce((sum, item) => sum + item.fundOwedCents, 0))} outstanding</strong>
                <span>Kept separate from shared purchase balances</span>
              </div>
              {(data.balances.find((item) => item.memberId === currentMemberId)?.fundOwedCents ?? 0) > 0 && (
                <Button
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
                <Card className="fund-payment-row" key={payment.id}>
                  <Avatar initials={member.initials} color={member.color} size="sm" />
                  <div>
                    <strong>{member.displayName} paid {formatMoney(payment.amountCents)}</strong>
                    <span>{formatDateTime(payment.createdAt)}</span>
                  </div>
                  {canConfirm ? (
                    <div className="button-row">
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
          className="form-grid"
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
          <label className="field-span-2">Name
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
          <label>Household amount (CAD) <span className="optional">Optional</span>
            <input type="number" min="0.01" step="0.01" value={billAmount} onChange={(event) => setBillAmount(event.target.value)} placeholder="Variable" />
          </label>
          <label className="field-span-2">Due day
            <input type="number" min="1" max="28" value={billDueDay} onChange={(event) => setBillDueDay(event.target.value)} required />
          </label>
          <fieldset className="field-span-2 compact-options">
            <legend>Remind unpaid roommates</legend>
            <div className="bill-reminder-options">
              {[7, 3, 1, 0].map((day) => (
                <label key={day}>
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
          <fieldset className="field-span-2 compact-options">
            <legend>Who needs to pay?</legend>
            <div className="bill-member-options">
              {data.members.map((member) => (
                <label key={member.id}>
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
                  <Avatar initials={member.initials} color={member.color} size="sm" />
                  {member.displayName}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="modal-actions field-span-2">
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
        <form className="form-grid" onSubmit={submitExpense}>
          <label className="field-span-2">What did you buy?
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Toilet paper" required />
          </label>
          <label>Amount (CAD)
            <input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required />
          </label>
          <label>Receipt photo
            <input type="file" accept="image/*" onChange={(event) => setReceipt(event.target.files?.[0])} />
          </label>
          <fieldset className="field-span-2">
            <legend>Who paid?</legend>
            <div className="member-amount-list">
              {data.members.map((member) => {
                const selected = payers.has(member.id)
                return (
                  <div className="member-amount-row" key={member.id}>
                    <label className="member-check">
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
                      <Avatar initials={member.initials} color={member.color} size="sm" />
                      {member.displayName}
                    </label>
                    {selected && (
                      <input
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
            <button type="button" className="inline-link" onClick={() => setPayerAmounts({})}>
              Use an equal payer split
            </button>
          </fieldset>
          <fieldset className="field-span-2">
            <legend>Who used it?</legend>
            <label className="compact-toggle">
              <input
                type="checkbox"
                checked={customShares}
                onChange={(event) => setCustomShares(event.target.checked)}
              />
              Enter custom shares
            </label>
            <div className="member-check-grid">
              {data.members.map((member) => (
                <label className="member-check" key={member.id}>
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
                  <Avatar initials={member.initials} color={member.color} size="sm" />
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
          <div className="split-preview field-span-2">
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
          <div className="modal-actions field-span-2">
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
          className="form-grid"
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
          <label className="field-span-2">Paid to
            <select value={settleTo} onChange={(event) => setSettleTo(event.target.value)}>
              {data.members.filter((member) => member.id !== currentMemberId).map((member) => (
                <option key={member.id} value={member.id}>{member.displayName}</option>
              ))}
            </select>
          </label>
          <label className="field-span-2">Amount (CAD)
            <input type="number" min="0.01" step="0.01" value={settleAmount} onChange={(event) => setSettleAmount(event.target.value)} required />
          </label>
          <div className="modal-actions field-span-2">
            <Button type="button" variant="ghost" onClick={() => setSettleModal(false)}>Cancel</Button>
            <Button type="submit">Send for confirmation</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
