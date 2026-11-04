import type { AppSnapshot, ChoreClaim, Household, Infraction, Member, MoneyCents, TaskOccurrence, UUID } from '../types'
import { cents, dateKeyInTimeZone } from './utils'

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

/**
 * The instant a calendar day starts in a time zone. On a daylight saving day the
 * offsets before and after the change can differ; the day starts at the earliest
 * candidate that falls on the requested date. Where clocks skip midnight, that is
 * the first minute after the gap, matching Postgres.
 */
export function zonedMidnight(dateKey: string, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const wallClock = Date.UTC(year, month - 1, day)
  const candidates = [-12, 12]
    .map(hours => wallClock - zoneOffsetMs(wallClock + hours * 3_600_000, timeZone))
    .filter(instant => dateKeyInTimeZone(new Date(instant), timeZone) === dateKey)
  return new Date(candidates.length ? Math.min(...candidates) : wallClock - zoneOffsetMs(wallClock, timeZone))
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

/** The server fixes the reviewers when the after photo is submitted; before that, preview them. */
export function claimVoterIds(
  members: Member[],
  claim: Pick<ChoreClaim, 'claimerId' | 'assigneeId'> & { voterIds?: UUID[] },
) {
  if (claim.voterIds) return claim.voterIds
  return members
    .filter(member => member.active && member.id !== claim.claimerId && member.id !== claim.assigneeId)
    .map(member => member.id)
}

/** "Noah", "Noah and Maya", "Noah, Maya, and Liam". */
export function listNames(names: string[]) {
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
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

/**
 * Missed chores that can still be claimed, claims waiting for their after photo,
 * and the viewer's own claims while the house reviews them.
 */
export function choresUpForGrabs(
  data: Pick<AppSnapshot, 'household' | 'members' | 'occurrences' | 'infractions' | 'choreClaims'>,
  now = Date.now(),
  viewerId?: UUID,
): ChoreUpForGrabs[] {
  if (!canHouseholdClaim(data.members)) return []
  const items: ChoreUpForGrabs[] = []
  for (const occurrence of data.occurrences) {
    if (occurrence.status !== 'missed') continue
    const infraction = data.infractions.find(item => item.occurrenceId === occurrence.id)
    if (!infraction || infraction.amountCents <= 0) continue
    const claim = claimForInfraction(data.choreClaims, infraction.id)
    const live = claim && claim.status !== 'lapsed' ? claim : undefined
    const myReview = Boolean(viewerId) && live?.status === 'submitted' && live.claimerId === viewerId
    if (live && live.status !== 'claimed' && !myReview) continue
    if (!live && !['pending', 'disputed', 'upheld'].includes(infraction.status)) continue
    const deadline = myReview && live?.voteDeadline
      ? new Date(live.voteDeadline)
      : live ? new Date(live.claimDeadline) : claimDeadlineFor(occurrence.scheduledDate, data.household.timezone)
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
