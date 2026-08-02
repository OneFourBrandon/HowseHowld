import { cn } from '../lib/cn'
import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import * as React from "react";

const cardClasses = 'card bg-transparent border-0 rounded-none shadow-none'
const buttonClasses = 'border-0 inline-flex items-center justify-center gap-2 font-[750] transition-[.18s_ease] disabled:cursor-wait disabled:opacity-56 rounded-lg shadow-none'
const buttonVariants = {
  primary: 'text-white bg-(--forest) shadow-[0_8px_18px_rgba(43,75,31,.18)] hover:bg-(--forest-2) hover:transform-none',
  secondary: 'text-(--forest) border border-[#d4dfd6] bg-transparent border-(--line-strong) hover:bg-[#edf1ed]',
  ghost: 'text-(--muted) bg-transparent',
  danger: 'text-[#9a3c2b] bg-(--coral-soft) border border-[#edc7bd]',
} as const
const buttonSizes = {
  sm: 'p-[0_12px] min-h-9.5 px-3.5 text-[.78rem] max-[640px]:min-h-9.5 max-[640px]:text-[.76rem]',
  md: 'p-[0_17px] min-h-11.5 px-4.75 text-[.86rem] max-[640px]:min-h-11 max-[640px]:text-[.82rem]',
  lg: 'p-[0_21px] min-h-13 px-5.75 text-[.92rem]',
} as const

export function Card({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn(cardClasses, className)} {...props}>
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
      className={cn(buttonClasses, buttonVariants[variant], buttonSizes[size], className)}
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
  return <span className={cn(
    'w-fit inline-flex items-center gap-1 p-[5px_8px] rounded-full text-[#5c6661] bg-[#eeeee8] font-extrabold uppercase text-[.75rem] tracking-[.035em]',
    tone === 'green' && 'bg-(--green-soft)! text-[#28644f]',
    tone === 'amber' && 'bg-(--gold-soft)! text-[#8b6522]',
    tone === 'red' && 'bg-(--coral-soft)! text-[#99402f]',
    tone === 'blue' && 'bg-(--blue-soft)! text-[#495b91]',
  )}>{children}</span>
}

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
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const foreground = avatarForeground(color)
  return (
      <span
        className={cn(
          'avatar m-0! inline-flex! flex-[0_0_auto] items-center! justify-center! overflow-hidden rounded-full leading-none! font-[850]! tracking-tight! border-2 border-(--surface-strong) select-none shadow-[0_0_0_1px_color-mix(in_srgb,var(--avatar-color,#568742)_68%,#17221e),inset_0_0_0_1px_rgba(255,255,255,.14)]',
        size === 'sm' && 'w-8.5 h-8.5 text-[.75rem]',
        size === 'md' && 'w-10.5 h-10.5 text-[.8rem]',
        size === 'lg' && 'w-12.5 h-12.5 text-[.9rem]',
        size === 'xl' && 'w-24 h-24 text-[1.35rem]',
        className,
      )}
      style={
        {
            '--avatar-color': color,
            '--avatar-ink': foreground,
            backgroundColor: color,
            color: foreground,
          } as React.CSSProperties
        }
        aria-label={initials}
        role="img"
      >
        {imageUrl ? (
          <img className="size-full object-cover" src={imageUrl} alt="" />
        ) : (
          initials
        )}
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
    <div className={"section-header flex items-end justify-between gap-6 m-0 p-[0_0_12px] border-b border-b-(--line) min-h-16 mb-4.5 max-[640px]:min-h-14.5"}>
      <div className="grid gap-1.75">
        {eyebrow && <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>{eyebrow}</p>}
        <h2 className="text-[clamp(1.65rem,2vw,1.95rem)] max-[640px]:text-[1.55rem]">{title}</h2>
        {description && <p className={"muted max-w-130 text-[.84rem] leading-normal text-(--muted)"}>{description}</p>}
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
    <div className={"modal-backdrop fixed inset-0 z-[60] grid place-items-center p-5 bg-[rgba(18,32,28,.58)] backdrop-blur-[5px]"} role="presentation" onMouseDown={onClose}>
      <section
        className={"modal w-[min(620px,100%)] max-h-[min(850px,92vh)] overflow-auto p-6.25 shadow-[0_30px_100px_rgba(0,0,0,.22)] border border-(--line) rounded-xl bg-(--surface-strong)"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={"modal-header flex justify-between items-start gap-4.5 mb-5.5"}>
          <div className="grid gap-1.25">
            <h2 id="modal-title">{title}</h2>
            {description && <p className={"muted text-[.8rem] text-(--muted)"}>{description}</p>}
          </div>
          <button className={"icon-button w-8.75 h-8.75 grid place-items-center border-0 rounded-full text-(--muted) bg-[#eeeee8]"} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
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
    <label className={"toggle-row flex items-center justify-between border-t border-t-(--line) first:border-t-0 min-h-13.75 text-[.82rem]"}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={cn(
          'w-9.75 h-5.5 p-0.75 border-0 rounded-full transition-[.18s]',
          checked ? 'bg-(--green)' : 'bg-[#cacdc7]'
        )}
        onClick={() => onChange(!checked)}
      >
        <span className={cn('block size-4 rounded-full bg-white transition-[.18s]', checked && 'translate-x-4.25')} />
      </button>
    </label>
  )
}
