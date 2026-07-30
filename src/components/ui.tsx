import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { clsx } from 'clsx'
import { X } from 'lucide-react'

export function Card({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={clsx('card', className)} {...props}>
      {children}
    </div>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <button
      className={clsx('button', `button-${variant}`, `button-${size}`, className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({
  tone = 'neutral',
  children,
}: PropsWithChildren<{
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue'
}>) {
  return <span className={clsx('badge', `badge-${tone}`)}>{children}</span>
}

export function Avatar({
  initials,
  color,
  size = 'md',
}: {
  initials: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span
      className={clsx('avatar', `avatar-${size}`)}
      style={{ '--avatar-color': color } as React.CSSProperties}
      aria-label={initials}
    >
      {initials}
    </span>
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
    <div className="section-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: PropsWithChildren<{
  open: boolean
  onClose: () => void
  title: string
  description?: string
}>) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={clsx('toggle', checked && 'toggle-on')}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </label>
  )
}
