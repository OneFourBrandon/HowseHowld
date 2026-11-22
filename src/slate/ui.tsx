import {
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useId,
  useRef,
  useState,
} from 'react'
import { cn } from '../lib/cn'
import type { Member } from '../types'
import { useDismiss } from './hooks'
import { type Tone, toneClass } from './tone'

export function Panel({
  title,
  note,
  tools,
  flush = false,
  as: Tag = 'section',
  className,
  children,
  ...props
}: PropsWithChildren<{
  title?: ReactNode
  note?: ReactNode
  tools?: ReactNode
  /** No body padding, for tables and lists that run edge to edge. */
  flush?: boolean
  as?: ElementType
} & Omit<HTMLAttributes<HTMLElement>, 'title'>>) {
  const headingId = useId()
  return (
    <Tag
      className={cn('sl-panel', flush && 'sl-panel-flush', className)}
      aria-labelledby={title ? headingId : undefined}
      {...props}
    >
      {(title || tools) && (
        <div className="sl-panel-head">
          <div className="min-w-0">
            {title && <h2 className="sl-panel-title" id={headingId}>{title}</h2>}
            {note && <p className="sl-panel-note">{note}</p>}
          </div>
          {tools && <div className="sl-panel-tools">{tools}</div>}
        </div>
      )}
      {children}
    </Tag>
  )
}

export function Stats({
  cols,
  colsSm = 2,
  className,
  children,
}: PropsWithChildren<{ cols: number; colsSm?: 2 | 3; className?: string }>) {
  return (
    <div className={cn('sl-stats', className)} style={{ '--cols': cols, '--cols-sm': colsSm } as CSSProperties}>
      {children}
    </div>
  )
}

export function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: Tone
}) {
  return (
    <div className={cn('sl-stat', toneClass(tone))}>
      <div className="sl-stat-label">
        {tone && <i className="sl-dot" aria-hidden="true" />}
        {label}
      </div>
      <div className="sl-stat-value">{value}</div>
      {note && <div className="sl-stat-note">{note}</div>}
    </div>
  )
}

export function Chip({
  tone,
  dot = false,
  className,
  children,
}: PropsWithChildren<{ tone?: Tone; dot?: boolean; className?: string }>) {
  return (
    <span className={cn('sl-chip', toneClass(tone), className)}>
      {dot && <i className="sl-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** A gauge: the fill is the reading and the hatched track is what remains. */
export function Meter({
  label,
  hint,
  display,
  value,
  tone,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  display: ReactNode
  /** 0 to 1. */
  value: number
  tone?: Tone
  className?: string
}) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div
      className={cn('sl-meter', toneClass(tone), className)}
      data-short={clamped < .22 || undefined}
      style={{ '--value': `${clamped * 100}%` } as CSSProperties}
    >
      <div className="sl-meter-fill" data-empty={value <= 0} />
      <div className="sl-meter-text">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="font-[520] text-(--sl-ink)">{label}</span>
          {hint && <span className="sl-micro">{hint}</span>}
        </span>
        <span className="sl-num font-[560] text-(--sl-ink)">{display}</span>
      </div>
    </div>
  )
}

export function Bar({ value, tone, className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn('sl-bar', toneClass(tone), className)}
      style={{ '--value': `${Math.max(0, Math.min(1, value)) * 100}%` } as CSSProperties}
      aria-hidden="true"
    >
      <i />
    </span>
  )
}

function readableOn(color: string) {
  const hex = color.replace('#', '')
  if (!/^[\da-f]{6}$/i.test(hex)) return '#ffffff'
  const [red, green, blue] = [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#14161a' : '#ffffff'
}

/** A roommate's avatar, sized for dense rows. */
export function Face({
  member,
  size = 26,
  className,
}: {
  member: Pick<Member, 'initials' | 'color' | 'avatarUrl' | 'displayName'>
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn('sl-face', className)}
      style={{ '--face': `${size}px`, backgroundColor: member.color, color: readableOn(member.color) } as CSSProperties}
      role="img"
      aria-label={member.displayName}
      title={member.displayName}
    >
      {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : member.initials}
    </span>
  )
}

export function Tile({ tone, className, children }: PropsWithChildren<{ tone?: Tone; className?: string }>) {
  return <span className={cn('sl-tile', toneClass(tone), className)} aria-hidden="true">{children}</span>
}

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: ReactNode }>
  className?: string
}) {
  return (
    <div className={cn('sl-seg', className)} role="group" aria-label={label}>
      {options.map(option => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      className="sl-switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  )
}

export function Empty({
  icon,
  title,
  children,
  className,
}: PropsWithChildren<{ icon?: ReactNode; title: string; className?: string }>) {
  return (
    <div className={cn('sl-empty', className)}>
      {icon && <Tile className="mb-1">{icon}</Tile>}
      <strong>{title}</strong>
      {children}
    </div>
  )
}

/** A button that opens a small popover anchored beneath it. */
export function Popover({
  trigger,
  align = 'end',
  className,
  anchorClassName,
  children,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  align?: 'start' | 'end'
  className?: string
  /** Classes for the element the popover is positioned against. */
  anchorClassName?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  return (
    <div className={cn('relative', anchorClassName)} ref={ref}>
      {trigger({ open, toggle: () => setOpen(shown => !shown) })}
      {open && (
        <div className={cn('sl-pop top-[calc(100%+6px)]', align === 'end' ? 'right-0' : 'left-0', className)}>
          {children(close)}
        </div>
      )}
    </div>
  )
}
