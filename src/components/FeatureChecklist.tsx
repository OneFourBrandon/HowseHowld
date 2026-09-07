import { cn } from '../lib/cn'
import {
  Bell,
  CalendarDays,
  Car,
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
    <div className="grid grid-cols-2 gap-2.5 max-[720px]:grid-cols-1">
      {householdFeatureOptions.map((feature) => {
        const FeatureIcon = feature.icon
        const checked = enabledFeatures.includes(feature.id)
        return (
          <label
            key={feature.id}
            className={cn(
              'hh-inner grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 p-3.5 transition-colors hover:border-(--line-2)',
              disabled && 'cursor-default opacity-60 hover:border-(--line)',
            )}
          >
            <span
              className={cn(
                'grid size-9.5 shrink-0 place-items-center rounded-xl transition-colors',
                checked ? 'bg-(--blue-soft) text-[#7d9cff]' : 'bg-(--raise) text-(--text-3)',
              )}
              aria-hidden="true"
            >
              <FeatureIcon size={18} strokeWidth={1.9} />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <strong className="text-[.86rem] text-(--text)">{feature.label}</strong>
              <small className="text-[.74rem] leading-snug font-medium text-(--text-3)">
                {feature.description}
              </small>
            </span>
            <input
              className="peer sr-only"
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(feature.id)}
            />
            <span
              className={cn(
                'flex h-6 w-10.5 shrink-0 items-center rounded-full border p-0.75 transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgba(59,107,255,.6)]',
                checked ? 'border-transparent bg-(--green)' : 'border-(--line) bg-(--raise)',
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  'block size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.4)] transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)]',
                  checked && 'translate-x-4.5',
                )}
              />
            </span>
          </label>
        )
      })}
    </div>
  )
}
