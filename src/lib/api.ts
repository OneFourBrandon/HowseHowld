import { supabase } from './supabase'
import { cents, initials } from './utils'
import type {
  AppSnapshot,
  CalendarEvent,
  Expense,
  Settlement,
  TaskDefinition,
  UUID,
} from '../types'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function sendEmailOtp(email: string) {
  const { error } = await requireClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) throw error
}

export async function verifyEmailOtp(email: string, token: string) {
  const { error } = await requireClient().auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut()
  if (error) throw error
}

export async function invokeRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await requireClient().rpc(name, args)
  if (error) throw error
  return data as T
}

export const createHousehold = (name: string) =>
  invokeRpc<UUID>('create_household', { p_name: name })
export const acceptHouseholdInvite = (token: string) =>
  invokeRpc<UUID>('accept_household_invite', { p_token: token })
export const createHouseholdInvite = (householdId: UUID, email: string) =>
  invokeRpc<string>('create_household_invite', {
    p_household_id: householdId,
    p_email: email,
  })

export async function createTask(
  input: Omit<TaskDefinition, 'id' | 'householdId'> & { householdId?: UUID },
) {
  return invokeRpc<UUID>('create_task', { p_input: input })
}

export const completeOccurrence = (occurrenceId: UUID) =>
  invokeRpc('complete_task_occurrence', { p_occurrence_id: occurrenceId })
export const disputeInfraction = (infractionId: UUID, reason: string) =>
  invokeRpc('dispute_infraction', {
    p_infraction_id: infractionId,
    p_reason: reason,
  })
export const castInfractionVote = (
  infractionId: UUID,
  vote: 'uphold' | 'excuse',
) =>
  invokeRpc('cast_infraction_vote', {
    p_infraction_id: infractionId,
    p_vote: vote,
  })

export async function createExpense(
  input: Omit<Expense, 'id' | 'reversed'> & { householdId?: UUID },
) {
  return invokeRpc<UUID>('create_expense', { p_input: input })
}

export const reverseExpense = (expenseId: UUID, reason: string) =>
  invokeRpc('reverse_expense', {
    p_expense_id: expenseId,
    p_reason: reason,
  })

export async function proposeSettlement(
  input: Omit<Settlement, 'id' | 'createdAt' | 'status'>,
) {
  return invokeRpc<UUID>('propose_settlement', {
    p_to_member_id: input.toMemberId,
    p_amount_cents: input.amountCents,
    p_note: input.note ?? null,
  })
}

export const confirmSettlement = (settlementId: UUID, accept: boolean) =>
  invokeRpc('confirm_settlement', {
    p_settlement_id: settlementId,
    p_accept: accept,
  })

export const proposeFundPayment = (amountCents: number) =>
  invokeRpc<UUID>('propose_fund_payment', { p_amount_cents: amountCents })

export const confirmFundPayment = (fundPaymentId: UUID, accept: boolean) =>
  invokeRpc('confirm_fund_payment', {
    p_fund_payment_id: fundPaymentId,
    p_accept: accept,
  })

export async function upsertCalendarEvent(
  input: Omit<CalendarEvent, 'id' | 'creatorId'> & { householdId?: UUID },
) {
  return invokeRpc<UUID>('upsert_calendar_event', { p_input: input })
}

export const reorderDriveway = (
  householdId: UUID,
  expectedVersion: number,
  orderedVehicleIds: UUID[],
) =>
  invokeRpc<number>('reorder_driveway', {
    p_household_id: householdId,
    p_expected_version: expectedVersion,
    p_ordered_vehicle_ids: orderedVehicleIds,
  })

export async function uploadReceipt(
  householdId: UUID,
  expenseId: UUID,
  file: File,
) {
  const path = `${householdId}/${expenseId}/${crypto.randomUUID()}-${file.name}`
  const { data, error } = await requireClient()
    .storage.from('receipts')
    .upload(path, file, { upsert: false })
  if (error) throw error
  return data.path
}

export async function importIcs(file?: File, url?: string) {
  const form = new FormData()
  if (file) form.append('file', file)
  if (url) form.append('url', url)
  const { data, error } = await requireClient().functions.invoke('import-ics', {
    body: form,
  })
  if (error) throw error
  return data
}

export async function subscribePush(subscription: PushSubscription) {
  const { error } = await requireClient().functions.invoke('push-subscribe', {
    body: subscription.toJSON(),
  })
  if (error) throw error
}

export async function unsubscribePush(subscription: PushSubscription) {
  const { error } = await requireClient().functions.invoke('push-subscribe', {
    method: 'DELETE',
    body: { endpoint: subscription.endpoint },
  })
  if (error) throw error
}

export async function sendTestPush() {
  const { data, error } = await requireClient().functions.invoke('push-dispatch', {
    body: { test: true },
  })
  if (error) throw error
  return data
}

export async function loadSnapshot(): Promise<AppSnapshot | null> {
  const client = requireClient()
  const { data: userData } = await client.auth.getUser()
  if (!userData.user) return null

  const { data: memberRows, error: memberError } = await client
    .from('household_members')
    .select('id, household_id, role, active, profile_id, profiles(display_name,email,avatar_color)')
    .eq('active', true)
  if (memberError) throw memberError
  if (!memberRows?.length) return null

  const householdId = memberRows[0].household_id
  const results = await Promise.all([
    client.from('households').select('*').eq('id', householdId).single(),
    client.from('task_definitions').select('*').eq('household_id', householdId),
    client.from('task_rotation_members').select('*').eq('household_id', householdId),
    client.from('task_occurrences').select('*').eq('household_id', householdId).order('due_at'),
    client.from('infractions').select('*, infraction_votes(voter_member_id,choice)').eq('household_id', householdId),
    client.from('expenses').select('*, expense_payers(*), expense_shares(*)').eq('household_id', householdId).order('purchased_at', { ascending: false }),
    client.from('settlements').select('*').eq('household_id', householdId),
    client.from('fund_payments').select('*').eq('household_id', householdId).order('created_at', { ascending: false }),
    client.from('member_balances').select('*').eq('household_id', householdId),
    client.from('calendar_events').select('*, event_audiences(member_id)').eq('household_id', householdId).order('start_at'),
    client.from('courses').select('*').eq('household_id', householdId),
    client.from('vehicles').select('*').eq('household_id', householdId).eq('active', true),
    client.from('driveway_state').select('*, driveway_positions(*)').eq('household_id', householdId).single(),
    client.from('departure_occurrences').select('*').eq('household_id', householdId).gte('required_at', new Date().toISOString()),
    client.from('audit_events').select('*').eq('household_id', householdId).order('created_at', { ascending: false }).limit(100),
    client.from('push_subscriptions').select('id,last_success_at').eq('household_id', householdId).eq('active', true),
  ])
  const firstError = results.map((result) => result.error).find(Boolean)
  if (firstError) throw firstError

  const [
    householdResult, taskResult, rotationResult, occurrenceResult, infractionResult,
    expenseResult, settlementResult, fundPaymentResult, balanceResult, eventResult,
    courseResult, vehicleResult, drivewayResult, departureResult, auditResult, pushResult,
  ] = results
  const rowData = <T,>(result: { data: T | null }) => result.data
  const household = rowData(householdResult)!
  const tasks = rowData(taskResult) ?? []
  const rotations = rowData(rotationResult) ?? []
  const occurrences = rowData(occurrenceResult) ?? []
  const vehicles = rowData(vehicleResult) ?? []
  const currentMember =
    memberRows.find((row) => row.profile_id === userData.user.id) ?? memberRows[0]
  const profileOf = (row: (typeof memberRows)[number]) => {
    const profile = row.profiles
    return (Array.isArray(profile) ? profile[0] : profile) as {
      display_name: string
      email: string
      avatar_color: string
    }
  }
  const taskMap = new Map(tasks.map((task) => [task.id, task]))
  const occurrenceMap = new Map(occurrences.map((item) => [item.id, item]))
  const positionRows = drivewayResult.data?.driveway_positions ?? []
  const orderedIds = [...positionRows]
    .sort((a, b) => a.position - b.position)
    .map((row) => row.vehicle_id)
  const orderedVehicles = [
    ...orderedIds.map((id) => vehicles.find((vehicle) => vehicle.id === id)).filter(Boolean),
    ...vehicles.filter((vehicle) => !orderedIds.includes(vehicle.id)),
  ] as typeof vehicles

  return {
    household: {
      id: household.id,
      name: household.name,
      timezone: household.timezone,
      currency: 'CAD',
      currentMemberId: currentMember.id,
    },
    members: memberRows.map((row) => {
      const profile = profileOf(row)
      return {
        id: row.id,
        profileId: row.profile_id,
        displayName: profile.display_name,
        email: profile.email,
        initials: initials(profile.display_name),
        color: profile.avatar_color,
        role: row.role,
        active: row.active,
      }
    }),
    tasks: tasks.map((task) => {
      const taskRotations = rotations
        .filter((rotation) => rotation.task_id === task.id)
        .sort((a, b) => a.position - b.position)
      return {
        id: task.id,
        householdId: task.household_id,
        title: task.title,
        description: task.description ?? undefined,
        area: task.area,
        assignmentMode: task.assignment_mode,
        recurrenceLabel: recurrenceLabel(task.recurrence),
        dueTime: String(task.due_time).slice(0, 5),
        penaltyEnabled: task.penalty_enabled,
        active: task.active,
        rotationMemberIds: taskRotations.map((rotation) => rotation.member_id),
        nextMemberId: taskRotations[0]?.member_id,
      }
    }),
    occurrences: occurrences.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      taskTitle: taskMap.get(row.task_id)?.title ?? 'House chore',
      area: taskMap.get(row.task_id)?.area ?? 'House',
      assigneeId: row.assignee_member_id,
      dueAt: row.due_at,
      status: row.status,
      completedAt: row.completed_at ?? undefined,
      reminderLabel: row.status === 'completed' ? 'Completed' : 'Scheduled reminders active',
    })),
    infractions: (infractionResult.data ?? []).map((row) => {
      const votes = row.infraction_votes ?? []
      const occurrence = occurrenceMap.get(row.occurrence_id)
      return {
        id: row.id,
        occurrenceId: row.occurrence_id,
        memberId: row.member_id,
        taskTitle: taskMap.get(occurrence?.task_id)?.title ?? 'Missed chore',
        amountCents: row.amount_cents,
        status: row.status,
        disputeDeadline: row.dispute_deadline,
        disputeReason: row.dispute_reason ?? undefined,
        upholdVotes: votes
          .filter((vote: { choice: string }) => vote.choice === 'uphold')
          .map((vote: { voter_member_id: string }) => vote.voter_member_id),
        excuseVotes: votes
          .filter((vote: { choice: string }) => vote.choice === 'excuse')
          .map((vote: { voter_member_id: string }) => vote.voter_member_id),
      }
    }),
    expenses: (expenseResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      purchasedAt: row.purchased_at,
      createdBy: row.created_by,
      amountCents: row.amount_cents,
      payers: (row.expense_payers ?? []).map((payer: { member_id: string; amount_cents: number }) => ({
        memberId: payer.member_id,
        amountCents: cents(payer.amount_cents),
      })),
      beneficiaries: (row.expense_shares ?? []).map((share: { member_id: string; amount_cents: number }) => ({
        memberId: share.member_id,
        amountCents: cents(share.amount_cents),
      })),
      receiptPath: row.receipt_path ?? undefined,
      reversed: Boolean(row.reversed_at),
    })),
    settlements: (settlementResult.data ?? []).map((row) => ({
      id: row.id,
      fromMemberId: row.from_member_id,
      toMemberId: row.to_member_id,
      amountCents: row.amount_cents,
      status: row.status,
      createdAt: row.created_at,
      note: row.note ?? undefined,
    })),
    fundPayments: (fundPaymentResult.data ?? []).map((row) => ({
      id: row.id,
      memberId: row.member_id,
      amountCents: cents(row.amount_cents),
      status: row.status,
      confirmedBy: row.confirmed_by ?? undefined,
      createdAt: row.created_at,
    })),
    balances: (balanceResult.data ?? []).map((row) => ({
      memberId: row.member_id,
      contributionCents: cents(Number(row.contribution_cents)),
      resourceUseCents: cents(Number(row.resource_use_cents)),
      settlementAdjustmentCents: cents(Number(row.settlement_adjustment_cents)),
      netCents: cents(Number(row.net_cents)),
      fundOwedCents: cents(Number(row.fund_owed_cents)),
    })),
    events: (eventResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      startAt: row.start_at,
      endAt: row.end_at,
      allDay: row.all_day,
      location: row.location ?? undefined,
      creatorId: row.creator_member_id,
      audience: row.audience,
      audienceMemberIds: (row.event_audiences ?? []).map((item: { member_id: string }) => item.member_id),
      kind: 'household',
    })),
    courses: (courseResult.data ?? []).map((row) => ({
      id: row.id,
      ownerMemberId: row.owner_member_id,
      code: row.code,
      name: row.name,
      color: row.color,
      meetingLabel: 'Imported schedule',
    })),
    vehicles: orderedVehicles.map((row) => ({
      id: row.id,
      ownerMemberId: row.owner_member_id,
      label: row.label,
      color: row.color,
      plate: row.plate ?? undefined,
    })),
    drivewayVersion: Number(drivewayResult.data?.version ?? 0),
    departures: (departureResult.data ?? []).map((row) => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      ownerMemberId: row.owner_member_id,
      requiredAt: row.required_at,
      source: 'manual',
      sourceLabel: 'Departure',
      warningMinutes: 60,
      blockerVehicleIds: row.blocker_vehicle_ids ?? [],
    })),
    auditEvents: (auditResult.data ?? []).map((row) => ({
      id: row.id,
      actorMemberId: row.actor_member_id ?? undefined,
      action: row.action,
      entityType: row.entity_type,
      summary: row.summary,
      createdAt: row.created_at,
    })),
    notificationHealth: {
      permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
      subscribed: Boolean(pushResult.data?.length),
      installed: window.matchMedia('(display-mode: standalone)').matches,
      lastSuccessAt: pushResult.data?.find((row) => row.last_success_at)?.last_success_at,
    },
  }
}

function recurrenceLabel(value: Record<string, unknown> | null) {
  if (!value) return 'Custom schedule'
  const frequency = String(value.frequency ?? 'weekly')
  const interval = Number(value.interval ?? 1)
  const unit = frequency.replace(/ly$/, '')
  return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`
}
