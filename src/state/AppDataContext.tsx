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
import { demoSnapshot } from '../data/demo'
import { hasSupabaseConfig } from '../lib/supabase'
import * as api from '../lib/api'
import { blockerIds, cents, splitEvenly, toIso, uid } from '../lib/utils'
import type {
  AppSnapshot,
  CalendarEvent,
  Expense,
  Settlement,
  TaskDefinition,
  UUID,
} from '../types'

type NewTask = Omit<
  TaskDefinition,
  'id' | 'householdId' | 'active' | 'nextMemberId'
>
type NewExpense = Pick<Expense, 'title' | 'amountCents'> & {
  payerIds: UUID[]
  beneficiaryIds: UUID[]
  receipt?: File
}
type NewSettlement = Pick<
  Settlement,
  'toMemberId' | 'amountCents' | 'note'
>
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
  disputeInfraction: (id: UUID, reason: string) => Promise<void>
  voteInfraction: (id: UUID, vote: 'uphold' | 'excuse') => Promise<void>
  addExpense: (expense: NewExpense) => Promise<void>
  reverseExpense: (id: UUID, reason: string) => Promise<void>
  addSettlement: (settlement: NewSettlement) => Promise<void>
  confirmSettlement: (id: UUID, accept: boolean) => Promise<void>
  proposeFundPayment: (amountCents: number) => Promise<void>
  confirmFundPayment: (id: UUID, accept: boolean) => Promise<void>
  addEvent: (event: NewEvent) => Promise<void>
  reorderVehicles: (orderedIds: UUID[]) => Promise<void>
  addDeparture: (vehicleId: UUID, requiredAt: string, label: string) => void
  enableNotifications: () => Promise<void>
  sendTestNotification: () => Promise<void>
  clearToast: () => void
  createHousehold: (name: string) => Promise<void>
  acceptInvite: (token: string) => Promise<void>
  createInvite: (email: string) => Promise<string>
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<AppSnapshot>(() => structuredClone(demoSnapshot))
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(hasSupabaseConfig)
  const [needsHousehold, setNeedsHousehold] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const demoMode = !hasSupabaseConfig

  const refresh = useCallback(async () => {
    if (demoMode) return
    setInitializing(true)
    setBootstrapError(null)
    try {
      const snapshot = await api.loadSnapshot()
      if (!snapshot) {
        setNeedsHousehold(true)
      } else {
        setData(snapshot)
        setNeedsHousehold(false)
      }
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : 'Could not open the household.')
    } finally {
      setInitializing(false)
    }
  }, [demoMode])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = useCallback(
    async (key: string, action: () => Promise<void>, success: string) => {
      setBusy(key)
      try {
        await action()
        setToast(success)
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Something went wrong.')
        throw error
      } finally {
        setBusy(null)
      }
    },
    [],
  )

  const completeOccurrence = useCallback(
    async (id: UUID) =>
      run(
        `complete:${id}`,
        async () => {
          if (!demoMode) await api.completeOccurrence(id)
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
    [demoMode, run],
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
    [data.household.id, demoMode, run],
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
          const payers = splitEvenly(input.amountCents, input.payerIds)
          const beneficiaries = splitEvenly(input.amountCents, input.beneficiaryIds)
          const expense: Expense = {
            id,
            title: input.title,
            purchasedAt: toIso(new Date()),
            createdBy: data.household.currentMemberId,
            amountCents: cents(input.amountCents),
            payers,
            beneficiaries,
            reversed: false,
          }
          if (!demoMode) {
            const createdId = await api.createExpense({
              title: expense.title,
              purchasedAt: expense.purchasedAt,
              createdBy: expense.createdBy,
              amountCents: expense.amountCents,
              payers: expense.payers,
              beneficiaries: expense.beneficiaries,
              receiptPath: expense.receiptPath,
              householdId: data.household.id,
            })
            if (input.receipt) {
              expense.receiptPath = await api.uploadReceipt(
                data.household.id,
                createdId,
                input.receipt,
              )
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

  const reorderVehicles = useCallback(
    async (orderedIds: UUID[]) =>
      run(
        'driveway:reorder',
        async () => {
          if (!demoMode) {
            await api.reorderDriveway(
              data.household.id,
              data.drivewayVersion,
              orderedIds,
            )
          }
          setData((current) => ({
            ...current,
            drivewayVersion: current.drivewayVersion + 1,
            vehicles: orderedIds
              .map((id) => current.vehicles.find((vehicle) => vehicle.id === id))
              .filter((vehicle): vehicle is NonNullable<typeof vehicle> => Boolean(vehicle)),
            departures: current.departures.map((departure) => ({
              ...departure,
              blockerVehicleIds: blockerIds(orderedIds, departure.vehicleId),
            })),
          }))
        },
        'Driveway order updated for everyone.',
      ),
    [data.drivewayVersion, data.household.id, demoMode, run],
  )

  const addDeparture = useCallback(
    (vehicleId: UUID, requiredAt: string, label: string) => {
      setData((current) => {
        const vehicle = current.vehicles.find((item) => item.id === vehicleId)
        if (!vehicle) return current
        return {
          ...current,
          departures: [
            ...current.departures,
            {
              id: uid('departure'),
              vehicleId,
              ownerMemberId: vehicle.ownerMemberId,
              requiredAt: requiredAt as never,
              source: 'manual',
              sourceLabel: label,
              warningMinutes: 60,
              blockerVehicleIds: blockerIds(
                current.vehicles.map((item) => item.id),
                vehicleId,
              ),
            },
          ],
        }
      })
      setToast('Departure added. Blockers will get a one-hour warning.')
    },
    [],
  )

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
          const registration = await navigator.serviceWorker.ready
          const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
          let subscription = await registration.pushManager.getSubscription()
          if (!subscription && vapidKey) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: vapidKey,
            })
          }
          if (subscription && !demoMode) await api.subscribePush(subscription)
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
    async (name: string) =>
      run(
        'household:create',
        async () => {
          await api.createHousehold(name)
          await refresh()
        },
        'Your household is ready.',
      ),
    [refresh, run],
  )

  const acceptInvite = useCallback(
    async (token: string) =>
      run(
        'household:join',
        async () => {
          await api.acceptHouseholdInvite(token)
          await refresh()
        },
        'Welcome to the household.',
      ),
    [refresh, run],
  )

  const createInvite = useCallback(
    async (email: string) => {
      setBusy('invite:create')
      try {
        const token = await api.createHouseholdInvite(data.household.id, email)
        setToast('Invite created. Share the link with your roommate.')
        return `${window.location.origin}/?invite=${encodeURIComponent(token)}`
      } finally {
        setBusy(null)
      }
    },
    [data.household.id],
  )

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
      disputeInfraction,
      voteInfraction,
      addExpense,
      reverseExpense,
      addSettlement,
      confirmSettlement,
      proposeFundPayment,
      confirmFundPayment,
      addEvent,
      reorderVehicles,
      addDeparture,
      enableNotifications,
      sendTestNotification,
      clearToast: () => setToast(null),
      createHousehold,
      acceptInvite,
      createInvite,
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
      disputeInfraction,
      voteInfraction,
      addExpense,
      reverseExpense,
      addSettlement,
      confirmSettlement,
      proposeFundPayment,
      confirmFundPayment,
      addEvent,
      reorderVehicles,
      addDeparture,
      enableNotifications,
      sendTestNotification,
      createHousehold,
      acceptInvite,
      createInvite,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData must be used inside AppDataProvider.')
  return value
}
