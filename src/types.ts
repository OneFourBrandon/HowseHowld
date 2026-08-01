export type UUID = string
export type MoneyCents = number & { readonly __brand: 'MoneyCents' }
export type ISODateTime = string & { readonly __brand: 'ISODateTime' }

export type HouseholdRole = 'owner' | 'member'
export const HOUSEHOLD_FEATURES = [
  'chores',
  'money',
  'calendar',
  'courses',
  'driveway',
  'notifications',
] as const
export type HouseholdFeature =
  (typeof HOUSEHOLD_FEATURES)[number]
export type TaskAssignmentMode = 'rotation' | 'fixed' | 'manual' | 'one_off'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'once' | 'rolling_queue'
export interface RecurrenceDefinition {
  frequency: RecurrenceFrequency
  interval: number
  weekdays?: number[]
}
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
  avatarPath?: string
  avatarUrl?: string
  role: HouseholdRole
  active: boolean
}

export interface Household {
  id: UUID
  name: string
  timezone: string
  currency: 'CAD'
  currentMemberId: UUID
  address: {
    line1: string
    line2?: string
    city: string
    region: string
    postalCode: string
    countryCode: string
  }
  enabledFeatures: HouseholdFeature[]
  defaultTaskReminderTimes: string[]
  shareCodeLast4?: string
}

export interface CreateHouseholdInput {
  name: string
  addressLine1: string
  addressLine2?: string
  city: string
  region: string
  postalCode: string
  countryCode: string
  enabledFeatures: HouseholdFeature[]
}

export interface TaskDefinition {
  id: UUID
  householdId: UUID
  title: string
  description?: string
  area: string
  assignmentMode: TaskAssignmentMode
  fixedMemberId?: UUID
  recurrence: RecurrenceDefinition
  recurrenceLabel: string
  startsOn: string
  endsOn?: string
  dueTime: string
  reminderTimes: string[]
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

export type HouseholdBillCategory =
  | 'rent'
  | 'electricity'
  | 'water'
  | 'gas'
  | 'internet'
  | 'insurance'
  | 'other'

export interface HouseholdBill {
  id: UUID
  householdId: UUID
  name: string
  category: HouseholdBillCategory
  amountCents?: MoneyCents
  dueDay: number
  reminderDaysBefore: number[]
  active: boolean
  memberIds: UUID[]
}

export interface HouseholdBillPeriod {
  id: UUID
  billId: UUID
  periodMonth: string
  dueAt: ISODateTime
  amountCents?: MoneyCents
  paidMemberIds: UUID[]
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
  recurrence?: RecurrenceDefinition
  reminderOffsets: number[]
  imported?: boolean
  scheduleItemId?: UUID
  sourceUrl?: string
}

export interface Course {
  id: UUID
  ownerMemberId: UUID
  code: string
  name: string
  color: string
  meetingLabel: string
  location?: string
  itemCount?: number
}

export type SharedCourseMeetingKind = 'lecture' | 'lab'
export type SharedCourseAssessmentKind = 'midterm' | 'exam'

export interface SharedCourseMeeting {
  id: UUID
  memberId: UUID
  kind: SharedCourseMeetingKind
  weekday: 1 | 2 | 3 | 4 | 5
  startTime: string
  durationMinutes: number
  location?: string
}

export interface SharedCourseAssessment {
  id: UUID
  memberId: UUID
  kind: SharedCourseAssessmentKind
  title: string
  startsAt: ISODateTime
  durationMinutes: number
  location?: string
}

export interface SharedCourse {
  id: UUID
  code: string
  name: string
  color: string
  createdByMemberId: UUID
  enrollmentMemberIds: UUID[]
  meetings: SharedCourseMeeting[]
  assessments: SharedCourseAssessment[]
}

export interface SaveSharedCourseInput {
  householdId: UUID
  courseId?: UUID
  code: string
  name: string
  color: string
  meetings: Array<Omit<SharedCourseMeeting, 'id' | 'memberId'>>
  assessments: Array<Omit<SharedCourseAssessment, 'id' | 'memberId'>>
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
  ruleId?: UUID
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
  bills: HouseholdBill[]
  billPeriods: HouseholdBillPeriod[]
  balances: MemberBalance[]
  events: CalendarEvent[]
  courses: Course[]
  sharedCourses: SharedCourse[]
  vehicles: Vehicle[]
  departures: Departure[]
  auditEvents: AuditEvent[]
  notificationHealth: NotificationHealth
}
