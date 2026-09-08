// oxlint-disable react/only-export-components -- provider and its typed hook share one private context
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { renewPushSubscription } from '../lib/push'
import { validatePenaltyTiers } from '../lib/penalties'
import { demoSnapshot } from '../data/demo'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import * as api from '../lib/api'
import { assignVehicle, blockingVehicles, slotsFor, validSlot } from '../lib/driveway'
import { blockerIds, cents, initials, toIso, uid } from '../lib/utils'
import type {
  AppSnapshot,
  DrivewaySlot,
  CalendarEvent,
  CreateHouseholdInput,
  Expense,
  HouseholdBill,
  HouseholdFeature,
  SaveSharedCourseInput,
  Settlement,
  TaskDefinition,
  UUID,
} from '../types'

type NewTask = Omit<
  TaskDefinition,
  'id' | 'householdId' | 'active' | 'nextMemberId'
>
type NewExpense = Pick<Expense, 'title' | 'category' | 'amountCents'> & {
  payers: Expense['payers']
  beneficiaries: Expense['beneficiaries']
  receipt?: File
}
type NewSettlement = Pick<
  Settlement,
  'toMemberId' | 'amountCents' | 'note'
>
type NewBill = Omit<HouseholdBill, 'id' | 'householdId' | 'active'>
type NewEvent = Omit<CalendarEvent, 'id' | 'creatorId'>

interface AppDataContextValue {
  data: AppSnapshot
  demoMode: boolean
  initializing: boolean
  needsHousehold: boolean
  bootstrapError: string | null
  busy: string | null
  toast: string | null
  completeOccurrence: (id: UUID) => Promise<void>
  addTask: (task: NewTask) => Promise<void>
  updateTask: (
    id: UUID,
    input: Partial<Omit<TaskDefinition, 'id' | 'householdId'>>,
  ) => Promise<void>
  assignManualTask: (taskId: UUID, memberId: UUID, scheduledDate: string) => Promise<void>
  disputeInfraction: (id: UUID, reason: string) => Promise<void>
  voteInfraction: (id: UUID, vote: 'uphold' | 'excuse') => Promise<void>
  addExpense: (expense: NewExpense) => Promise<void>
  updateExpenseAmount: (id: UUID, amount: number, expected: number) => Promise<void>
  updateExpenseShares: (id: UUID, beneficiaries: Expense['beneficiaries'], expected: number) => Promise<void>
  saveDrivewaySlots: (slots: DrivewaySlot[]) => Promise<void>
  parkVehicle: (vehicleId: string, slotId: string | null) => Promise<void>
  reverseExpense: (id: UUID, reason: string) => Promise<void>
  addSettlement: (settlement: NewSettlement) => Promise<void>
  confirmSettlement: (id: UUID, accept: boolean) => Promise<void>
  proposeFundPayment: (amountCents: number) => Promise<void>
  confirmFundPayment: (id: UUID, accept: boolean) => Promise<void>
  addBill: (bill: NewBill) => Promise<void>
  setBillPaid: (periodId: UUID, paid: boolean) => Promise<void>
  addEvent: (event: NewEvent) => Promise<void>
  updateScheduleItemKind: (id: UUID, kind: 'class' | 'exam' | 'other') => Promise<void>
  updateCourse: (id: UUID, name: string, color: string) => Promise<void>
  saveSharedCourse: (input: Omit<SaveSharedCourseInput, 'householdId'>) => Promise<void>
  reorderVehicles: (orderedIds: UUID[]) => Promise<void>
  addDeparture: (
    vehicleId: UUID,
    requiredAt: string,
    label: string,
    warningMinutes: number,
    recurrence?: TaskDefinition['recurrence'],
    scheduleItemId?: UUID,
  ) => Promise<void>
  saveVehicle: (input: { id?: UUID; label: string; color: string; plate?: string }) => Promise<void>
  removeVehicle: (id: UUID) => Promise<void>
  openReceipt: (path: string) => Promise<void>
  enableNotifications: () => Promise<void>
  disableNotifications: () => Promise<void>
  sendTestNotification: () => Promise<void>
  clearToast: () => void
  createHousehold: (input: CreateHouseholdInput) => Promise<string | undefined>
  rotateShareCode: () => Promise<string>
  issueMemberRecoveryCode: (memberId: UUID) => Promise<string>
  removeHouseholdMember: (memberId: UUID) => Promise<void>
  updateProfile: (displayName: string, avatar?: File | null) => Promise<void>
  updateHouseholdFeatures: (features: HouseholdFeature[]) => Promise<void>
  updateHouseholdTaskReminders: (times: string[]) => Promise<void>
  updatePenaltyTiers: (tiers: number[]) => Promise<void>
  refresh: () => Promise<void>
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<AppSnapshot>(() => ({ ...structuredClone(demoSnapshot), drivewaySlots: slotsFor(demoSnapshot) }))
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(hasSupabaseConfig)
  const [needsHousehold, setNeedsHousehold] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const demoMode = !hasSupabaseConfig

  const refresh = useCallback(async (showLoading = true) => {
    if (demoMode) return
    if (showLoading) setInitializing(true)
    setBootstrapError(null)
    try {
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(
          () => reject(new Error(
            'The household data did not respond. Check that local Supabase is running, then try again.',
          )),
          8_000,
        )
      })
      const snapshot = await Promise.race([api.loadSnapshot(), timeout])
      if (!snapshot) {
        setNeedsHousehold(true)
      } else {
        setData(snapshot)
        setNeedsHousehold(false)
      }
    } catch (error) {
      setBootstrapError(
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error && 'message' in error
            ? String(error.message)
            : 'Could not open the household.',
      )
    } finally {
      if (showLoading) setInitializing(false)
    }
  }, [demoMode])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (demoMode || !supabase || !data.household.id) return
    const client = supabase
    let timer: number | undefined
    let refreshing = false
    let refreshAgain = false
    const runRefresh = async () => {
      if (refreshing) {
        refreshAgain = true
        return
      }
      refreshing = true
      try {
        do {
          refreshAgain = false
          await refresh(false)
        } while (refreshAgain)
      } finally {
        refreshing = false
      }
    }
    const queueRefresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void runRefresh(), 750)
    }
    const tables = [
      'task_definitions', 'task_occurrences', 'infractions', 'infraction_votes',
      'expenses', 'expense_payers', 'expense_shares', 'settlements', 'fund_payments',
      'household_bills', 'household_bill_members', 'household_bill_periods',
      'household_bill_payments',
      'calendar_events', 'event_audiences', 'courses', 'schedule_items',
      'shared_courses', 'shared_course_enrollments', 'shared_course_meetings',
      'shared_course_assessments',
      'vehicles', 'driveway_state', 'driveway_positions', 'driveway_slots', 'departure_occurrences',
      'push_subscriptions',
    ]
    let channel = client.channel(`household:${data.household.id}`)
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `household_id=eq.${data.household.id}`,
        },
        queueRefresh,
      )
    }
    channel = channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles' },
      queueRefresh,
    )
    channel.subscribe()
    return () => {
      window.clearTimeout(timer)
      void client.removeChannel(channel)
    }
  }, [data.household.id, demoMode, refresh])

  const run = useCallback(
    async (key: string, action: () => Promise<void>, success: string) => {
      setBusy(key)
      try {
        if (!demoMode && !navigator.onLine) {
          throw new Error('You are offline. Reconnect before changing household data.')
        }
        await action()
        setToast(success)
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Something went wrong.')
        throw error
      } finally {
        setBusy(null)
      }
    },
    [demoMode],
  )

  const completeOccurrence = useCallback(
    async (id: UUID) =>
      run(
        `complete:${id}`,
        async () => {
          if (!demoMode) {
            await api.completeOccurrence(id)
            await refresh(false)
            return
          }
          setData((current) => ({
            ...current,
            occurrences: current.occurrences.map((occurrence) =>
              occurrence.id === id
                ? {
                    ...occurrence,
                    status: 'completed',
                    completedAt: toIso(new Date()),
                    reminderLabel: 'Completed just now',
                  }
                : occurrence,
            ),
            auditEvents: [
              {
                id: uid('audit'),
                actorMemberId: current.household.currentMemberId,
                action: 'task.completed',
                entityType: 'task_occurrence',
                summary: `Completed ${
                  current.occurrences.find((item) => item.id === id)?.taskTitle ??
                  'task'
                }`,
                createdAt: toIso(new Date()),
              },
              ...current.auditEvents,
            ],
          }))
        },
        'Task checked off. Nice work.',
      ),
    [demoMode, refresh, run],
  )

  const addTask = useCallback(
    async (input: NewTask) =>
      run(
        'task:new',
        async () => {
          if (!demoMode) {
            await api.createTask({
              ...input,
              householdId: data.household.id,
              active: true,
            })
            await refresh()
            return
          }
          setData((current) => {
            const id = uid('task')
            return {
              ...current,
              tasks: [
                ...current.tasks,
                {
                  ...input,
                  id,
                  householdId: current.household.id,
                  active: true,
                  nextMemberId: input.rotationMemberIds[0],
                },
              ],
            }
          })
        },
        'Chore added to the house rotation.',
      ),
    [data.household.id, demoMode, refresh, run],
  )

  const updateTask = useCallback(
    async (
      id: UUID,
      input: Partial<Omit<TaskDefinition, 'id' | 'householdId'>>,
    ) =>
      run(
        `task:update:${id}`,
        async () => {
          if (!demoMode) await api.updateTask(id, input)
          setData((current) => ({
            ...current,
            tasks: current.tasks.map((task) =>
              task.id === id ? { ...task, ...input } : task,
            ),
          }))
        },
        'Chore settings updated.',
      ),
    [demoMode, run],
  )

  const assignManualTask = useCallback(
    async (taskId: UUID, memberId: UUID, scheduledDate: string) =>
      run(
        `task:assign:${taskId}`,
        async () => {
          if (!demoMode) {
            await api.assignManualTask(taskId, memberId, scheduledDate)
            await refresh()
          }
        },
        'Manual chore assigned.',
      ),
    [demoMode, refresh, run],
  )

  const disputeInfraction = useCallback(
    async (id: UUID, reason: string) =>
      run(
        `dispute:${id}`,
        async () => {
          if (!demoMode) await api.disputeInfraction(id, reason)
          setData((current) => ({
            ...current,
            infractions: current.infractions.map((item) =>
              item.id === id
                ? { ...item, status: 'disputed', disputeReason: reason }
                : item,
            ),
          }))
        },
        'Dispute opened for a peer vote.',
      ),
    [demoMode, run],
  )

  const voteInfraction = useCallback(
    async (id: UUID, vote: 'uphold' | 'excuse') =>
      run(
        `vote:${id}`,
        async () => {
          if (!demoMode) await api.castInfractionVote(id, vote)
          setData((current) => ({
            ...current,
            infractions: current.infractions.map((item) => {
              if (item.id !== id) return item
              const voterId = current.household.currentMemberId
              const upholdVotes = item.upholdVotes.filter((memberId) => memberId !== voterId)
              const excuseVotes = item.excuseVotes.filter((memberId) => memberId !== voterId)
              if (vote === 'uphold') upholdVotes.push(voterId)
              else excuseVotes.push(voterId)
              return {
                ...item,
                upholdVotes,
                excuseVotes,
                status:
                  upholdVotes.length >= 2
                    ? 'upheld'
                    : excuseVotes.length >= 2
                      ? 'excused'
                      : 'disputed',
              }
            }),
          }))
        },
        `Vote to ${vote} recorded.`,
      ),
    [demoMode, run],
  )

  const addExpense = useCallback(
    async (input: NewExpense) =>
      run(
        'expense:new',
        async () => {
          const id = uid('expense')
          const expense: Expense = {
            id,
            title: input.title,
            category: input.category,
            purchasedAt: toIso(new Date()),
            createdBy: data.household.currentMemberId,
            amountCents: cents(input.amountCents),
            payers: input.payers,
            beneficiaries: input.beneficiaries,
            reversed: false,
          }
          if (!demoMode) {
            const createdId = await api.createExpense({
              title: expense.title,
              category: expense.category,
              purchasedAt: expense.purchasedAt,
              createdBy: expense.createdBy,
              amountCents: expense.amountCents,
              payers: expense.payers,
              beneficiaries: expense.beneficiaries,
              receiptPath: expense.receiptPath,
              householdId: data.household.id,
            })
            expense.id = createdId
            if (input.receipt) {
              expense.receiptPath = await api.uploadReceipt(
                data.household.id,
                createdId,
                input.receipt,
              )
              await api.attachExpenseReceipt(createdId, expense.receiptPath)
            }
          } else if (input.receipt) {
            expense.receiptPath = input.receipt.name
          }
          setData((current) => ({
            ...current,
            expenses: [expense, ...current.expenses],
          }))
        },
        'Shared purchase added.',
      ),
    [data.household.currentMemberId, data.household.id, demoMode, run],
  )

  const updateExpenseAmount = useCallback(async (id: UUID, amount: number, expected: number) => run(
    'expense:edit:' + id, async () => {
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647) throw new Error('Enter a valid purchase total.')
      if (!demoMode) { await api.invokeRpc('update_expense_details', { p_expense_id: id, p_amount: amount, p_expected: expected, p_beneficiaries: null }); await refresh(false); return }
        const expense = data.expenses.find(e => e.id === id)
        if (!expense || expense.reversed) throw new Error('This purchase is no longer editable.')
        if (expense.createdBy !== data.household.currentMemberId) throw new Error('Only the creator can edit this purchase')
        if (expense.amountCents !== expected) throw new Error('This purchase changed. Reload it before editing.')
        const scale = (shares: Expense['payers']) => {
          let previous = 0, cumulative = 0
          return [...shares].sort((a, b) => a.memberId.localeCompare(b.memberId)).map(share => {
            cumulative += share.amountCents
            const next = Math.round(cumulative * amount / expense.amountCents)
            const result = { ...share, amountCents: cents(next - previous) }
            previous = next
            return result
          })
        }
        const updated = { ...expense, amountCents: cents(amount), payers: scale(expense.payers), beneficiaries: scale(expense.beneficiaries) }
        if ([...updated.payers, ...updated.beneficiaries].some(s => s.amountCents < 1)) throw new Error('The total is too small for this split.')
      setData(current => {
        return { ...current, expenses: current.expenses.map(e => e.id === id ? updated : e), balances: current.balances.map(b => {
          const paid = (updated.payers.find(s => s.memberId === b.memberId)?.amountCents ?? 0) - (expense.payers.find(s => s.memberId === b.memberId)?.amountCents ?? 0)
          const used = (updated.beneficiaries.find(s => s.memberId === b.memberId)?.amountCents ?? 0) - (expense.beneficiaries.find(s => s.memberId === b.memberId)?.amountCents ?? 0)
          return { ...b, contributionCents: cents(b.contributionCents + paid), resourceUseCents: cents(b.resourceUseCents + used), netCents: cents(b.netCents + paid - used) }
        }) }
      })
    }, 'Purchase total and shares updated.',
  ), [data.expenses, data.household.currentMemberId, demoMode, refresh, run])

  const updateExpenseShares = useCallback(async (id: UUID, beneficiaries: Expense['beneficiaries'], expected: number) => run(
    'expense:shares:' + id, async () => {
      if (!beneficiaries.length || beneficiaries.some(share => !Number.isSafeInteger(share.amountCents) || share.amountCents < 1)) throw new Error('Choose at least one person and enter valid shares.')
      if (new Set(beneficiaries.map(share => share.memberId)).size !== beneficiaries.length) throw new Error('Each person can only have one share.')
      if (beneficiaries.reduce((sum, share) => sum + share.amountCents, 0) !== expected) throw new Error('The shares must equal the purchase total.')
      if (!demoMode) {
        await api.invokeRpc('update_expense_details', {
          p_expense_id: id,
          p_amount: expected,
          p_expected: expected,
          p_beneficiaries: beneficiaries.map(share => ({ member_id: share.memberId, amount: share.amountCents })),
        })
        await refresh(false)
        return
      }
      const expense = data.expenses.find(item => item.id === id)
      if (!expense || expense.reversed) throw new Error('This purchase is no longer editable.')
      if (expense.createdBy !== data.household.currentMemberId) throw new Error('Only the creator can edit this purchase')
      if (expense.amountCents !== expected) throw new Error('This purchase changed. Reload it before editing.')
      if (beneficiaries.some(share => !data.members.some(member => member.id === share.memberId))) throw new Error('A selected person is no longer in this household.')
      const updated = { ...expense, beneficiaries: beneficiaries.map(share => ({ ...share })) }
      setData(current => ({
        ...current,
        expenses: current.expenses.map(item => item.id === id ? updated : item),
        balances: current.balances.map(balance => {
          const previousUse = expense.beneficiaries.find(share => share.memberId === balance.memberId)?.amountCents ?? 0
          const nextUse = updated.beneficiaries.find(share => share.memberId === balance.memberId)?.amountCents ?? 0
          const difference = nextUse - previousUse
          return { ...balance, resourceUseCents: cents(balance.resourceUseCents + difference), netCents: cents(balance.netCents - difference) }
        }),
      }))
    }, 'Purchase shares updated.',
  ), [data.expenses, data.household.currentMemberId, data.members, demoMode, refresh, run])

  const saveDrivewaySlots = useCallback(async (slots: DrivewaySlot[]) => run(
    'driveway:slots', async () => {
      if (data.members.find(member => member.id === data.household.currentMemberId)?.role !== 'owner') throw new Error('Only the admin can edit parking slots.')
      if (new Set(slots.map(slot => slot.id)).size !== slots.length || slots.some(slot => !validSlot(slot, slots))) throw new Error('Slots must not overlap.')
      if (!demoMode) {
        await api.invokeRpc('save_driveway_slots', { p_household_id: data.household.id, p_slots: slots.map(({ id, x, y, width, height, kind }) => ({ id, x, y, width, height, kind })) })
        await refresh(false)
        return
      }
      const existing = slotsFor(data)
      if (existing.some(slot => slot.vehicleId && !slots.some(next => next.id === slot.id))) throw new Error('Unpark cars before deleting their slots.')
      setData(current => {
        const currentSlots = slotsFor(current)
        const next = slots.map(slot => ({ ...slot, vehicleId: currentSlots.find(old => old.id === slot.id)?.vehicleId }))
        return { ...current, drivewaySlots: next, departures: current.departures.map(departure => ({ ...departure, blockerVehicleIds: blockingVehicles(next, departure.vehicleId) })) }
      })
    }, 'Driveway layout saved.',
  ), [data, demoMode, refresh, run])

  const parkVehicle = useCallback(async (vehicleId: string, slotId: string | null) => run(
    'driveway:park', async () => {
      if (!demoMode) {
        await api.invokeRpc('park_vehicle', { p_household_id: data.household.id, p_vehicle_id: vehicleId, p_slot_id: slotId })
        await refresh(false)
        return
      }
      const next = assignVehicle(slotsFor(data), vehicleId, slotId)
      setData(current => ({ ...current, drivewaySlots: next, departures: current.departures.map(departure => ({ ...departure, blockerVehicleIds: blockingVehicles(next, departure.vehicleId) })) }))
    }, slotId ? 'Vehicle parked.' : 'Vehicle unparked.',
  ), [data, demoMode, refresh, run])

  const reverseExpense = useCallback(
    async (id: UUID, reason: string) =>
      run(
        `expense:reverse:${id}`,
        async () => {
          if (!demoMode) await api.reverseExpense(id, reason)
          setData((current) => ({
            ...current,
            expenses: current.expenses.map((expense) =>
              expense.id === id ? { ...expense, reversed: true } : expense,
            ),
            auditEvents: [
              {
                id: uid('audit'),
                actorMemberId: current.household.currentMemberId,
                action: 'expense.reversed',
                entityType: 'expense',
                summary: `Reversed an expense: ${reason}`,
                createdAt: toIso(new Date()),
              },
              ...current.auditEvents,
            ],
          }))
        },
        'Expense reversed with an audit entry.',
      ),
    [demoMode, run],
  )

  const addSettlement = useCallback(
    async (input: NewSettlement) =>
      run(
        'settlement:new',
        async () => {
          if (!demoMode) {
            await api.proposeSettlement({
              ...input,
              fromMemberId: data.household.currentMemberId,
            })
          }
          setData((current) => ({
            ...current,
            settlements: [
              {
                id: uid('settlement'),
                fromMemberId: current.household.currentMemberId,
                ...input,
                status: 'pending',
                createdAt: toIso(new Date()),
              },
              ...current.settlements,
            ],
          }))
        },
        'Payment sent for confirmation.',
      ),
    [data.household.currentMemberId, demoMode, run],
  )

  const confirmSettlement = useCallback(
    async (id: UUID, accept: boolean) =>
      run(
        `settlement:${id}`,
        async () => {
          if (!demoMode) await api.confirmSettlement(id, accept)
          setData((current) => ({
            ...current,
            settlements: current.settlements.map((settlement) =>
              settlement.id === id
                ? { ...settlement, status: accept ? 'confirmed' : 'rejected' }
                : settlement,
            ),
          }))
        },
        accept ? 'Payment confirmed.' : 'Payment rejected.',
      ),
    [demoMode, run],
  )

  const proposeFundPayment = useCallback(
    async (amountCents: number) =>
      run(
        'fund:propose',
        async () => {
          if (!demoMode) await api.proposeFundPayment(amountCents)
          setData((current) => ({
            ...current,
            fundPayments: [
              {
                id: uid('fund-payment'),
                memberId: current.household.currentMemberId,
                amountCents: cents(amountCents),
                status: 'pending',
                createdAt: toIso(new Date()),
              },
              ...current.fundPayments,
            ],
          }))
        },
        'Fund payment sent for roommate confirmation.',
      ),
    [demoMode, run],
  )

  const confirmFundPayment = useCallback(
    async (id: UUID, accept: boolean) =>
      run(
        `fund:${id}`,
        async () => {
          if (!demoMode) await api.confirmFundPayment(id, accept)
          setData((current) => ({
            ...current,
            fundPayments: current.fundPayments.map((payment) =>
              payment.id === id
                ? {
                    ...payment,
                    status: accept ? 'confirmed' : 'rejected',
                    confirmedBy: current.household.currentMemberId,
                  }
                : payment,
            ),
          }))
        },
        accept ? 'Fund payment confirmed.' : 'Fund payment rejected.',
      ),
    [demoMode, run],
  )

  const addBill = useCallback(
    async (input: NewBill) =>
      run(
        'bill:new',
        async () => {
          if (!demoMode) {
            await api.upsertHouseholdBill({
              ...input,
              householdId: data.household.id,
              active: true,
            })
            await refresh()
            return
          }
          setData((current) => {
            const id = uid('bill')
            const month = new Date()
            const periodMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`
            const due = new Date(month.getFullYear(), month.getMonth(), input.dueDay, 9)
            return {
              ...current,
              bills: [...current.bills, {
                ...input,
                id,
                householdId: current.household.id,
                active: true,
              }],
              billPeriods: [...current.billPeriods, {
                id: uid('bill-period'),
                billId: id,
                periodMonth,
                dueAt: toIso(due),
                amountCents: input.amountCents,
                paidMemberIds: [],
              }],
            }
          })
        },
        'Monthly bill added and reminders scheduled.',
      ),
    [data.household.id, demoMode, refresh, run],
  )

  const setBillPaid = useCallback(
    async (periodId: UUID, paid: boolean) =>
      run(
        `bill:paid:${periodId}`,
        async () => {
          if (!demoMode) await api.setHouseholdBillPaid(periodId, paid)
          setData((current) => ({
            ...current,
            billPeriods: current.billPeriods.map((period) => {
              if (period.id !== periodId) return period
              const memberId = current.household.currentMemberId
              return {
                ...period,
                paidMemberIds: paid
                  ? [...new Set([...period.paidMemberIds, memberId])]
                  : period.paidMemberIds.filter((id) => id !== memberId),
              }
            }),
          }))
        },
        paid ? 'Marked paid for this month.' : 'Marked unpaid for this month.',
      ),
    [demoMode, run],
  )

  const addEvent = useCallback(
    async (input: NewEvent) =>
      run(
        'event:new',
        async () => {
          if (!demoMode) {
            await api.upsertCalendarEvent({
              ...input,
              householdId: data.household.id,
            })
          }
          setData((current) => ({
            ...current,
            events: [
              ...current.events,
              {
                ...input,
                id: uid('event'),
                creatorId: current.household.currentMemberId,
              },
            ].sort(
              (a, b) =>
                new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
            ),
          }))
        },
        'Event added to the house calendar.',
      ),
    [data.household.id, demoMode, run],
  )

  const updateScheduleItemKind = useCallback(
    async (id: UUID, kind: 'class' | 'exam' | 'other') =>
      run(
        `schedule:kind:${id}`,
        async () => {
          if (!demoMode) await api.updateScheduleItemKind(id, kind)
          setData((current) => ({
            ...current,
            events: current.events.map((event) =>
              event.scheduleItemId === id ? { ...event, kind } : event,
            ),
          }))
        },
        'Schedule item updated.',
      ),
    [demoMode, run],
  )

  const updateCourse = useCallback(
    async (id: UUID, name: string, color: string) =>
      run(
        `course:update:${id}`,
        async () => {
          if (!demoMode) await api.updateCourse(id, name, color)
          setData((current) => ({
            ...current,
            courses: current.courses.map((course) =>
              course.id === id ? { ...course, name, color } : course,
            ),
          }))
        },
        'Course details updated.',
      ),
    [demoMode, run],
  )

  const saveSharedCourse = useCallback(
    async (input: Omit<SaveSharedCourseInput, 'householdId'>) =>
      run(
        `shared-course:save:${input.courseId ?? 'new'}`,
        async () => {
          if (!demoMode) {
            await api.saveSharedCourse({ ...input, householdId: data.household.id })
            const snapshot = await api.loadSnapshot()
            if (snapshot) setData(snapshot)
            return
          }
          setData((current) => {
            const currentMemberId = current.household.currentMemberId
            const existing = input.courseId
              ? current.sharedCourses.find((course) => course.id === input.courseId)
              : current.sharedCourses.find(
                  (course) => course.code.replace(/\s/g, '').toLowerCase()
                    === input.code.replace(/\s/g, '').toLowerCase(),
                )
            const courseId = existing?.id ?? uid('shared-course')
            const nextCourse = {
              id: courseId,
              code: existing?.code ?? input.code.toUpperCase(),
              name: existing?.name ?? input.name,
              color: existing?.color ?? input.color,
              createdByMemberId: existing?.createdByMemberId ?? currentMemberId,
              enrollmentMemberIds: Array.from(new Set([
                ...(existing?.enrollmentMemberIds ?? []),
                currentMemberId,
              ])),
              meetings: [
                ...(existing?.meetings ?? []).filter((meeting) => meeting.memberId !== currentMemberId),
                ...input.meetings.map((meeting) => ({
                  ...meeting,
                  id: uid('shared-meeting'),
                  memberId: currentMemberId,
                })),
              ],
              assessments: [
                ...(existing?.assessments ?? []).filter((assessment) => assessment.memberId !== currentMemberId),
                ...input.assessments.map((assessment) => ({
                  ...assessment,
                  id: uid('shared-assessment'),
                  memberId: currentMemberId,
                })),
              ],
            }
            return {
              ...current,
              sharedCourses: existing
                ? current.sharedCourses.map((course) => course.id === courseId ? nextCourse : course)
                : [...current.sharedCourses, nextCourse],
            }
          })
        },
        'Class schedule saved.',
      ),
    [data.household.id, demoMode, run],
  )

  const reorderVehicles = useCallback(
    async (orderedIds: UUID[]) =>
      run(
        'driveway:reorder',
        async () => {
          setData((current) => ({
            ...current,
            vehicles: orderedIds
              .map((id) => current.vehicles.find((vehicle) => vehicle.id === id))
              .filter((vehicle): vehicle is NonNullable<typeof vehicle> => Boolean(vehicle)),
            departures: current.departures.map((departure) => ({
              ...departure,
              blockerVehicleIds: blockerIds(orderedIds, departure.vehicleId, current.household.drivewayWidth ?? 1),
            })),
          }))
          if (!demoMode) {
            try {
              await api.reorderDriveway(data.household.id, orderedIds)
            } catch (error) {
              await refresh()
              throw error
            }
          }
        },
        'Driveway order updated for everyone.',
      ),
    [data.household.id, demoMode, refresh, run],
  )

  const addDeparture = useCallback(
    async (
      vehicleId: UUID,
      requiredAt: string,
      label: string,
      warningMinutes: number,
      recurrence?: TaskDefinition['recurrence'],
      scheduleItemId?: UUID,
    ) =>
      run(
        'departure:new',
        async () => {
          const vehicle = data.vehicles.find((item) => item.id === vehicleId)
          if (!vehicle) throw new Error('Choose a vehicle.')
          if (!demoMode) {
            await api.createDepartureRule({
              householdId: data.household.id,
              vehicleId,
              requiredAt,
              label,
              source: scheduleItemId ? 'course' : 'manual',
              scheduleItemId,
              recurrence,
              warningMinutes: [warningMinutes],
              travelBufferMinutes: 0,
            })
            await refresh()
            return
          }
          setData((current) => ({
            ...current,
            departures: [
              ...current.departures,
              {
                id: uid('departure'),
                vehicleId,
                ownerMemberId: vehicle.ownerMemberId,
                requiredAt: requiredAt as never,
                source: scheduleItemId ? 'course' : 'manual',
                sourceLabel: label,
                warningMinutes,
                blockerVehicleIds: blockingVehicles(slotsFor(current), vehicleId),
              },
            ],
          }))
        },
        'Departure scheduled and blocker alerts queued.',
      ),
    [data.household.id, data.vehicles, demoMode, refresh, run],
  )

  const saveVehicle = useCallback(
    async (input: { id?: UUID; label: string; color: string; plate?: string }) =>
      run(
        input.id ? `vehicle:update:${input.id}` : 'vehicle:new',
        async () => {
          if (!demoMode) {
            await api.upsertVehicle({ ...input, householdId: data.household.id })
            await refresh()
            return
          }
          setData((current) => ({
            ...current,
            vehicles: input.id
              ? current.vehicles.map((vehicle) =>
                  vehicle.id === input.id ? { ...vehicle, ...input } : vehicle,
                )
              : [...current.vehicles, {
                  ...input,
                  id: uid('vehicle'),
                  ownerMemberId: current.household.currentMemberId,
                }],
          }))
        },
        input.id ? 'Vehicle updated.' : 'Vehicle added to the driveway.',
      ),
    [data.household.id, demoMode, refresh, run],
  )

  const removeVehicle = useCallback(
    async (id: UUID) =>
      run(
        `vehicle:remove:${id}`,
        async () => {
          if (!demoMode) {
            await api.archiveVehicle(id)
            await refresh()
            return
          }
          setData((current) => ({
            ...current,
            vehicles: current.vehicles.filter((vehicle) => vehicle.id !== id),
            drivewaySlots: slotsFor(current).map(slot => slot.vehicleId === id ? { ...slot, vehicleId: undefined } : slot),
            departures: current.departures.filter((departure) => departure.vehicleId !== id),
          }))
        },
        'Vehicle removed.',
      ),
    [demoMode, refresh, run],
  )

  const openReceipt = useCallback(async (path: string) => {
    const url = demoMode ? path : await api.getReceiptUrl(path)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [demoMode])

  const enableNotifications = useCallback(
    async () =>
      run(
        'notifications:enable',
        async () => {
          if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            throw new Error('This browser does not support Web Push.')
          }
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') throw new Error('Notification permission was not granted.')
          const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
          if (!vapidKey) {
            throw new Error('VITE_VAPID_PUBLIC_KEY is not configured for this app.')
          }
          const subscription = await renewPushSubscription(vapidKey)
          if (!demoMode) await api.subscribePush(subscription)
          setData((current) => ({
            ...current,
            notificationHealth: {
              ...current.notificationHealth,
              permission,
              subscribed: Boolean(subscription) || demoMode,
            },
          }))
        },
        'Notifications enabled on this device.',
      ),
    [demoMode, run],
  )

  const disableNotifications = useCallback(
    async () =>
      run(
        'notifications:disable',
        async () => {
          if (!('serviceWorker' in navigator)) return
          const registration = await navigator.serviceWorker.ready
          const subscription = await registration.pushManager.getSubscription()
          if (subscription && !demoMode) await api.unsubscribePush(subscription)
          if (subscription) await subscription.unsubscribe()
          setData((current) => ({
            ...current,
            notificationHealth: { ...current.notificationHealth, subscribed: false },
          }))
        },
        'Notifications disabled on this device.',
      ),
    [demoMode, run],
  )

  const sendTestNotification = useCallback(
    async () =>
      run(
        'notifications:test',
        async () => {
          if (!demoMode) {
            await api.sendTestPush()
          } else if ('Notification' in window && Notification.permission === 'granted') {
            const registration = await navigator.serviceWorker.ready
            await registration.showNotification('HowseHowld is ready', {
              body: 'This device can receive household reminders.',
              icon: '/favicon.svg',
              badge: '/favicon.svg',
            })
          } else {
            throw new Error('Enable notifications before sending a test.')
          }
          setData((current) => ({
            ...current,
            notificationHealth: {
              ...current.notificationHealth,
              lastSuccessAt: toIso(new Date()),
            },
          }))
        },
        'Test notification sent.',
      ),
    [demoMode, run],
  )

  const createHousehold = useCallback(
    async (input: CreateHouseholdInput) => {
      setBusy('household:create')
      try {
        const result = await api.createHousehold(input)
        sessionStorage.setItem('howsehowld:last-share-code', result.shareCode)
        await refresh()
        setToast('Your household is ready.')
        return result.shareCode
      } finally {
        setBusy(null)
      }
    },
    [refresh],
  )

  const rotateShareCode = useCallback(
    async () => {
      setBusy('share-code:rotate')
      try {
        const code = demoMode
          ? 'DEMO-HOME-2026'
          : await api.rotateHouseholdShareCode(data.household.id)
        sessionStorage.setItem('howsehowld:last-share-code', code)
        setData((current) => ({
          ...current,
          household: { ...current.household, shareCodeLast4: code.slice(-4) },
        }))
        setToast('A new share code is ready. The old code no longer works.')
        return code
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : typeof cause === 'object' && cause && 'message' in cause ? String(cause.message) : 'Could not generate a recovery code.'
        setToast(message)
        throw new Error(message)
      } finally {
        setBusy(null)
      }
    },
    [data.household.id, demoMode],
  )

  const issueMemberRecoveryCode = useCallback(
    async (memberId: UUID) => {
      setBusy(`member:recovery:${memberId}`)
      try {
        const code = demoMode
          ? `REC-DEMO-${Math.random().toString(36).slice(2, 14).toUpperCase()}`
          : await api.issueMemberRecoveryCode(memberId)
        setToast('One-time recovery code generated. Keep it private.')
        return code
      } finally {
        setBusy(null)
      }
    },
    [demoMode],
  )

  const removeHouseholdMember = useCallback(
    async (memberId: UUID) =>
      run(
        `member:remove:${memberId}`,
        async () => {
          if (demoMode) {
            setData((current) => ({
              ...current,
              members: current.members.filter((member) => member.id !== memberId),
            }))
          } else {
            await api.removeHouseholdMember(memberId)
            await refresh()
          }
        },
        'Roommate removed from the household.',
      ),
    [demoMode, refresh, run],
  )

  const updateProfile = useCallback(
    async (displayName: string, avatar?: File | null) =>
      run(
        'profile:update',
        async () => {
          const normalizedName = displayName.trim()
          if (demoMode) {
            const avatarUrl = avatar instanceof File
              ? URL.createObjectURL(avatar)
              : avatar === null
                ? undefined
                : null
            setData((current) => ({
              ...current,
              members: current.members.map((member) =>
                member.id === current.household.currentMemberId
                  ? {
                      ...member,
                      displayName: normalizedName,
                      initials: initials(normalizedName),
                      avatarUrl: avatarUrl === null ? member.avatarUrl : avatarUrl,
                    }
                  : member,
              ),
            }))
          } else {
            await api.updateCurrentProfile({ displayName: normalizedName, avatar })
            await refresh()
          }
        },
        'Your profile was updated.',
      ),
    [demoMode, refresh, run],
  )

  const updateHouseholdFeatures = useCallback(
    async (features: HouseholdFeature[]) =>
      run(
        'household:features',
        async () => {
          const savedFeatures = demoMode
            ? features
            : await api.updateHouseholdFeatures(data.household.id, features)
          setData((current) => ({
            ...current,
            household: {
              ...current.household,
              enabledFeatures: savedFeatures,
            },
          }))
        },
        'Household features updated.',
      ),
    [data.household.id, demoMode, run],
  )

  const updateHouseholdTaskReminders = useCallback(
    async (times: string[]) =>
      run(
        'household:task-reminders',
        async () => {
          if (!demoMode) {
            await api.updateHouseholdTaskReminders(data.household.id, times)
          }
          setData((current) => ({
            ...current,
            household: { ...current.household, defaultTaskReminderTimes: times },
          }))
        },
        'Household reminder defaults saved.',
      ),
    [data.household.id, demoMode, run],
  )

  const updatePenaltyTiers = useCallback(async (tiers: number[]) => run(
    'household:penalties', async () => {
      if (data.members.find(member => member.id === data.household.currentMemberId)?.role !== 'owner') throw new Error('Only the admin can change penalty tiers.')
      validatePenaltyTiers(tiers)
      if (!demoMode) await api.invokeRpc('update_penalty_tiers', { p_household_id: data.household.id, p_tiers: tiers })
      setData(current => ({ ...current, household: { ...current.household, penaltyTiers: [...tiers] } }))
    }, 'Penalty tiers saved.',
  ), [data.members, data.household.currentMemberId, data.household.id, demoMode, run])

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      demoMode,
      initializing,
      needsHousehold,
      bootstrapError,
      busy,
      toast,
      completeOccurrence,
      addTask,
      updateTask,
      assignManualTask,
      disputeInfraction,
      voteInfraction,
      addExpense,
      reverseExpense,
      updateExpenseAmount,
      updateExpenseShares,
      saveDrivewaySlots,
      parkVehicle,
      addSettlement,
      confirmSettlement,
      proposeFundPayment,
      confirmFundPayment,
      addBill,
      setBillPaid,
      addEvent,
      updateScheduleItemKind,
      updateCourse,
      saveSharedCourse,
      reorderVehicles,
      addDeparture,
      saveVehicle,
      removeVehicle,
      openReceipt,
      enableNotifications,
      disableNotifications,
      sendTestNotification,
      clearToast: () => setToast(null),
      createHousehold,
      rotateShareCode,
      issueMemberRecoveryCode,
      removeHouseholdMember,
      updateProfile,
      updateHouseholdFeatures,
      updateHouseholdTaskReminders,
      updatePenaltyTiers,
      refresh,
    }),
    [
      data,
      demoMode,
      initializing,
      needsHousehold,
      bootstrapError,
      busy,
      toast,
      completeOccurrence,
      addTask,
      updateTask,
      assignManualTask,
      disputeInfraction,
      voteInfraction,
      addExpense,
      reverseExpense,
      updateExpenseAmount,
      updateExpenseShares,
      saveDrivewaySlots,
      parkVehicle,
      addSettlement,
      confirmSettlement,
      proposeFundPayment,
      confirmFundPayment,
      addBill,
      setBillPaid,
      addEvent,
      updateScheduleItemKind,
      updateCourse,
      saveSharedCourse,
      reorderVehicles,
      addDeparture,
      saveVehicle,
      removeVehicle,
      openReceipt,
      enableNotifications,
      disableNotifications,
      sendTestNotification,
      createHousehold,
      rotateShareCode,
      issueMemberRecoveryCode,
      removeHouseholdMember,
      updateProfile,
      updateHouseholdFeatures,
      updateHouseholdTaskReminders,
      updatePenaltyTiers,
      refresh,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData must be used inside AppDataProvider.')
  return value
}
