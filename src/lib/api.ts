import { supabase } from './supabase'
import { cents, initials } from './utils'
import type {
  AppSnapshot,
  CalendarEvent,
  CreateHouseholdInput,
  Expense,
  HouseholdFeature,
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
    options: { shouldCreateUser: true },
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

export async function addRecoveryEmail(email: string) {
  const { error } = await requireClient().auth.updateUser({
    email: email.trim().toLowerCase(),
  })
  if (error) throw error
}

export async function joinHouseWithCode(code: string, displayName: string) {
  const client = requireClient()
  const { error: authError } = await client.auth.signInAnonymously({
    options: { data: { display_name: displayName.trim() } },
  })
  if (authError) throw authError
  try {
    await invokeRpc<UUID>('join_household_by_code', {
      p_code: code,
      p_display_name: displayName,
    })
  } catch (error) {
    await client.auth.signOut()
    throw error
  }
}

export async function invokeRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await requireClient().rpc(name, args)
  if (error) throw error
  return data as T
}

export const createHousehold = (input: CreateHouseholdInput) =>
  invokeRpc<{ householdId: UUID; shareCode: string }>('create_household_v2', {
    p_input: input,
  })
export const rotateHouseholdShareCode = (householdId: UUID) =>
  invokeRpc<string>('rotate_household_share_code', {
    p_household_id: householdId,
  })

export async function updateHouseholdFeatures(
  householdId: UUID,
  enabledFeatures: HouseholdFeature[],
) {
  const { data, error } = await requireClient()
    .from('households')
    .update({
      enabled_features: enabledFeatures,
      updated_at: new Date().toISOString(),
    })
    .eq('id', householdId)
    .select('enabled_features')
    .single()
  if (error) throw error
  return data.enabled_features as HouseholdFeature[]
}

export const updateHouseholdTaskReminders = (
  householdId: UUID,
  localTimes: string[],
) =>
  invokeRpc('update_household_task_reminders', {
    p_household_id: householdId,
    p_local_times: localTimes,
  })

export const updateCourse = (courseId: UUID, name: string, color: string) =>
  invokeRpc('update_course', {
    p_course_id: courseId,
    p_name: name,
    p_color: color,
  })

export async function createTask(
  input: Omit<TaskDefinition, 'id' | 'householdId'> & { householdId?: UUID },
) {
  return invokeRpc<UUID>('create_task', { p_input: input })
}

export const updateTask = (taskId: UUID, input: Record<string, unknown>) =>
  invokeRpc('update_task', { p_task_id: taskId, p_input: input })

export const completeOccurrence = (occurrenceId: UUID) =>
  invokeRpc('complete_task_occurrence', { p_occurrence_id: occurrenceId })
export const assignManualTask = (
  taskId: UUID,
  memberId: UUID,
  scheduledDate: string,
) =>
  invokeRpc<UUID>('assign_manual_task', {
    p_task_id: taskId,
    p_member_id: memberId,
    p_scheduled_date: scheduledDate,
  })
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

export const attachExpenseReceipt = (expenseId: UUID, receiptPath: string) =>
  invokeRpc('attach_expense_receipt', {
    p_expense_id: expenseId,
    p_receipt_path: receiptPath,
  })

export async function getReceiptUrl(receiptPath: string) {
  const { data, error } = await requireClient()
    .storage.from('receipts')
    .createSignedUrl(receiptPath, 300)
  if (error) throw error
  return data.signedUrl
}

export const createDepartureRule = (input: Record<string, unknown>) =>
  invokeRpc<UUID>('create_departure_rule', { p_input: input })

export const upsertVehicle = (input: Record<string, unknown>) =>
  invokeRpc<UUID>('upsert_vehicle', { p_input: input })

export const archiveVehicle = (vehicleId: UUID) =>
  invokeRpc('archive_vehicle', { p_vehicle_id: vehicleId })

export const updateScheduleItemKind = (
  scheduleItemId: UUID,
  kind: 'class' | 'exam' | 'other',
) =>
  invokeRpc('update_schedule_item_kind', {
    p_schedule_item_id: scheduleItemId,
    p_kind: kind,
  })

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
    client.from('schedule_items').select('*').eq('household_id', householdId).is('archived_at', null).order('start_at'),
    client.from('vehicles').select('*').eq('household_id', householdId).eq('active', true),
    client.from('driveway_state').select('*, driveway_positions(*)').eq('household_id', householdId).single(),
    client.from('departure_occurrences').select('*, departure_rules(source,label,warning_minutes,schedule_item_id)').eq('household_id', householdId).gte('required_at', new Date().toISOString()),
    client.from('audit_events').select('*').eq('household_id', householdId).order('created_at', { ascending: false }).limit(100),
    client.from('push_subscriptions').select('id,last_success_at').eq('household_id', householdId).eq('active', true),
  ])
  const firstError = results.map((result) => result.error).find(Boolean)
  if (firstError) throw firstError

  const [
    householdResult, taskResult, rotationResult, occurrenceResult, infractionResult,
    expenseResult, settlementResult, fundPaymentResult, balanceResult, eventResult,
    courseResult, scheduleResult, vehicleResult, drivewayResult, departureResult, auditResult, pushResult,
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
      address: {
        line1: household.address_line1 ?? '',
        line2: household.address_line2 ?? undefined,
        city: household.city ?? '',
        region: household.region ?? '',
        postalCode: household.postal_code ?? '',
        countryCode: household.country_code ?? 'CA',
      },
      enabledFeatures: household.enabled_features ?? [
        'chores',
        'money',
        'calendar',
        'courses',
        'driveway',
        'notifications',
      ],
      defaultTaskReminderTimes: (household.default_task_reminders ?? [])
        .filter((reminder: { type?: string }) => reminder.type === 'local_time')
        .map((reminder: { value: string }) => reminder.value.slice(0, 5)),
      shareCodeLast4: household.join_code_last4 ?? undefined,
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
        fixedMemberId: task.fixed_member_id ?? undefined,
        recurrence: task.recurrence ?? { frequency: 'weekly', interval: 1 },
        recurrenceLabel: recurrenceLabel(task.recurrence),
        startsOn: task.starts_on,
        endsOn: task.ends_on ?? undefined,
        dueTime: String(task.due_time).slice(0, 5),
        reminderTimes: (task.reminder_override ?? household.default_task_reminders ?? [])
          .filter((reminder: { type?: string }) => reminder.type === 'local_time')
          .map((reminder: { value: string }) => reminder.value.slice(0, 5)),
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
    events: expandRecurringEvents([
      ...(eventResult.data ?? []).map((row) => ({
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
      kind: 'household' as const,
      recurrence: row.recurrence ?? undefined,
      reminderOffsets: row.reminder_offsets ?? [1440, 60],
    })),
      ...(scheduleResult.data ?? []).map((row) => ({
        id: `schedule-${row.id}`,
        title: row.title,
        description: row.description ?? undefined,
        startAt: row.start_at,
        endAt: row.end_at,
        allDay: false,
        location: row.location ?? undefined,
        creatorId: row.owner_member_id,
        audience: 'everyone' as const,
        audienceMemberIds: [],
        kind: row.kind,
        courseCode: extractCourseCode(row.title),
        reminderOffsets: [60],
        imported: true,
        scheduleItemId: row.id,
        sourceUrl: row.source_url ?? undefined,
      })),
    ]).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    courses: (courseResult.data ?? []).map((row) => ({
      id: row.id,
      ownerMemberId: row.owner_member_id,
      code: row.code,
      name: row.name,
      color: row.color,
      meetingLabel: 'Imported schedule',
      location: scheduleResult.data?.find((item) => item.course_id === row.id)?.location ?? undefined,
      itemCount: scheduleResult.data?.filter((item) => item.course_id === row.id).length ?? 0,
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
      source: row.departure_rules?.source ?? 'manual',
      sourceLabel: row.departure_rules?.label ?? 'Departure',
      warningMinutes: row.departure_rules?.warning_minutes?.[0] ?? 60,
      blockerVehicleIds: row.blocker_vehicle_ids ?? [],
      ruleId: row.rule_id,
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

function extractCourseCode(value: string) {
  return value.match(/\b[A-Z]{2,4}\s?\d{3,4}[A-Z]?\b/i)?.[0]?.toUpperCase()
}

function expandRecurringEvents(events: CalendarEvent[]) {
  const horizon = new Date()
  horizon.setFullYear(horizon.getFullYear() + 1)
  return events.flatMap((event) => {
    if (!event.recurrence || event.recurrence.frequency === 'once' || event.imported) {
      return [event]
    }
    const duration = new Date(event.endAt).getTime() - new Date(event.startAt).getTime()
    const instances: CalendarEvent[] = []
    let cursor = new Date(event.startAt)
    for (let index = 0; index < 400 && cursor <= horizon; index++) {
      if (cursor >= new Date(Date.now() - 31 * 86_400_000)) {
        instances.push({
          ...event,
          id: index === 0 ? event.id : `${event.id}:${cursor.toISOString()}`,
          startAt: cursor.toISOString() as CalendarEvent['startAt'],
          endAt: new Date(cursor.getTime() + duration).toISOString() as CalendarEvent['endAt'],
        })
      }
      const interval = Math.max(1, event.recurrence.interval)
      const next = new Date(cursor)
      if (event.recurrence.frequency === 'daily') next.setDate(next.getDate() + interval)
      if (event.recurrence.frequency === 'weekly') next.setDate(next.getDate() + 7 * interval)
      if (event.recurrence.frequency === 'monthly') next.setMonth(next.getMonth() + interval)
      cursor = next
    }
    return instances
  })
}
