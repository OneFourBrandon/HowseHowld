import { AlertTriangle, Check, Clock3 } from 'lucide-react'
import { cn } from '../lib/cn'
import type { TaskOccurrenceStatus } from '../types'

export function ChoreOccurrenceIcon({
  status,
  size = 36,
  className,
}: {
  status: TaskOccurrenceStatus
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-xl bg-(--amber-soft) text-(--amber)',
        status === 'completed' && 'bg-(--green) text-(--bg)',
        status === 'missed' && 'bg-(--red-soft) text-[#ff8080]',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {status === 'completed' ? (
        <Check size={Math.round(size * 0.47)} strokeWidth={2.4} />
      ) : status === 'missed' ? (
        <AlertTriangle size={Math.round(size * 0.45)} strokeWidth={2} />
      ) : (
        <Clock3 size={Math.round(size * 0.45)} strokeWidth={2} />
      )}
    </span>
  )
}
