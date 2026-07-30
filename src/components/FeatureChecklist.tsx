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
    <div className="feature-options feature-checklist">
      {householdFeatureOptions.map((feature) => {
        const FeatureIcon = feature.icon
        return (
          <label
            key={feature.id}
            className={`feature-option${disabled ? ' is-disabled' : ''}`}
          >
            <FeatureIcon className="feature-icon" size={21} aria-hidden="true" />
            <span className="feature-copy">
              <strong>{feature.label}</strong>
              <small>{feature.description}</small>
            </span>
            <input
              type="checkbox"
              checked={enabledFeatures.includes(feature.id)}
              disabled={disabled}
              onChange={() => onToggle(feature.id)}
            />
            <span className="feature-checkbox" aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
          </label>
        )
      })}
    </div>
  )
}
