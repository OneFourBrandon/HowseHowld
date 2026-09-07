import { type SubmitEvent, useState } from 'react'
import { Upload, UserRound, UsersRound } from 'lucide-react'
import { cn } from '../lib/cn'
import { cents, formatMoney, splitEvenly } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { ExpenseCategory } from '../types'
import { EXPENSE_CATEGORIES } from '../lib/expenseCategories'
import { Avatar, Button, Modal } from './ui'

const sanitizeCurrencyInput = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, '')
  const decimalIndex = cleaned.indexOf('.')
  if (decimalIndex < 0) return cleaned
  const whole = cleaned.slice(0, decimalIndex)
  const fraction = cleaned.slice(decimalIndex + 1).replaceAll('.', '').slice(0, 2)
  return `${whole}.${fraction}`
}

export function SharedPurchaseModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data, busy, addExpense } = useAppData()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('groceries')
  const [receipt, setReceipt] = useState<File>()
  const [receiptError, setReceiptError] = useState('')
  const [payers, setPayers] = useState(
    () => new Set([data.household.currentMemberId]),
  )
  const [beneficiaries, setBeneficiaries] = useState(
    () => new Set(data.members.map((member) => member.id)),
  )
  const [customPayers, setCustomPayers] = useState(false)
  const [customShares, setCustomShares] = useState(false)
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({})
  const [shareAmounts, setShareAmounts] = useState<Record<string, string>>({})
  const amountCents = Math.round(Number(amount || 0) * 100)
  const beneficiaryPreview = customShares
    ? [...beneficiaries].map((memberId) => ({
        memberId,
        amountCents: cents(Math.round(Number(shareAmounts[memberId] ?? 0) * 100)),
      }))
    : splitEvenly(amountCents, [...beneficiaries])

  const chooseReceipt = (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
      setReceipt(undefined)
      setReceiptError('Choose a PNG, JPG, or PDF file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setReceipt(undefined)
      setReceiptError('Receipt files must be 10 MB or smaller.')
      return
    }
    setReceipt(file)
    setReceiptError('')
  }

  const resetAndClose = () => {
    setTitle('')
    setAmount('')
    setCategory('groceries')
    setReceipt(undefined)
    setReceiptError('')
    setPayers(new Set([data.household.currentMemberId]))
    setBeneficiaries(new Set(data.members.map((member) => member.id)))
    setCustomPayers(false)
    setCustomShares(false)
    setPayerAmounts({})
    setShareAmounts({})
    onClose()
  }

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || amountCents <= 0 || !payers.size || !beneficiaries.size) return
    const payerSplit = customPayers
      ? [...payers].map((memberId) => ({
          memberId,
          amountCents: cents(Math.round(Number(payerAmounts[memberId] ?? 0) * 100)),
        }))
      : splitEvenly(amountCents, [...payers])
    const beneficiarySplit = customShares
      ? beneficiaryPreview
      : splitEvenly(amountCents, [...beneficiaries])
    if (
      payerSplit.reduce((sum, item) => sum + item.amountCents, 0) !== amountCents ||
      beneficiarySplit.reduce((sum, item) => sum + item.amountCents, 0) !== amountCents
    ) return

    await addExpense({
      title: title.trim(),
      category,
      amountCents: cents(amountCents),
      payers: payerSplit,
      beneficiaries: beneficiarySplit,
      receipt,
    })
    resetAndClose()
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Add a shared purchase"
      description="Amounts are stored in cents and posted as an immutable transaction."
      className="flex h-auto max-h-[calc(100dvh-32px)]! w-[min(840px,100%)] flex-col overflow-hidden! rounded-3xl p-0! shadow-[0_40px_120px_-20px_rgba(0,0,0,.8)] max-[640px]:max-h-[calc(100dvh-20px)]!"
      headerClassName="mb-0 shrink-0 px-9 pt-7 pb-5 max-[640px]:px-5 max-[640px]:pt-5 max-[640px]:pb-4 [&_h2]:text-[1.75rem] max-[640px]:[&_h2]:text-[1.4rem] [&_.muted]:mt-0.5 [&_.muted]:text-[.9rem] max-[640px]:[&_.muted]:text-[.78rem]"
      closeButtonClassName="size-10 border border-(--line-2) bg-transparent text-(--text) max-[640px]:size-8.5"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-9 pb-7 max-[640px]:gap-5 max-[640px]:px-5 max-[640px]:pb-6">
          <label className="grid gap-2 text-[1rem] font-[720] text-(--text)">
            What did you buy?
            <input
              className="mt-0! min-h-12 px-4 text-[.95rem]"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Toilet paper"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-7 max-[700px]:grid-cols-1 max-[700px]:gap-5">
            <div className="grid content-start gap-4">
              <label className="grid gap-2 text-[1rem] font-[720] text-(--text)">
                Amount
                <span className="grid min-h-12 grid-cols-[118px_minmax(0,1fr)] overflow-hidden rounded-xl border border-(--line-2) bg-(--inner)">
                  <select
                    className="mt-0! h-full rounded-none! border-0! border-r! border-r-(--line)! bg-(--inner) px-4 text-[.95rem] font-[650] shadow-none! focus:border-r! focus:border-r-(--line)! focus:shadow-none!"
                    aria-label="Currency"
                    value="CAD"
                    disabled
                  >
                    <option>CAD</option>
                  </select>
                  <span className="flex min-w-0 items-center bg-(--inner) px-4">
                    <span className="shrink-0 font-sans text-[1rem] text-(--text)" aria-hidden="true">$</span>
                    <input
                      className="mt-0! min-w-0 flex-1 rounded-none! border-0! bg-transparent px-1.5 text-[1rem] shadow-none! focus:border-0! focus:shadow-none!"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label="Purchase amount in Canadian dollars"
                      value={amount}
                      onChange={(event) => setAmount(sanitizeCurrencyInput(event.target.value))}
                      placeholder="0.00"
                      required
                    />
                  </span>
                </span>
              </label>
              <label className="grid gap-2 text-[1rem] font-[720] text-(--text)">
                Purchase type
                <select
                  className="mt-0! min-h-12 px-4 text-[.9rem] font-semibold"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
                >
                  {EXPENSE_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid content-center gap-2 max-h-full">
              <span className="text-[1rem] font-[720] text-(--text)">Receipt</span>
              <label
                className={cn(
                  'grid min-h-32 cursor-pointer place-content-center justify-items-center gap-1 rounded-2xl border border-dashed border-(--line-2) bg-(--inner) px-5 text-center text-(--text) transition-colors hover:border-[rgba(255,255,255,.24)] hover:bg-(--raise)',
                  receipt && 'border-solid bg-(--raise)',
                )}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  chooseReceipt(event.dataTransfer.files?.[0])
                }}
              >
                <input
                  className="hidden!"
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(event) => chooseReceipt(event.target.files?.[0])}
                />
                <span className="inline-flex max-w-full items-center gap-2 text-[.98rem] font-[720]">
                  <Upload className="shrink-0" size={23} />
                  <span className="truncate">{receipt ? receipt.name : 'Upload receipt'}</span>
                </span>
                <span className="text-[.78rem] font-medium text-(--text-3)">
                  PNG, JPG, or PDF up to 10 MB
                </span>
              </label>
              {receiptError && <span className="text-[.75rem] text-[#ff8080]">{receiptError}</span>}
            </div>
          </div>

          <div className="h-px bg-(--line)" />

          <fieldset className="grid gap-4">
            <legend className="mb-0 text-[1rem] font-[720] text-(--text)">Who paid?</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_150px] items-start gap-5 max-[640px]:grid-cols-1 max-[640px]:gap-3">
              <div className="grid gap-2">
                {data.members.map((member) => {
                  const selected = payers.has(member.id)
                  return (
                    <div
                      className={cn(
                        'grid min-h-14 grid-cols-[minmax(0,1fr)_128px] items-center gap-3 rounded-xl border border-(--line) bg-(--inner) px-3.5 transition-colors max-[520px]:grid-cols-1 max-[520px]:gap-2 max-[520px]:py-2.5',
                        selected && 'border-(--line-2) bg-(--raise)',
                      )}
                      key={member.id}
                    >
                      <label className="flex cursor-pointer items-center gap-3 text-[.95rem] font-[720] text-(--text)">
                        <input
                          className="size-5! shrink-0"
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => setPayers((current) => {
                            const next = new Set(current)
                            if (event.target.checked) next.add(member.id)
                            else next.delete(member.id)
                            return next
                          })}
                        />
                        <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="md" />
                        {member.displayName}
                      </label>
                      {customPayers && selected && (
                        <input
                          className="mt-0! min-h-10.5 text-right"
                          aria-label={member.displayName + ' paid amount'}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
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
              <select
                className="mt-0! min-h-12 px-3.5 text-[.9rem] font-bold"
                aria-label="Payer split method"
                value={customPayers ? 'custom' : 'equal'}
                onChange={(event) => {
                  const custom = event.target.value === 'custom'
                  setCustomPayers(custom)
                  if (!custom) setPayerAmounts({})
                }}
              >
                <option value="equal">Equal</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="mb-0 text-[1rem] font-[720] text-(--text)">Who used it?</legend>
            <div className="grid grid-cols-2 gap-1 rounded-full border border-(--line) bg-(--inner) p-1">
              <button
                className={cn(
                  'inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-0 bg-transparent px-4 text-[.85rem] font-bold text-(--text-3) transition-colors hover:text-(--text)',
                  !customShares && 'bg-(--raise)! text-(--text) shadow-[inset_0_1px_0_rgba(255,255,255,.06)]',
                )}
                type="button"
                onClick={() => {
                  setCustomShares(false)
                  setShareAmounts({})
                }}
              >
                <UsersRound size={20} /> Equal split
              </button>
              <button
                className={cn(
                  'inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-0 bg-transparent px-4 text-[.85rem] font-bold text-(--text-3) transition-colors hover:text-(--text)',
                  customShares && 'bg-(--raise)! text-(--text) shadow-[inset_0_1px_0_rgba(255,255,255,.06)]',
                )}
                type="button"
                onClick={() => setCustomShares(true)}
              >
                <UserRound size={20} /> Custom shares
              </button>
            </div>

            <div className="grid gap-2">
              {data.members.map((member) => {
                const selected = beneficiaries.has(member.id)
                return (
                  <div
                    className={cn(
                      'grid min-h-14 grid-cols-[minmax(0,1fr)_128px] items-center gap-3 rounded-xl border border-(--line) bg-(--inner) px-3.5 transition-colors max-[520px]:grid-cols-1 max-[520px]:gap-2 max-[520px]:py-2.5',
                      selected && 'border-(--line-2) bg-(--raise)',
                    )}
                    key={member.id}
                  >
                    <label className="flex cursor-pointer items-center gap-3 text-[.95rem] font-[720] text-(--text)">
                      <input
                        className="size-5! shrink-0"
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => setBeneficiaries((current) => {
                          const next = new Set(current)
                          if (event.target.checked) next.add(member.id)
                          else next.delete(member.id)
                          return next
                        })}
                      />
                      <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="md" />
                      {member.displayName}
                    </label>
                    {customShares && selected && (
                      <input
                        className="mt-0! min-h-10.5 text-right"
                        aria-label={member.displayName + ' share amount'}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={shareAmounts[member.id] ?? ''}
                        onChange={(event) => setShareAmounts((current) => ({
                          ...current,
                          [member.id]: event.target.value,
                        }))}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </fieldset>

          <section className="grid gap-3" aria-labelledby="split-summary-heading">
            <h3 className="text-[1rem] font-[720]" id="split-summary-heading">Split summary</h3>
            <div className="hh-inner px-4">
              {beneficiaryPreview.map((share) => {
                const member = data.members.find((item) => item.id === share.memberId)!
                return (
                  <div className="flex min-h-12 items-center gap-3 border-b border-(--line) last:border-b-0" key={share.memberId}>
                    <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                    <span className="text-[.88rem] text-(--text-3)">{member.displayName} pays</span>
                    <span className="ml-auto font-sans text-[.88rem] tabular-nums">CA{formatMoney(share.amountCents)}</span>
                  </div>
                )
              })}
              <div className="flex min-h-12 items-center border-t border-(--line)">
                <strong>Total</strong>
                <strong className="ml-auto font-sans tabular-nums">CA{formatMoney(amountCents)}</strong>
              </div>
            </div>
          </section>
        </div>

        <div className="flex min-h-18 shrink-0 items-center justify-end gap-3 border-t border-(--line) bg-(--inner) px-9 py-3.5 max-[640px]:min-h-17 max-[640px]:px-5">
          <Button type="button" variant="ghost" onClick={resetAndClose}>Cancel</Button>
          <Button className="min-w-40" type="submit" disabled={busy === 'expense:new'}>Post purchase</Button>
        </div>
      </form>
    </Modal>
  )
}
