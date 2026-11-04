import { AlertTriangle, Check, Clock3 } from 'lucide-react'
import { cn } from '../lib/cn'
import type { TaskOccurrenceStatus } from '../types'

export function ChoreOccurrenceIcon({
  status,
  className,
}: {
  status: TaskOccurrenceStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg',
        // One colour pair per status: cn() does not merge conflicting utilities.
        status === 'completed'
          ? 'bg-(--green) text-white'
          : status === 'missed'
            ? 'bg-(--coral-soft) text-(--coral)'
            : 'bg-(--gold-soft) text-[#8a7444]',
        className,
      )}
      aria-hidden="true"
    >
      {status === 'completed'
        ? <Check size={18} />
        : status === 'missed'
          ? <AlertTriangle size={18} />
          : <Clock3 size={18} />}
    </span>
  )
}
