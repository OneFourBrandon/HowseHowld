import { useId, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { GRACE_PERIOD_OPTIONS, formatGracePeriod, graceMinutesOf } from '../lib/chores'
import { useAppData } from '../state/AppDataContext'
import { Button, SectionHeader } from './ui'

function exampleEnd(minutes: number) {
  return format(new Date(2026, 0, 1, 23, 59 + minutes), 'h:mm a')
}

export function GracePeriodSettings() {
  const { data, busy, updateChoreGracePeriod } = useAppData()
  const saved = graceMinutesOf(data.household)
  const [draft, setDraft] = useState<number | null>(null)
  const value = draft ?? saved
  const saving = busy === 'household:grace'
  const labelId = useId()
  const options = GRACE_PERIOD_OPTIONS.includes(saved) ? GRACE_PERIOD_OPTIONS : [...GRACE_PERIOD_OPTIONS, saved].sort((a, b) => a - b)

  return (
    <section>
      <SectionHeader eyebrow="HOUSE RULES" title="Grace period" />
      <form
        className="grid gap-4"
        onSubmit={async event => {
          event.preventDefault()
          if (draft === null) return
          try {
            await updateChoreGracePeriod(draft)
            setDraft(null)
          } catch { /* The shared handler shows the error. */ }
        }}
      >
        <p className="text-sm text-(--muted)">
          Extra time after a chore’s due time when it can still be finished. Once the grace period ends, the chore counts as missed and roommates can cover it.
        </p>
        <div className="flex items-center gap-3 rounded-xl border border-(--line) bg-(--surface-strong) p-3 max-[420px]:flex-wrap">
          <span id={labelId} className="min-w-0 flex-1 text-sm text-(--ink)">Grace period</span>
          <span className="relative w-44 shrink-0 max-[420px]:w-full">
            <select
              aria-labelledby={labelId}
              className="mt-0! appearance-none py-2 pr-9!"
              value={value}
              disabled={saving}
              onChange={event => {
                const next = Number(event.target.value)
                setDraft(next === saved ? null : next)
              }}
            >
              {options.map(minutes => <option key={minutes} value={minutes}>{minutes === 0 ? 'None' : formatGracePeriod(minutes)}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-(--muted)" size={16} />
          </span>
        </div>
        <p className="text-xs text-(--muted)">
          {value === 0
            ? 'A chore due at 11:59 PM counts as missed right at 11:59 PM.'
            : `A chore due at 11:59 PM can be finished until ${exampleEnd(value)}.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {draft !== null && <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setDraft(null)}>Cancel</Button>}
          <Button type="submit" size="sm" disabled={saving || draft === null}>{saving ? 'Saving…' : 'Save grace period'}</Button>
        </div>
      </form>
    </section>
  )
}
