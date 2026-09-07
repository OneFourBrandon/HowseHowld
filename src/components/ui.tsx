import { cn } from '../lib/cn'
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { X, type LucideIcon } from 'lucide-react'

/* ---------------------------------------------------------------- surfaces */

export function Card({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn('hh-card', className)} {...props}>
      {children}
    </div>
  )
}

/** Nested surface inside a Card — one step lighter than the card itself. */
export function Inner({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn('hh-inner', className)} {...props}>
      {children}
    </div>
  )
}

/** The single bright card on a screen. Use it for the one thing that matters most. */
export function FeatureCard({
  tone = 'blue',
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement> & { tone?: 'blue' | 'pink' }>) {
  return (
    <div className={cn(tone === 'pink' ? 'hh-pink' : 'hh-blue', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHead({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-5.5 pt-5 pb-3 max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-3 max-[640px]:px-4',
        className,
      )}
    >
      <div className="grid min-w-0 gap-0.5">
        <h2 className="truncate text-[1.25rem]">{title}</h2>
        {description && <p className="text-[.78rem] text-(--text-3)">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2 max-[640px]:justify-start">{action}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------- controls */

const buttonVariants = {
  primary: 'hh-btn-primary',
  secondary: 'hh-btn-secondary',
  ghost: 'hh-btn-ghost',
  danger: 'hh-btn-danger',
  pink: 'hh-btn-pink',
  blue: 'hh-btn-blue',
} as const

const buttonSizes = {
  sm: 'h-8 px-3 text-[.78rem] gap-1.5',
  md: 'h-9.5 px-4',
  lg: 'h-11.5 px-5.5 text-[.9rem]',
} as const

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants
  size?: keyof typeof buttonSizes
}) {
  return (
    <button
      type="button"
      className={cn('hh-btn', buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({
  label,
  size = 40,
  dot = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  size?: number
  dot?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('hh-btn hh-btn-icon relative', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      {children}
      {dot && (
        <i className="absolute top-2 right-2.5 size-1.75 rounded-full bg-(--pink) shadow-[0_0_0_2px_var(--card)]" />
      )}
    </button>
  )
}

/** Row of mutually exclusive choices, rendered as one pill group. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
  label,
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode }>
  value: T
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
  label?: string
}) {
  return (
    <div className={cn('hh-navpill p-0.75', className)} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'hh-navitem',
            size === 'sm' ? 'h-7 px-3 text-[.72rem]' : 'h-7.5 px-3.5 text-[.78rem]',
            option.value === value && 'hh-navitem-on',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  className?: string
}) {
  return (
    <label
      className={cn(
        'flex min-h-12.5 items-center justify-between gap-4 border-t border-(--line) text-[.84rem] font-semibold first:border-t-0',
        className,
      )}
    >
      <span className="min-w-0">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-6 w-10.5 shrink-0 items-center rounded-full border p-0.75 transition-colors duration-200',
        checked
          ? 'border-transparent bg-(--green)'
          : 'border-(--line) bg-(--raise)',
      )}
    >
      <span
        className={cn(
          'block size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.4)] transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)]',
          checked && 'translate-x-4.5',
        )}
      />
    </button>
  )
}

/** Square checkbox styled to match the design; pairs with a real input elsewhere. */
export function CheckMark({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-4.5 shrink-0 place-items-center rounded-md border transition-colors duration-150',
        on
          ? 'border-(--text) bg-(--text) text-(--bg)'
          : 'border-(--line-2) bg-(--inner) text-transparent',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 9.5 17 19 7" />
      </svg>
    </span>
  )
}

/* -------------------------------------------------------------- indicators */

const badgeTones = {
  neutral: '',
  green: 'border-[rgba(61,220,151,.25)] bg-(--green-soft) text-(--green)',
  amber: 'border-[rgba(255,180,84,.25)] bg-(--amber-soft) text-(--amber)',
  red: 'border-[rgba(255,93,93,.25)] bg-(--red-soft) text-[#ff8080]',
  blue: 'border-transparent bg-(--blue) text-white',
  violet: 'border-[rgba(155,140,255,.25)] bg-(--violet-soft) text-(--violet)',
  pink: 'border-transparent bg-(--pink) text-white',
  white: 'border-transparent bg-(--text) text-(--bg)',
} as const

export function Badge({
  tone = 'neutral',
  className,
  children,
}: PropsWithChildren<{ tone?: keyof typeof badgeTones; className?: string }>) {
  return <span className={cn('hh-badge', badgeTones[tone], className)}>{children}</span>
}

export function Pill({
  tone = 'neutral',
  className,
  children,
}: PropsWithChildren<{ tone?: keyof typeof badgeTones; className?: string }>) {
  return <span className={cn('hh-pill', badgeTones[tone], className)}>{children}</span>
}

const tileTones = {
  neutral: 'bg-(--inner) text-(--text-2)',
  blue: 'bg-(--blue-soft) text-[#7d9cff]',
  green: 'bg-(--green-soft) text-(--green)',
  amber: 'bg-(--amber-soft) text-(--amber)',
  red: 'bg-(--red-soft) text-[#ff8080]',
  violet: 'bg-(--violet-soft) text-(--violet)',
  pink: 'bg-(--pink-soft) text-[#ff7fae]',
  solidGreen: 'bg-(--green) text-(--bg)',
  solidBlue: 'bg-(--blue) text-white',
  solidPink: 'bg-(--pink) text-white',
} as const

export function Tile({
  icon: Icon,
  tone = 'neutral',
  size = 40,
  radius = 12,
  className,
}: {
  icon: LucideIcon
  tone?: keyof typeof tileTones
  size?: number
  radius?: number
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('hh-tile', tileTones[tone], className)}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Icon size={Math.round(size * 0.47)} strokeWidth={1.9} />
    </span>
  )
}

/** Labelled progress track. `hatched` marks a value that is only an estimate. */
export function Progress({
  label,
  value,
  tone = 'pink',
  className,
}: {
  label: string
  value: number
  tone?: 'pink' | 'white' | 'blue' | 'muted' | 'hatched'
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const fills = {
    pink: 'bg-(--pink)',
    white: 'bg-(--text)',
    blue: 'bg-(--blue)',
    muted: 'bg-(--raise)',
    hatched:
      'bg-(--raise) bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.16)_0_3px,transparent_3px_9px)]',
  } as const
  return (
    <div className={cn('grid min-w-0 gap-2', className)}>
      <span className="truncate text-[.76rem] font-semibold text-(--text-2)">{label}</span>
      <div className="relative flex h-8 items-center overflow-hidden rounded-full border border-(--line) bg-(--inner)">
        <i
          className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]', fills[tone])}
          style={{ width: `${clamped}%` }}
        />
        <span
          className={cn(
            'relative px-3.5 text-[.78rem] font-bold',
            tone === 'white' && clamped > 22 ? 'text-(--bg)' : 'text-(--text)',
          )}
        >
          {clamped}%
        </span>
      </div>
    </div>
  )
}

/** Headline figure with its icon token and optional delta chip. */
export function Stat({
  value,
  label,
  icon: Icon,
  tone = 'green',
  delta,
  className,
}: {
  value: ReactNode
  label: string
  icon: LucideIcon
  tone?: 'green' | 'pink' | 'blue' | 'amber' | 'red'
  delta?: string
  className?: string
}) {
  const rings = {
    green: 'bg-(--green) text-(--bg)',
    pink: 'bg-(--pink) text-white',
    blue: 'bg-(--blue) text-white',
    amber: 'bg-(--amber) text-(--bg)',
    red: 'bg-(--red) text-white',
  } as const
  return (
    <div className={cn('grid justify-items-start gap-1', className)}>
      <div className="flex items-center gap-3">
        <span className={cn('relative grid size-8 shrink-0 place-items-center rounded-full', rings[tone])}>
          <Icon size={16} strokeWidth={2.4} />
          {delta && (
            <span className="absolute -top-2 -left-1.5 inline-flex h-4 items-center rounded-full border border-(--line-2) bg-(--card) px-1.25 text-[.58rem] font-extrabold whitespace-nowrap text-(--text)">
              {delta}
            </span>
          )}
        </span>
        <span className="font-display text-[2.35rem] leading-none font-extrabold tracking-[-.03em] max-[640px]:text-[1.9rem]">
          {value}
        </span>
      </div>
      <span className="pl-11 text-[.78rem] font-semibold text-(--text-3)">{label}</span>
    </div>
  )
}

/* ----------------------------------------------------------------- people */

export function Avatar({
  initials,
  color,
  imageUrl,
  size = 'md',
  className,
}: {
  initials: string
  color: string
  imageUrl?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const foreground = avatarForeground(color)
  return (
    <span
      className={cn(
        'inline-flex! m-0! flex-[0_0_auto] items-center! justify-center! overflow-hidden rounded-full leading-none! font-extrabold! tracking-tight! select-none shadow-[0_0_0_2px_var(--card)]',
        size === 'xs' && 'size-6 text-[.6rem]',
        size === 'sm' && 'size-7 text-[.65rem]',
        size === 'md' && 'size-9 text-[.75rem]',
        size === 'lg' && 'size-11 text-[.85rem]',
        size === 'xl' && 'size-22 text-[1.6rem]',
        className,
      )}
      style={
        {
          '--avatar-color': color,
          '--avatar-ink': foreground,
          backgroundColor: color,
          color: foreground,
        } as CSSProperties
      }
      aria-label={initials}
      role="img"
    >
      {imageUrl ? <img className="size-full object-cover" src={imageUrl} alt="" /> : initials}
    </span>
  )
}

export function AvatarStack({
  people,
  size = 'sm',
  className,
}: {
  people: Array<{ id: string; initials: string; color: string; avatarUrl?: string }>
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  return (
    <span className={cn('flex items-center', className)}>
      {people.map((person, index) => (
        <Avatar
          key={person.id}
          initials={person.initials}
          color={person.color}
          imageUrl={person.avatarUrl}
          size={size}
          className={index ? '-ml-1.5' : ''}
        />
      ))}
    </span>
  )
}

function avatarForeground(color: string) {
  const hex = color.replace('#', '')
  if (!/^[\da-f]{6}$/i.test(hex)) return '#ffffff'
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  )
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000
  return luminance > 150 ? '#17221e' : '#ffffff'
}

/* ------------------------------------------------------------------ layout */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  eyebrow?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-end justify-between gap-8 px-1 pt-1.5 max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-4',
        className,
      )}
    >
      <div className="grid min-w-0 gap-1.5">
        {eyebrow && (
          <p className="text-[.72rem] font-semibold tracking-[.06em] text-(--text-3) uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[2.25rem] max-[640px]:text-[1.75rem]">{title}</h1>
        {description && <p className="text-[.88rem] text-(--text-3)">{description}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-[760px]:w-full">{actions}</div>
      )}
    </div>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-6 pb-3">
      <div className="grid gap-1.5">
        {eyebrow && (
          <p className="text-[.72rem] font-semibold tracking-[.06em] text-(--text-3) uppercase">
            {eyebrow}
          </p>
        )}
        <h2 className="text-[1.35rem]">{title}</h2>
        {description && (
          <p className="max-w-130 text-[.82rem] leading-normal text-(--text-3)">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid min-h-32 place-items-center content-center gap-2 px-4 py-8 text-center', className)}>
      {Icon && (
        <span className="mb-1 grid size-10 place-items-center rounded-full bg-(--inner) text-(--text-3)">
          <Icon size={18} />
        </span>
      )}
      <strong className="text-[.92rem]">{title}</strong>
      {description && <span className="max-w-80 text-[.8rem] text-(--text-3)">{description}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  description,
  className,
  headerClassName,
  closeButtonClassName,
  children,
}: PropsWithChildren<{
  open: boolean
  onClose: () => void
  title: string
  description?: string
  className?: string
  headerClassName?: string
  closeButtonClassName?: string
}>) {
  if (!open) return null
  return (
    <div
      className="hh-anim-fade fixed inset-0 z-60 grid place-items-center bg-[rgba(5,6,8,.72)] p-5 backdrop-blur-[6px] max-[640px]:p-3"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={cn(
          'hh-anim-pop hh-card w-[min(660px,100%)] max-h-[min(880px,92vh)] overflow-auto rounded-3xl p-6.5 shadow-[0_40px_120px_-20px_rgba(0,0,0,.8)] max-[640px]:p-4.5',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={cn('mb-5 flex items-start justify-between gap-4', headerClassName)}>
          <div className="grid gap-1">
            <h2 id="modal-title" className="text-[1.5rem]">{title}</h2>
            {description && <p className="text-[.82rem] text-(--text-3)">{description}</p>}
          </div>
          <button
            type="button"
            className={cn('hh-btn hh-btn-icon size-9', closeButtonClassName)}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

/** Right-aligned footer actions for a modal form. */
export function ModalActions({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn('mt-2 flex justify-end gap-2', className)}>{children}</div>
  )
}
