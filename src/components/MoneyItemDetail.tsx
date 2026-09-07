import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Camera,
  Check,
  Droplets,
  Flame,
  Lightbulb,
  MoreHorizontal,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Users,
  Wifi,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { formatDateTime, formatMoney, timeUntil } from '../lib/utils'
import { getExpenseCategory } from '../lib/expenseCategories'
import {
  billBreakdown,
  expenseBreakdown,
  ordinal,
  shareOfTotal,
  type ShareBreakdown,
} from '../lib/shares'
import { useAppData } from '../state/AppDataContext'
import type { Expense, HouseholdBill, HouseholdBillPeriod, Settlement } from '../types'
import { ExpenseCategoryIcon } from './ExpenseCategoryIcon'
import { ShareBar, ShareDonut, ShareRow } from './ShareBreakdown'
import { Avatar, Badge, Button, Inner, Modal, Pill } from './ui'

export type MoneyItem =
  | { kind: 'expense'; expense: Expense }
  | { kind: 'settlement'; settlement: Settlement }
  | { kind: 'bill'; bill: HouseholdBill; period?: HouseholdBillPeriod }

function BillGlyph({ category }: { category: HouseholdBill['category'] }) {
  if (category === 'rent') return <Building2 size={20} />
  if (category === 'electricity') return <Lightbulb size={20} />
  if (category === 'water') return <Droplets size={20} />
  if (category === 'gas') return <Flame size={20} />
  if (category === 'internet') return <Wifi size={20} />
  if (category === 'insurance') return <ShieldCheck size={20} />
  return <MoreHorizontal size={20} />
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'green' | 'red' | 'amber'
}) {
  return (
    <Inner className="grid content-start gap-1 px-3.5 py-3">
      <span className="text-[.68rem] font-bold tracking-[.05em] text-(--text-3) uppercase">
        {label}
      </span>
      <span
        className={cn(
          'font-display text-[1.25rem] leading-none font-extrabold tracking-[-.02em] tabular-nums',
          tone === 'green' && 'text-(--green)',
          tone === 'red' && 'text-[#ff8080]',
          tone === 'amber' && 'text-(--amber)',
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[.7rem] leading-snug text-(--text-3)">{hint}</span>}
    </Inner>
  )
}

function SplitSection({
  breakdown,
  heading,
  note,
}: {
  breakdown: ShareBreakdown
  heading: string
  note: string
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[.95rem] font-bold">{heading}</h3>
        <span className="text-[.74rem] text-(--text-3)">{note}</span>
      </div>
      <ShareBar breakdown={breakdown} height={12} />
      <div className="divide-y divide-(--line)">
        {breakdown.shares.map((share) => (
          <div
            key={share.member.id}
            className={cn(
              'rounded-xl px-2',
              share.isCurrentMember && 'bg-[rgba(255,255,255,.04)]',
            )}
          >
            <ShareRow share={share} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function MoneyItemDetail({
  item,
  onClose,
}: {
  item: MoneyItem | null
  onClose: () => void
}) {
  const { data, busy, reverseExpense, confirmSettlement, setBillPaid, openReceipt } = useAppData()
  if (!item) return null

  const members = data.members
  const currentMemberId = data.household.currentMemberId

  if (item.kind === 'settlement') {
    const settlement = item.settlement
    const from = members.find((member) => member.id === settlement.fromMemberId)!
    const to = members.find((member) => member.id === settlement.toMemberId)!
    const awaitingMe = settlement.toMemberId === currentMemberId && settlement.status === 'pending'
    const iSent = settlement.fromMemberId === currentMemberId
    return (
      <Modal
        open
        onClose={onClose}
        title={`Payment to ${to.displayName}`}
        description="A direct payment between two roommates. It only moves balances once the recipient confirms it."
      >
        <div className="grid gap-5">
          <Inner className="flex items-center justify-center gap-5 px-4 py-6">
            <div className="grid justify-items-center gap-2">
              <Avatar
                initials={from.initials}
                color={from.color}
                imageUrl={from.avatarUrl}
                size="lg"
              />
              <span className="text-[.8rem] font-bold">{from.displayName}</span>
              <span className="text-[.7rem] text-(--text-3)">Paid</span>
            </div>
            <div className="grid justify-items-center gap-1">
              <span className="font-display text-[1.9rem] leading-none font-extrabold tracking-[-.03em] tabular-nums">
                {formatMoney(settlement.amountCents)}
              </span>
              <span className="text-(--text-3)">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <div className="grid justify-items-center gap-2">
              <Avatar initials={to.initials} color={to.color} imageUrl={to.avatarUrl} size="lg" />
              <span className="text-[.8rem] font-bold">{to.displayName}</span>
              <span className="text-[.7rem] text-(--text-3)">Received</span>
            </div>
          </Inner>

          <div className="grid grid-cols-3 gap-2.5 max-[560px]:grid-cols-1">
            <StatTile
              label="Your side"
              value={
                iSent
                  ? formatMoney(-settlement.amountCents, true)
                  : settlement.toMemberId === currentMemberId
                    ? formatMoney(settlement.amountCents, true)
                    : '—'
              }
              hint={
                iSent
                  ? 'You sent this payment'
                  : settlement.toMemberId === currentMemberId
                    ? 'Paid to you'
                    : 'Between two roommates'
              }
              tone={iSent ? 'red' : settlement.toMemberId === currentMemberId ? 'green' : undefined}
            />
            <StatTile
              label="Status"
              value={settlement.status}
              hint={
                settlement.status === 'pending'
                  ? 'Balances change on confirmation'
                  : settlement.status === 'confirmed'
                    ? 'Applied to balances'
                    : 'No balance change'
              }
              tone={settlement.status === 'confirmed' ? 'green' : settlement.status === 'rejected' ? 'red' : 'amber'}
            />
            <StatTile
              label="Recorded"
              value={timeUntil(settlement.createdAt)}
              hint={formatDateTime(settlement.createdAt)}
            />
          </div>

          {settlement.note && (
            <Inner className="px-4 py-3 text-[.85rem] text-(--text-2)">{settlement.note}</Inner>
          )}

          {awaitingMe && (
            <div className="flex justify-end gap-2 border-t border-(--line) pt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  void confirmSettlement(settlement.id, false)
                  onClose()
                }}
              >
                Reject
              </Button>
              <Button
                onClick={() => {
                  void confirmSettlement(settlement.id, true)
                  onClose()
                }}
              >
                <Check size={15} /> Confirm payment
              </Button>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  if (item.kind === 'bill') {
    const { bill, period } = item
    const breakdown = billBreakdown(bill, period, members, currentMemberId)
    const paidCount = breakdown.shares.filter((share) => share.settled).length
    const mine = breakdown.mine
    const perYear = breakdown.totalCents * 12
    return (
      <Modal
        open
        onClose={onClose}
        title={bill.name}
        description="Everyone assigned to this bill ticks off their own payment each month."
      >
        <div className="grid gap-5">
          <div className="flex items-center gap-5 max-[560px]:flex-col max-[560px]:items-start">
            <ShareDonut
              breakdown={breakdown}
              label={mine ? formatMoney(mine.owedCents) : formatMoney(breakdown.totalCents)}
              sublabel={mine ? 'your share' : 'total'}
            />
            <div className="grid min-w-0 flex-1 gap-2.5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-(--blue-soft) text-[#7d9cff]">
                  <BillGlyph category={bill.category} />
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <span className="font-display text-[1.6rem] leading-none font-extrabold tracking-[-.03em] tabular-nums">
                    {formatMoney(breakdown.totalCents)}
                  </span>
                  <span className="text-[.78rem] text-(--text-3)">
                    {bill.category} · every month on day {bill.dueDay}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill>
                  <Users size={13} /> Split {bill.memberIds.length} ways
                </Pill>
                <Pill tone={paidCount === breakdown.shares.length ? 'green' : 'amber'}>
                  {paidCount} of {breakdown.shares.length} paid
                </Pill>
                {period && (
                  <Pill>
                    <CalendarDays size={13} /> Due {formatDateTime(period.dueAt)}
                  </Pill>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 max-[560px]:grid-cols-1">
            <StatTile
              label="Your share"
              value={mine ? formatMoney(mine.owedCents) : '—'}
              hint={mine ? `${mine.percent.toFixed(0)}% of the bill` : 'You are not on this bill'}
              tone={mine?.settled ? 'green' : 'amber'}
            />
            <StatTile
              label="Your year"
              value={mine ? formatMoney(mine.owedCents * 12) : '—'}
              hint="If the amount holds for twelve months"
            />
            <StatTile
              label="House year"
              value={formatMoney(perYear)}
              hint="Across everyone on the bill"
            />
          </div>

          <SplitSection
            breakdown={breakdown}
            heading="Who owes what"
            note={`${formatMoney(breakdown.totalCents)} split ${bill.memberIds.length} ways`}
          />

          {period && (
            <div className="flex justify-end gap-2 border-t border-(--line) pt-4">
              <Button
                variant={mine?.settled ? 'secondary' : 'primary'}
                disabled={busy === `bill:paid:${period.id}`}
                onClick={() => {
                  void setBillPaid(period.id, !mine?.settled)
                  onClose()
                }}
              >
                {mine?.settled ? 'Mark as not paid' : <><Check size={15} /> Mark my share paid</>}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  const expense = item.expense
  const breakdown = expenseBreakdown(expense, members, currentMemberId)
  const category = getExpenseCategory(expense.category)
  const creator = members.find((member) => member.id === expense.createdBy)
  const mine = breakdown.mine
  const month = expense.purchasedAt.slice(0, 7)
  const monthExpenses = data.expenses.filter(
    (candidate) => !candidate.reversed && candidate.purchasedAt.slice(0, 7) === month,
  )
  const monthTotal = monthExpenses.reduce((sum, candidate) => sum + candidate.amountCents, 0)
  const rank =
    [...monthExpenses]
      .sort((left, right) => right.amountCents - left.amountCents)
      .findIndex((candidate) => candidate.id === expense.id) + 1
  const percentOfMonth = shareOfTotal(expense.amountCents, monthTotal)

  return (
    <Modal
      open
      onClose={onClose}
      title={expense.title}
      description={`${category.label} · ${category.description}`}
    >
      <div className="grid gap-5">
        <div className="flex items-center gap-5 max-[560px]:flex-col max-[560px]:items-start">
          <ShareDonut
            breakdown={breakdown}
            label={mine ? formatMoney(mine.owedCents) : formatMoney(breakdown.totalCents)}
            sublabel={mine ? 'your share' : 'total'}
          />
          <div className="grid min-w-0 flex-1 gap-2.5">
            <div className="flex items-center gap-3">
              <ExpenseCategoryIcon category={expense.category} size={44} />
              <div className="grid min-w-0 gap-0.5">
                <span className="font-display text-[1.6rem] leading-none font-extrabold tracking-[-.03em] tabular-nums">
                  {formatMoney(expense.amountCents)}
                </span>
                <span className="text-[.78rem] text-(--text-3)">
                  {formatDateTime(expense.purchasedAt)} · {timeUntil(expense.purchasedAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill>
                <Users size={13} />
                {breakdown.evenSplit
                  ? `Split ${breakdown.shares.filter((share) => share.owedCents > 0).length} ways`
                  : 'Custom shares'}
              </Pill>
              {creator && (
                <Pill>
                  <Avatar
                    initials={creator.initials}
                    color={creator.color}
                    imageUrl={creator.avatarUrl}
                    size="xs"
                  />
                  {creator.displayName} added it
                </Pill>
              )}
              {expense.receiptPath && (
                <Pill>
                  <Receipt size={13} /> Receipt attached
                </Pill>
              )}
              {expense.reversed && <Badge tone="red">Reversed</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 max-[560px]:grid-cols-1">
          <StatTile
            label="Your share"
            value={mine ? formatMoney(mine.owedCents) : '—'}
            hint={mine ? `${mine.percent.toFixed(0)}% of this purchase` : 'You have no share here'}
          />
          <StatTile
            label="Your net"
            value={mine ? formatMoney(mine.netCents, true) : '—'}
            hint={
              !mine
                ? 'Nothing owed either way'
                : mine.netCents > 0
                  ? 'The house owes you this much for it'
                  : mine.netCents < 0
                    ? 'You owe this much for it'
                    : 'You are square on this one'
            }
            tone={mine && mine.netCents > 0 ? 'green' : mine && mine.netCents < 0 ? 'red' : undefined}
          />
          <StatTile
            label="Month share"
            value={`${percentOfMonth.toFixed(percentOfMonth < 10 ? 1 : 0)}%`}
            hint={`${ordinal(Math.max(rank, 1))} largest of ${monthExpenses.length} this month`}
          />
        </div>

        {breakdown.payers.length > 0 && (
          <section className="grid gap-2.5">
            <h3 className="text-[.95rem] font-bold">Who paid</h3>
            <div className="grid gap-2">
              {breakdown.payers.map((share) => (
                <Inner
                  key={share.member.id}
                  className="flex items-center gap-3 px-3.5 py-2.5"
                >
                  <Avatar
                    initials={share.member.initials}
                    color={share.member.color}
                    imageUrl={share.member.avatarUrl}
                    size="md"
                  />
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate text-[.86rem] font-bold">
                      {share.member.displayName}
                      {share.isCurrentMember && (
                        <span className="font-medium text-(--text-3)"> (you)</span>
                      )}
                    </span>
                    <span className="text-[.72rem] text-(--text-3)">
                      Covered {((share.paidCents / (expense.amountCents || 1)) * 100).toFixed(0)}% up front
                    </span>
                  </span>
                  <span className="text-[.9rem] font-bold text-(--green) tabular-nums">
                    {formatMoney(share.paidCents)}
                  </span>
                </Inner>
              ))}
            </div>
          </section>
        )}

        <SplitSection
          breakdown={breakdown}
          heading="Who owes what"
          note={
            breakdown.evenSplit
              ? `${formatMoney(breakdown.totalCents)} split evenly`
              : `${formatMoney(breakdown.totalCents)} split by use`
          }
        />

        <div className="flex flex-wrap justify-end gap-2 border-t border-(--line) pt-4">
          {expense.receiptPath && (
            <Button variant="secondary" onClick={() => openReceipt(expense.receiptPath!)}>
              <Camera size={15} /> Open receipt
            </Button>
          )}
          {!expense.reversed && expense.createdBy === currentMemberId && (
            <Button
              variant="danger"
              onClick={() => {
                const reason = window.prompt('Why are you reversing this purchase?')
                if (reason?.trim()) {
                  void reverseExpense(expense.id, reason.trim())
                  onClose()
                }
              }}
            >
              <RotateCcw size={15} /> Reverse purchase
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
