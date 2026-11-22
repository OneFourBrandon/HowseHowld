import type { ReactNode } from 'react'
import { CalendarDays, CarFront, Check, CircleDollarSign, GraduationCap, ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import type { AgendaEntry, AgendaKind } from '../lib/insights'
import { formatMoney } from '../lib/utils'
import type { Member } from '../types'
import { kindTone } from './kinds'
import { Chip, Face, Tile } from './ui'

export function KindIcon({ kind, size = 16 }: { kind: AgendaKind; size?: number }) {
  if (kind === 'chore') return <ListChecks size={size} />
  if (kind === 'bill') return <CircleDollarSign size={size} />
  if (kind === 'class' || kind === 'exam') return <GraduationCap size={size} />
  if (kind === 'exit') return <CarFront size={size} />
  return <CalendarDays size={size} />
}

/** One thing on a day: when, what kind, whose, and where it stands. */
export function AgendaRow({
  entry,
  person,
  action,
  when,
  onPick,
  timeNote,
  children,
}: {
  entry: AgendaEntry
  person?: Pick<Member, 'initials' | 'color' | 'avatarUrl' | 'displayName'>
  action?: ReactNode
  /** Shown instead of the time, for rows that sit outside the selected day. */
  when?: string
  onPick?: () => void
  /** A second line under the time, such as when it ends. */
  timeNote?: string
  /** Extra controls under the title. */
  children?: ReactNode
}) {
  const missed = entry.state === 'missed'
  return (
    <div
      className="sl-row grid-cols-[4.5rem_auto_minmax(0,1fr)_auto] max-sm:grid-cols-[3.75rem_auto_minmax(0,1fr)_auto] max-sm:gap-2.5"
      data-agenda-item
    >
      {when && onPick ? (
        <button type="button" className="sl-link sl-num justify-self-start no-underline" onClick={onPick} aria-label={`Show ${when}`}>{when}</button>
      ) : (
        <span className="min-w-0">
          <span className={cn('sl-num sl-meta block', entry.state === 'grace' && 'font-[560] text-(--sl-brass)')}>{entry.timeLabel}</span>
          {timeNote && <span className="sl-num sl-micro block">{timeNote}</span>}
        </span>
      )}
      <Tile tone={missed ? 'brick' : kindTone[entry.kind]} className={cn(entry.state === 'ahead' && 'sl-tile-ahead')}>
        <KindIcon kind={entry.kind} />
      </Tile>
      <div className="min-w-0">
        <Link className="block rounded-sm" to={entry.href}>
          <span className={cn('sl-cell-main', entry.state === 'done' && entry.kind === 'chore' && 'text-(--sl-ink-2)')}>{entry.title}</span>
          <span className="sl-cell-sub">{entry.detail}</span>
        </Link>
        {children}
      </div>
      <span className="flex items-center gap-2.5">
        {entry.amountCents != null && <span className="sl-num sl-strong">{formatMoney(entry.amountCents)}</span>}
        {entry.kind === 'chore' && entry.state === 'done' && <Chip tone="moss"><Check size={12} strokeWidth={2.6} />Done</Chip>}
        {entry.kind === 'exam' && <Chip tone="brick">Exam</Chip>}
        {missed && <Chip tone="brick">Missed</Chip>}
        {entry.state === 'grace' && !action && <Chip tone="brass">Grace period</Chip>}
        {action}
        {person && <Face member={person} size={26} />}
      </span>
    </div>
  )
}
