import { useState } from 'react'
import { Avatar, Button, Modal } from '../components/ui'
import { MoneyDashboard } from '../components/MoneyDashboard'
import { SharedPurchaseModal } from '../components/SharedPurchaseModal'
import { cents } from '../lib/utils'
import { allocateBillShares } from '../lib/shares'
import { useAppData } from '../state/AppDataContext'
import type { HouseholdBillCategory, Member } from '../types'

const monthValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

function parseAmount(value: string) {
  if (!value.trim()) return undefined
  const amount = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) {
    throw new Error('Enter an amount between $0.01 and $21,474,836.47.')
  }
  return cents(amount)
}

function billShareWeights(memberIds: Set<string>, custom: boolean, amounts: Record<string, string>, baseline?: number) {
  if (!memberIds.size) throw new Error('Choose at least one roommate.')
  if (!custom) return [...memberIds].map(memberId => ({ memberId, shareWeight: 1 }))
  const shares = [...memberIds].map(memberId => {
    const amount = parseAmount(amounts[memberId] ?? '')
    if (amount == null) throw new Error('Enter a share amount for every selected roommate.')
    return { memberId, shareWeight: amount }
  })
  if (baseline != null && shares.reduce((sum, share) => sum + share.shareWeight, 0) !== baseline) {
    throw new Error('Roommate shares must add up to the baseline amount.')
  }
  return shares
}

function BillAssignmentFields({ members, selected, setSelected, custom, setCustom, amounts, setAmounts }: {
  members: Member[]
  selected: Set<string>
  setSelected: (value: Set<string>) => void
  custom: boolean
  setCustom: (value: boolean) => void
  amounts: Record<string, string>
  setAmounts: (value: Record<string, string>) => void
}) {
  return <fieldset className="col-span-full border-0 border-b border-(--line) px-3.5 py-2">
    <legend>Who needs to pay?</legend>
    <div className="mt-1.5 grid">
      {members.map(member => <label className="flex min-h-10.5 items-center gap-2 border-b border-(--line) text-[.84rem] font-semibold" key={member.id}>
        <input type="checkbox" checked={selected.has(member.id)} onChange={event => {
          const next = new Set(selected)
          if (event.target.checked) next.add(member.id)
          else next.delete(member.id)
          setSelected(next)
        }} />
        <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
        {member.displayName}
      </label>)}
    </div>
    <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={custom} onChange={event => setCustom(event.target.checked)} /> Different amounts per roommate</label>
    {custom && <div className="mt-2 grid gap-2">
      {[...selected].map(memberId => {
        const member = members.find(item => item.id === memberId)
        return <label key={memberId}>{member?.displayName ?? 'Roommate'} share (CAD)
          <input type="number" min="0.01" step="0.01" value={amounts[memberId] ?? ''} onChange={event => setAmounts({ ...amounts, [memberId]: event.target.value })} />
        </label>
      })}
      <p className="text-sm text-(--muted)">If you set a baseline, shares must add up to it. A different monthly total keeps these proportions.</p>
    </div>}
  </fieldset>
}

export function MoneyPage() {
  const {
    data,
    busy,
    addSettlement,
    addBill,
    editBill,
  } = useAppData()
  const [editingBill, setEditingBill] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState<HouseholdBillCategory>('other')
  const [editName, setEditName] = useState('')
  const [editDueDay, setEditDueDay] = useState('1')
  const [editReminders, setEditReminders] = useState(() => new Set([7, 3, 1, 0]))
  const [editMembers, setEditMembers] = useState<Set<string>>(new Set())
  const [editCustomShares, setEditCustomShares] = useState(false)
  const [editShareAmounts, setEditShareAmounts] = useState<Record<string, string>>({})
  const [editBaseline, setEditBaseline] = useState('')
  const [editMonthly, setEditMonthly] = useState('')
  const [editRequiresMonthlyPrice, setEditRequiresMonthlyPrice] = useState(false)
  const [editError, setEditError] = useState('')
  const [expenseModal, setExpenseModal] = useState(false)
  const [settleModal, setSettleModal] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(monthValue)
  const [billName, setBillName] = useState('')
  const [billCategory, setBillCategory] = useState<HouseholdBillCategory>('rent')
  const [billAmount, setBillAmount] = useState('')
  const [billRequiresMonthlyPrice, setBillRequiresMonthlyPrice] = useState(false)
  const [billCustomShares, setBillCustomShares] = useState(false)
  const [billShareAmounts, setBillShareAmounts] = useState<Record<string, string>>({})
  const [billError, setBillError] = useState('')
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
    <div className="page-stack">
      <MoneyDashboard
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onSettle={() => setSettleModal(true)}
        onAddPurchase={() => setExpenseModal(true)}
        onAddBill={() => setBillModal(true)}
        onEditBill={(id) => {
          const bill = data.bills.find(item => item.id === id)!
          const period = data.billPeriods.find(item => item.billId === id && item.periodMonth.slice(0, 7) === selectedMonth)
          setEditingBill(id)
          setEditName(bill.name)
          setEditCategory(bill.category)
          setEditDueDay(String(bill.dueDay))
          setEditReminders(new Set(bill.reminderDaysBefore))
          setEditMembers(new Set(bill.memberIds))
          const unequal = new Set(bill.memberShares?.map(share => share.shareWeight) ?? [1]).size > 1
          setEditCustomShares(unequal)
          setEditShareAmounts(Object.fromEntries((bill.amountCents == null
            ? bill.memberShares?.map(share => ({ memberId: share.memberId, amountCents: share.shareWeight })) ?? []
            : allocateBillShares(bill.amountCents, bill)
          ).map(share => [share.memberId, (share.amountCents / 100).toFixed(2)])))
          setEditBaseline(bill.amountCents == null ? '' : (bill.amountCents / 100).toFixed(2))
          setEditRequiresMonthlyPrice(Boolean(bill.requiresMonthlyPrice))
          const amount = period?.priceConfirmed ? period.amountCents : undefined
          setEditMonthly(amount == null ? '' : (amount / 100).toFixed(2))
          setEditError('')
        }}
      />

      <Modal open={editingBill !== null} onClose={() => setEditingBill(null)} title={`Edit ${data.bills.find(bill => bill.id === editingBill)?.name ?? 'bill'}`} description="Set the price for the selected month without changing past months.">
        <form className="form-grid grid gap-4" onSubmit={async event => {
          event.preventDefault()
          if (!editingBill) return
          try {
            const amountCents = parseAmount(editBaseline)
            const memberShares = billShareWeights(editMembers, editCustomShares, editShareAmounts, amountCents)
            await editBill(editingBill, {
              name: editName.trim(), category: editCategory, amountCents,
              dueDay: Number(editDueDay), reminderDaysBefore: [...editReminders].sort((a, b) => b - a),
              requiresMonthlyPrice: editRequiresMonthlyPrice, memberIds: [...editMembers], memberShares,
              periodMonth: `${selectedMonth}-01`, monthlyAmountCents: parseAmount(editMonthly),
            })
            setEditingBill(null)
          } catch (error) { setEditError(error instanceof Error ? error.message : 'Could not save bill.') }
        }}>
          <label>Name<input value={editName} onChange={event => setEditName(event.target.value)} required /></label>
          <label>Type<select value={editCategory} onChange={event => setEditCategory(event.target.value as HouseholdBillCategory)}>
            {(['rent', 'electricity', 'water', 'gas', 'internet', 'insurance', 'other'] as const).map(category => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}
          </select></label>
          <label>Baseline amount (CAD)<input type="number" min="0.01" max="21474836.47" step="0.01" placeholder="Optional" value={editBaseline} onChange={event => setEditBaseline(event.target.value)} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={editRequiresMonthlyPrice} onChange={event => setEditRequiresMonthlyPrice(event.target.checked)} /> Require a new price every month</label>
          <label>Amount for {selectedMonth} (CAD)<input type="number" min="0.01" max="21474836.47" step="0.01" placeholder={editRequiresMonthlyPrice ? 'Pending until entered' : 'Use baseline'} value={editMonthly} onChange={event => setEditMonthly(event.target.value)} /></label>
          <label>Due day<input type="number" min="1" max="28" value={editDueDay} onChange={event => setEditDueDay(event.target.value)} required /></label>
          <fieldset className="col-span-full border-0 border-b border-(--line) px-3.5 py-2"><legend>Remind unpaid roommates</legend>
            {[7, 3, 1, 0].map(day => <label className="flex min-h-10 items-center gap-2" key={day}><input type="checkbox" checked={editReminders.has(day)} onChange={event => {
              const next = new Set(editReminders)
              if (event.target.checked) next.add(day)
              else next.delete(day)
              setEditReminders(next)
            }} />{day === 0 ? 'Due day' : `${day} day${day === 1 ? '' : 's'} before`}</label>)}
          </fieldset>
          <BillAssignmentFields members={data.members} selected={editMembers} setSelected={setEditMembers} custom={editCustomShares} setCustom={setEditCustomShares} amounts={editShareAmounts} setAmounts={setEditShareAmounts} />
          <p className="text-sm text-(--muted)">{editRequiresMonthlyPrice ? 'Until you enter this month’s price, everyone sees Pending and cannot mark it paid.' : 'Leave this blank to use the baseline. A new baseline applies to unconfirmed current and future months only.'}</p>
          {editError && <p role="alert">{editError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingBill(null)}>Cancel</Button><Button type="submit" disabled={busy === `bill:edit:${editingBill}`}>Save bill</Button></div>
        </form>
      </Modal>

      <Modal
        open={billModal}
        onClose={() => setBillModal(false)}
        title="Add utilities or rent"
        description="A payment check is tracked separately for every assigned roommate each month."
      >
        <form
          className="form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"
          onSubmit={async (event) => {
            event.preventDefault()
            try {
              const amountCents = parseAmount(billAmount)
              const memberShares = billShareWeights(billMembers, billCustomShares, billShareAmounts, amountCents)
              await addBill({
                name: billName.trim(), category: billCategory, amountCents,
                requiresMonthlyPrice: billRequiresMonthlyPrice, dueDay: Number(billDueDay),
                reminderDaysBefore: [...billReminders].sort((a, b) => b - a),
                memberIds: [...billMembers], memberShares,
              })
              setBillName('')
              setBillAmount('')
              setBillRequiresMonthlyPrice(false)
              setBillCustomShares(false)
              setBillShareAmounts({})
              setBillError('')
              setBillModal(false)
            } catch (error) { setBillError(error instanceof Error ? error.message : 'Could not add bill.') }
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
          <label className="col-span-full flex items-center gap-2"><input type="checkbox" checked={billRequiresMonthlyPrice} onChange={event => setBillRequiresMonthlyPrice(event.target.checked)} /> Require a new price every month before roommates can see or pay it</label>
          <label className="col-span-full">Due day
            <input type="number" min="1" max="28" value={billDueDay} onChange={(event) => setBillDueDay(event.target.value)} required />
          </label>
          <fieldset className="col-span-full border-0 border-b border-(--line) px-3.5 py-2">
            <legend>Remind unpaid roommates</legend>
            <div className="mt-1.5 grid grid-cols-2 max-[420px]:grid-cols-1">
              {[7, 3, 1, 0].map((day) => (
                <label className="flex min-h-10.5 items-center gap-2 border-b border-(--line) text-[.84rem] font-semibold" key={day}>
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
          <BillAssignmentFields members={data.members} selected={billMembers} setSelected={setBillMembers} custom={billCustomShares} setCustom={setBillCustomShares} amounts={billShareAmounts} setAmounts={setBillShareAmounts} />
          {billError && <p className="col-span-full text-(--coral)" role="alert">{billError}</p>}
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
          className="form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"
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
    </div>
  )
}
