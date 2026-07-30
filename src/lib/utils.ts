import { format, formatDistanceToNowStrict, isToday, isTomorrow } from 'date-fns'
import type { ISODateTime, MoneyCents } from '../types'

export function cents(value: number): MoneyCents {
  return Math.round(value) as MoneyCents
}

export function formatMoney(value: MoneyCents | number, showSign = false) {
  const amount = Number(value) / 100
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    signDisplay: showSign ? 'always' : 'auto',
  }).format(amount)
}

export function formatDateTime(value: ISODateTime | string) {
  const date = new Date(value)
  const day = isToday(date)
    ? 'Today'
    : isTomorrow(date)
      ? 'Tomorrow'
      : format(date, 'EEE, MMM d')
  return `${day} · ${format(date, 'h:mm a')}`
}

export function formatShortTime(value: ISODateTime | string) {
  return format(new Date(value), 'h:mm a')
}

export function timeUntil(value: ISODateTime | string) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true })
}

export function splitEvenly(totalCents: number, memberIds: string[]) {
  if (!memberIds.length) return []
  const base = Math.floor(totalCents / memberIds.length)
  let remainder = totalCents - base * memberIds.length
  return [...memberIds]
    .sort()
    .map((memberId) => ({
      memberId,
      amountCents: cents(base + (remainder-- > 0 ? 1 : 0)),
    }))
}

export function penaltyForPriorMisses(priorConfirmedMisses: number) {
  return cents(Math.min(1_000 + Math.max(0, priorConfirmedMisses) * 500, 3_000))
}

export function blockerIds(orderedVehicleIds: string[], targetVehicleId: string) {
  const index = orderedVehicleIds.indexOf(targetVehicleId)
  return index <= 0 ? [] : orderedVehicleIds.slice(0, index)
}

export function nextRotationMember(memberIds: string[], existingOccurrences: number) {
  if (!memberIds.length) return null
  return memberIds[Math.max(0, existingOccurrences) % memberIds.length]
}

export function resolvePeerVote(upholdVotes: number, excuseVotes: number) {
  if (upholdVotes >= 2) return 'upheld' as const
  if (excuseVotes >= 2) return 'excused' as const
  return 'disputed' as const
}

export function isLedgerBalanced(amounts: number[]) {
  return amounts.reduce((total, amount) => total + amount, 0) === 0
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function uid(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID()}`
}

export function toIso(date: Date): ISODateTime {
  return date.toISOString() as ISODateTime
}
