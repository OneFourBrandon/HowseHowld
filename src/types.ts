export type UUID = string
export type MoneyCents = number & { readonly __brand: 'MoneyCents' }
export type ISODateTime = string & { readonly __brand: 'ISODateTime' }

export type HouseholdRole = 'owner' | 'member'
export type TaskAssignmentMode = 'rotation' | 'fixed' | 'manual' | 'one_off'
export type TaskOccurrenceStatus = 'assigned' | 'completed' | 'missed'
export type InfractionStatus =
  | 'pending'
  | 'disputed'
  | 'upheld'
  | 'excused'
  | 'paid'
export type LedgerTransactionType =
  | 'expense'
  | 'settlement'
  | 'expense_reversal'
  | 'penalty'
  | 'fund_payment'

export interface Member {
  id: UUID
  profileId: UUID
  displayName: string
  email: string
  initials: string
  color: string
  role: HouseholdRole
  active: boolean
}

export interface Household {
  id: UUID
  name: string
  timezone: string
  currency: 'CAD'
  currentMemberId: UUID
}

export interface TaskDefinition {
  id: UUID
  householdId: UUID
  title: string
  description?: string
  area: string
  assignmentMode: TaskAssignmentMode
  recurrenceLabel: string
  dueTime: string
  penaltyEnabled: boolean
  active: boolean
  rotationMemberIds: UUID[]
  nextMemberId?: UUID
}

export interface TaskOccurrence {
  id: UUID
  taskId: UUID
  taskTitle: string
  area: string
  assigneeId: UUID
  dueAt: ISODateTime
  status: TaskOccurrenceStatus
  completedAt?: ISODateTime
  reminderLabel: string
}

export interface Infraction {
  id: UUID
  occurrenceId: UUID
  memberId: UUID
  taskTitle: string
  amountCents: MoneyCents
  status: InfractionStatus
  disputeDeadline: ISODateTime
  disputeReason?: string
  upholdVotes: UUID[]
  excuseVotes: UUID[]
}

export interface ExpenseShare {
  memberId: UUID
  amountCents: MoneyCents
}

export interface Expense {
  id: UUID
  title: string
  purchasedAt: ISODateTime
  createdBy: UUID
  amountCents: MoneyCents
  payers: ExpenseShare[]
  beneficiaries: ExpenseShare[]
  receiptPath?: string
  reversed: boolean
}

export interface Settlement {
  id: UUID
  fromMemberId: UUID
  toMemberId: UUID
  amountCents: MoneyCents
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: ISODateTime
  note?: string
}

export interface FundPayment {
  id: UUID
  memberId: UUID
  amountCents: MoneyCents
  status: 'pending' | 'confirmed' | 'rejected'
  confirmedBy?: UUID
  createdAt: ISODateTime
}

export interface MemberBalance {
  memberId: UUID
  contributionCents: MoneyCents
  resourceUseCents: MoneyCents
  settlementAdjustmentCents: MoneyCents
  netCents: MoneyCents
  fundOwedCents: MoneyCents
}

export interface CalendarEvent {
  id: UUID
  title: string
  description?: string
  startAt: ISODateTime
  endAt: ISODateTime
  allDay: boolean
  location?: string
  creatorId: UUID
  audience: 'everyone' | 'selected' | 'self'
  audienceMemberIds: UUID[]
  kind: 'household' | 'class' | 'exam' | 'other'
  courseCode?: string
}

export interface Course {
  id: UUID
  ownerMemberId: UUID
  code: string
  name: string
  color: string
  meetingLabel: string
  location?: string
}

export interface Vehicle {
  id: UUID
  ownerMemberId: UUID
  label: string
  color: string
  plate?: string
}

export interface Departure {
  id: UUID
  vehicleId: UUID
  ownerMemberId: UUID
  requiredAt: ISODateTime
  source: 'manual' | 'course'
  sourceLabel: string
  warningMinutes: number
  blockerVehicleIds: UUID[]
}

export interface AuditEvent {
  id: UUID
  actorMemberId?: UUID
  action: string
  entityType: string
  summary: string
  createdAt: ISODateTime
}

export interface NotificationHealth {
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  installed: boolean
  lastSuccessAt?: ISODateTime
}

export interface AppSnapshot {
  household: Household
  members: Member[]
  tasks: TaskDefinition[]
  occurrences: TaskOccurrence[]
  infractions: Infraction[]
  expenses: Expense[]
  settlements: Settlement[]
  fundPayments: FundPayment[]
  balances: MemberBalance[]
  events: CalendarEvent[]
  courses: Course[]
  vehicles: Vehicle[]
  drivewayVersion: number
  departures: Departure[]
  auditEvents: AuditEvent[]
  notificationHealth: NotificationHealth
}
