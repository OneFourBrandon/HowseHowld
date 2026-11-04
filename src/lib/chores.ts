import type { AppSnapshot, ChoreClaim, Household, Infraction, Member, MoneyCents, TaskOccurrence, UUID } from '../types'
import { cents } from './utils'

export const DEFAULT_GRACE_MINUTES = 240
export const MAX_GRACE_MINUTES = 720
export const CLAIM_REWARD_CENTS = 1000
export const MIN_CLAIM_HOUSEHOLD_SIZE = 3
export const CLAIM_VOTE_HOURS = 48
export const GRACE_PERIOD_OPTIONS = [0, 15, 30, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720]

const MINUTE = 60_000

export function graceMinutesOf(household: Pick<Household, 'choreGraceMinutes'>) {
  return household.choreGraceMinutes ?? DEFAULT_GRACE_MINUTES
}

export function graceEndsAt(dueAt: string, graceMinutes: number) {
  return new Date(new Date(dueAt).getTime() + graceMinutes * MINUTE)
}

/** Past its due time but still finishable by the assignee. */
export function isInGracePeriod(
  occurrence: { status: TaskOccurrence['status']; dueAt: string },
  graceMinutes: number,
  now = Date.now(),
) {
  if (occurrence.status !== 'assigned' || graceMinutes <= 0) return false
  const due = new Date(occurrence.dueAt).getTime()
  return now > due && now <= due + graceMinutes * MINUTE
}

export function formatGracePeriod(minutes: number) {
  if (minutes <= 0) return 'No grace period'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [
    hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '',
    rest ? `${rest} minute${rest === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' ')
}

export function addDateKeyDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function zoneOffsetMs(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value ?? 0)
  const wallClock = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
  return wallClock - Math.floor(instant / 1000) * 1000
}

/** The instant a calendar day starts in a time zone. */
export function zonedMidnight(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const wallClock = Date.UTC(year, month - 1, day)
  let instant = wallClock
  // Two passes settle the offset on days when daylight saving time changes.
  for (let pass = 0; pass < 2; pass++) instant = wallClock - zoneOffsetMs(instant, timeZone)
  return new Date(instant)
}

/** Claims close at the end of the day after the chore's scheduled day. */
export function claimDeadlineFor(scheduledDate: string, timeZone: string) {
  return zonedMidnight(addDateKeyDays(scheduledDate, 2), timeZone)
}

/** Deadlines are exclusive midnights; show them as the last minute of the day. */
export function lastMinuteBefore(deadline: Date | string) {
  return new Date(new Date(deadline).getTime() - MINUTE)
}

export function claimRewardFor(penaltyCents: number): MoneyCents {
  return cents(Math.max(0, Math.min(CLAIM_REWARD_CENTS, penaltyCents)))
}

export function canHouseholdClaim(members: Member[]) {
  return members.filter(member => member.active).length >= MIN_CLAIM_HOUSEHOLD_SIZE
}

export function isLiveClaim(claim?: Pick<ChoreClaim, 'status'>) {
  return claim?.status === 'claimed' || claim?.status === 'submitted'
}

/** The claim that decides an infraction. Lapsed claims only count if nothing replaced them. */
export function claimForInfraction(claims: ChoreClaim[], infractionId: UUID) {
  const forInfraction = claims
    .filter(claim => claim.infractionId === infractionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return forInfraction.find(claim => claim.status !== 'lapsed') ?? forInfraction[0]
}

export function claimVoterIds(members: Member[], claim: Pick<ChoreClaim, 'claimerId' | 'assigneeId'>) {
  return members
    .filter(member => member.active && member.id !== claim.claimerId && member.id !== claim.assigneeId)
    .map(member => member.id)
}

/** More rejections than approvals rejects the claim. A tie, or no votes, approves it. */
export function claimOutcome(approveVotes: number, rejectVotes: number) {
  return rejectVotes > approveVotes ? 'rejected' as const : 'approved' as const
}

export interface ChoreUpForGrabs {
  occurrence: TaskOccurrence
  infraction: Infraction
  claim?: ChoreClaim
  rewardCents: MoneyCents
  deadline: Date
}

/** Missed chores that can still be claimed, plus claims waiting for their after photo. */
export function choresUpForGrabs(
  data: Pick<AppSnapshot, 'household' | 'members' | 'occurrences' | 'infractions' | 'choreClaims'>,
  now = Date.now(),
): ChoreUpForGrabs[] {
  if (!canHouseholdClaim(data.members)) return []
  const items: ChoreUpForGrabs[] = []
  for (const occurrence of data.occurrences) {
    if (occurrence.status !== 'missed') continue
    const infraction = data.infractions.find(item => item.occurrenceId === occurrence.id)
    if (!infraction || infraction.amountCents <= 0) continue
    const claim = claimForInfraction(data.choreClaims, infraction.id)
    const live = claim && claim.status !== 'lapsed' ? claim : undefined
    if (live && live.status !== 'claimed') continue
    if (!live && !['pending', 'disputed', 'upheld'].includes(infraction.status)) continue
    const deadline = live ? new Date(live.claimDeadline) : claimDeadlineFor(occurrence.scheduledDate, data.household.timezone)
    if (deadline.getTime() <= now) continue
    items.push({
      occurrence,
      infraction,
      claim: live,
      rewardCents: live?.rewardCents ?? claimRewardFor(infraction.amountCents),
      deadline,
    })
  }
  return items.sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
}

export function claimVoteOf(claim: Pick<ChoreClaim, 'approveVotes' | 'rejectVotes'>, memberId: UUID) {
  return claim.approveVotes.includes(memberId) ? 'approve' as const
    : claim.rejectVotes.includes(memberId) ? 'reject' as const : null
}
