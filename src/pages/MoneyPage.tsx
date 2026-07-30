import { useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  CircleDollarSign,
  Plus,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { Avatar, Badge, Button, Card, Modal, SectionHeader } from '../components/ui'
import { cents, formatDateTime, formatMoney } from '../lib/utils'

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
  } = useAppData()
  const [expenseModal, setExpenseModal] = useState(false)
  const [settleModal, setSettleModal] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [receipt, setReceipt] = useState<File | undefined>()
  const [beneficiaries, setBeneficiaries] = useState(
    () => new Set(data.members.map((member) => member.id)),
  )
  const [settleTo, setSettleTo] = useState(
    data.members.find((member) => member.id !== data.household.currentMemberId)?.id ?? '',
  )
  const [settleAmount, setSettleAmount] = useState('')
  const currentMemberId = data.household.currentMemberId
  const totalHouseSpend = data.expenses
    .filter((expense) => !expense.reversed)
    .reduce((sum, expense) => sum + expense.amountCents, 0)

  const submitExpense = async (event: React.FormEvent) => {
    event.preventDefault()
    const amountCents = Math.round(Number(amount) * 100)
    if (!title.trim() || amountCents <= 0 || !beneficiaries.size) return
    await addExpense({
      title: title.trim(),
      amountCents: cents(amountCents),
      payerIds: [currentMemberId],
      beneficiaryIds: [...beneficiaries],
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
        </section>
      </div>

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
            <legend>Who used it?</legend>
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
                </label>
              ))}
            </div>
          </fieldset>
          <div className="split-preview field-span-2">
            <span>Equal split preview</span>
            <strong>
              {beneficiaries.size && amount
                ? `${formatMoney(Math.round(Number(amount) * 100 / beneficiaries.size))} each`
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
