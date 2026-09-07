import { Check } from 'lucide-react'
import { cn } from '../lib/cn'
import { formatMoney } from '../lib/utils'
import type { MemberShare, ShareBreakdown as Breakdown } from '../lib/shares'
import { Avatar } from './ui'

/** Stacked bar: one segment per person, sized by their share, in their own colour. */
export function ShareBar({
  breakdown,
  height = 10,
  className,
}: {
  breakdown: Breakdown
  height?: number
  className?: string
}) {
  const owed = breakdown.shares.filter((share) => share.owedCents > 0)
  if (!owed.length) {
    return (
      <div
        className={cn('rounded-full bg-(--sage-2)', className)}
        style={{ height }}
        aria-hidden="true"
      />
    )
  }
  return (
    <div className={cn('flex gap-0.5 overflow-hidden rounded-full', className)} style={{ height }}>
      {owed.map((share) => (
        <span
          key={share.member.id}
          title={`${share.member.displayName} · ${formatMoney(share.owedCents)}`}
          className={cn(
            'block transition-[flex-grow] duration-500',
            share.isCurrentMember && 'ring-1 ring-white/45 ring-inset',
          )}
          style={{ flexGrow: Math.max(share.owedCents, 1), background: share.member.color }}
        />
      ))}
    </div>
  )
}

/** Donut of the same split, for surfaces with room for a real graphic. */
export function ShareDonut({
  breakdown,
  size = 148,
  label,
  sublabel,
}: {
  breakdown: Breakdown
  size?: number
  label?: string
  sublabel?: string
}) {
  const stroke = Math.round(size * 0.14)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const owed = breakdown.shares.filter((share) => share.owedCents > 0)
  const total = owed.reduce((sum, share) => sum + share.owedCents, 0) || 1

  let cursor = 0
  const arcs = owed.map((share) => {
    const length = (share.owedCents / total) * circumference
    const arc = {
      key: share.member.id,
      color: share.member.color,
      dash: `${Math.max(length - 2, 0.5)} ${circumference - Math.max(length - 2, 0.5)}`,
      offset: -cursor,
      current: share.isCurrentMember,
    }
    cursor += length
    return arc
  })

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--sage-2)"
            strokeWidth={stroke}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={arc.current ? stroke + 3 : stroke}
              strokeDasharray={arc.dash}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 grid place-content-center justify-items-center gap-0.5 text-center">
        <span className="font-display text-[1.15rem] leading-none font-extrabold tracking-[-.02em]">
          {label ?? formatMoney(breakdown.totalCents)}
        </span>
        {sublabel && <span className="text-[.66rem] font-semibold text-(--muted)">{sublabel}</span>}
      </div>
    </div>
  )
}

/** One person's line: avatar, name, their percentage, and what they owe on the item. */
export function ShareRow({
  share,
  showPaid = true,
  compact = false,
}: {
  share: MemberShare
  showPaid?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3',
        compact ? 'py-1.5' : 'py-2',
      )}
    >
      <span className="relative">
        <Avatar
          initials={share.member.initials}
          color={share.member.color}
          imageUrl={share.member.avatarUrl}
          size={compact ? 'sm' : 'md'}
        />
        {showPaid && share.paidCents > 0 && (
          <span className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full bg-(--green) text-(--paper) shadow-[0_0_0_2px_var(--surface-strong)]">
            <Check size={9} strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span className="grid min-w-0 leading-tight">
        <span className={cn('truncate font-bold', compact ? 'text-[.8rem]' : 'text-[.86rem]')}>
          {share.member.displayName}
          {share.isCurrentMember && <span className="font-medium text-(--muted)"> (you)</span>}
        </span>
        <span className="truncate text-[.72rem] text-(--muted)">
          {share.settled === true
            ? 'Paid'
            : share.settled === false
              ? 'Not paid yet'
              : share.paidCents > 0
                ? `Put in ${formatMoney(share.paidCents)}`
                : 'Owes their share'}
        </span>
      </span>
      <span className="grid justify-items-end leading-tight">
        <span
          className={cn('font-bold tabular-nums', compact ? 'text-[.82rem]' : 'text-[.9rem]')}
        >
          {formatMoney(share.owedCents)}
        </span>
        <span className="text-[.7rem] font-semibold text-(--muted) tabular-nums">
          {share.percent.toFixed(share.percent < 10 ? 1 : 0)}%
        </span>
      </span>
    </div>
  )
}

/**
 * The hover card on a money row. Answers "what is my cut of this?" without
 * making anyone open the item.
 */
export function SharePeek({
  breakdown,
  title,
  className,
}: {
  breakdown: Breakdown
  title: string
  className?: string
}) {
  const visible = breakdown.shares.slice(0, 5)
  const hidden = breakdown.shares.length - visible.length
  return (
    <div
      className={cn(
        'border border-(--line) bg-(--surface-strong) w-72 rounded-2xl p-3.5 shadow-[0_28px_60px_-18px_rgba(0,0,0,.85)]',
        className,
      )}
      role="tooltip"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="truncate text-[.78rem] font-bold">{title}</span>
        <span className="shrink-0 text-[.78rem] font-extrabold tabular-nums">
          {formatMoney(breakdown.totalCents)}
        </span>
      </div>
      <ShareBar breakdown={breakdown} height={8} />
      <div className="mt-1.5 divide-y divide-(--line)">
        {visible.map((share) => (
          <ShareRow key={share.member.id} share={share} compact />
        ))}
      </div>
      {hidden > 0 && (
        <p className="pt-1.5 text-[.7rem] text-(--muted)">+{hidden} more</p>
      )}
      <p className="mt-2 border-t border-(--line) pt-2 text-[.7rem] text-(--muted)">
        {breakdown.mine
          ? `Your share is ${formatMoney(breakdown.mine.owedCents)} · ${breakdown.mine.percent.toFixed(0)}%`
          : 'You have no share in this item.'}
      </p>
    </div>
  )
}
