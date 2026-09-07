import { useState } from 'react'
import { Avatar, Button, Modal } from '../components/ui'
import { MoneyDashboard } from '../components/MoneyDashboard'
import { SharedPurchaseModal } from '../components/SharedPurchaseModal'
import { cents } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { HouseholdBillCategory } from '../types'

const monthValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export function MoneyPage() {
  const {
    data,
    busy,
    addSettlement,
    addBill,
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
  const [settleTo, setSettleTo] = useState(
    data.members.find((member) => member.id !== data.household.currentMemberId)?.id ?? '',
  )
  const [settleAmount, setSettleAmount] = useState('')
  const currentMemberId = data.household.currentMemberId

  return (
    <>
      <MoneyDashboard
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onSettle={() => setSettleModal(true)}
        onAddPurchase={() => setExpenseModal(true)}
        onAddBill={() => setBillModal(true)}
      />

      <Modal
        open={billModal}
        onClose={() => setBillModal(false)}
        title="Add utilities or rent"
        description="A payment check is tracked separately for every assigned roommate each month."
      >
        <form
          className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"
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
          <label className="col-span-full">Name
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
          <label className="col-span-full">Due day
            <input type="number" min="1" max="28" value={billDueDay} onChange={(event) => setBillDueDay(event.target.value)} required />
          </label>
          <fieldset className="col-span-full grid gap-1 border-0 py-1">
            <legend>Remind unpaid roommates</legend>
            <div className="mt-1 grid grid-cols-2 gap-x-5 max-[420px]:grid-cols-1">
              {[7, 3, 1, 0].map((day) => (
                <label className="flex min-h-11 items-center gap-2.5 border-b border-(--line) text-[.84rem] font-semibold" key={day}>
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
          <fieldset className="col-span-full grid gap-1 border-0 py-1">
            <legend>Who needs to pay?</legend>
            <div className="mt-1 grid">
              {data.members.map((member) => (
                <label className="flex min-h-11 items-center gap-2.5 border-b border-(--line) text-[.84rem] font-semibold" key={member.id}>
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
          <div className="col-span-full mt-1.5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setBillModal(false)}>Cancel</Button>
            <Button type="submit" disabled={busy === 'bill:new'}>Add monthly bill</Button>
          </div>
        </form>
      </Modal>

      <SharedPurchaseModal
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
      />

      <Modal
        open={settleModal}
        onClose={() => setSettleModal(false)}
        title="Record a direct payment"
        description="The recipient must confirm before balances change."
      >
        <form
          className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"
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
          <label className="col-span-full">Paid to
            <select value={settleTo} onChange={(event) => setSettleTo(event.target.value)}>
              {data.members.filter((member) => member.id !== currentMemberId).map((member) => (
                <option key={member.id} value={member.id}>{member.displayName}</option>
              ))}
            </select>
          </label>
          <label className="col-span-full">Amount (CAD)
            <input type="number" min="0.01" step="0.01" value={settleAmount} onChange={(event) => setSettleAmount(event.target.value)} required />
          </label>
          <div className="col-span-full mt-1.5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSettleModal(false)}>Cancel</Button>
            <Button type="submit">Send for confirmation</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
