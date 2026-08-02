import { cn } from '../lib/cn'
import {
  Bell,
  CalendarDays,
  Car,
  Check,
  ClipboardCheck,
  GraduationCap,
  WalletMinimal,
  type LucideIcon,
} from 'lucide-react'
import type { HouseholdFeature } from '../types'

const householdFeatureOptions: Array<{
  id: HouseholdFeature
  label: string
  description: string
  icon: LucideIcon
}> = [
  {
    id: 'chores',
    label: 'Chores',
    description: 'Rotations, deadlines and accountability',
    icon: ClipboardCheck,
  },
  {
    id: 'money',
    label: 'Shared money',
    description: 'Expenses, balances and settlements',
    icon: WalletMinimal,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'House events and reminders',
    icon: CalendarDays,
  },
  {
    id: 'courses',
    label: 'Courses',
    description: 'Class schedules and ICS imports',
    icon: GraduationCap,
  },
  {
    id: 'driveway',
    label: 'Driveway',
    description: 'Vehicle order and departure alerts',
    icon: Car,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Push reminders and diagnostics',
    icon: Bell,
  },
]

export function FeatureChecklist({
  enabledFeatures,
  onToggle,
  disabled = false,
}: {
  enabledFeatures: HouseholdFeature[]
  onToggle: (feature: HouseholdFeature) => void
  disabled?: boolean
}) {
  return (
    <div className={"feature-options feature-checklist flex flex-col gap-0 border-t border-t-(--line)"}>
      {householdFeatureOptions.map((feature) => {
        const FeatureIcon = feature.icon
        const checked = enabledFeatures.includes(feature.id)
        return (
          <label
            key={feature.id}
            className={cn(
              'feature-option grid min-h-16.5 cursor-pointer grid-cols-[28px_minmax(0,1fr)_20px] items-center gap-3 border-0 border-b border-b-(--line) bg-transparent p-[11px_2px]',
              disabled && 'is-disabled cursor-default opacity-[.64]',
            )}
          >
            <FeatureIcon className={"feature-icon text-(--forest-2)"} size={21} aria-hidden="true" />
            <span className={"feature-copy"}>
              <strong className="block text-[.86rem] text-(--ink)">{feature.label}</strong>
              <small className="mt-0.5 block text-[.76rem] leading-[1.35] font-medium text-(--muted)">{feature.description}</small>
            </span>
            <input
              className="peer sr-only"
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(feature.id)}
            />
            <span className={cn(
              "feature-checkbox w-4.75 h-4.75 grid place-items-center border border-[#9aa8a1] rounded-[5px] text-transparent transition-[background_.15s_ease,border-color_.15s_ease,color_.15s_ease] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgba(43,75,31,.2)]",
              checked && 'text-white!',
              checked ? 'border-(--forest)! bg-(--forest)!' : 'border-[#9aa8a1] bg-transparent'
            )} aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
          </label>
        )
      })}
    </div>
  )
}
