import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { DEFAULT_PENALTY_TIERS, validatePenaltyTiers } from '../lib/penalties'
import { useAppData } from '../state/AppDataContext'
import { Button, SectionHeader } from './ui'

export function PenaltySettings() {
  const { data, busy, updatePenaltyTiers } = useAppData()
  const saved = data.household.penaltyTiers ?? DEFAULT_PENALTY_TIERS
  const [draft, setDraft] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const values = draft ?? saved.map(amount => (amount / 100).toFixed(2))
  const saving = busy === 'household:penalties'
  return <section>
    <SectionHeader eyebrow="HOUSE RULES" title="Chore penalties" />
    <form className="grid gap-4" onSubmit={async event => {
      event.preventDefault()
      setError('')
      try {
        const tiers = values.map(value => Math.round(Number(value) * 100))
        validatePenaltyTiers(tiers)
        await updatePenaltyTiers(tiers)
        setDraft(null)
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save penalty tiers.') }
    }}>
      <p className="text-sm text-(--muted)">Upheld misses in the previous 30 days determine the tier. The final tier repeats for further misses. Changes apply to new infractions only.</p>
      <fieldset className="grid gap-2" disabled={saving}>
        <legend className="sr-only">Penalty amounts in Canadian dollars</legend>
        {values.map((value, index) => <div key={index} className="flex items-center gap-3 rounded-xl border border-(--line) bg-(--surface-strong) p-3">
          <span className="min-w-0 flex-1 text-sm text-(--ink)">{index === 0 ? 'First miss' : `Miss ${index + 1}`}{index === values.length - 1 ? ' and onwards' : ''}</span>
          <label className="flex w-32 shrink-0 items-center rounded-lg border border-(--line-strong) px-2 text-(--ink)">
            <span aria-hidden="true">$</span>
            <input className="mt-0! min-w-0 border-0! bg-transparent! px-1.5 py-2 text-right tabular-nums shadow-none!" aria-label={`Tier ${index + 1} penalty amount`} type="text" inputMode="decimal" required value={value} onChange={event => {
              if (/^\d*(\.\d{0,2})?$/.test(event.target.value)) setDraft(values.map((item, position) => position === index ? event.target.value : item))
            }} />
          </label>
          <button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg text-(--muted) hover:bg-(--coral-soft) hover:text-(--coral) disabled:opacity-40" disabled={values.length === 1} aria-label={`Remove tier ${index + 1}`} onClick={() => setDraft(values.filter((_, position) => position !== index))}><Trash2 size={16} /></button>
        </div>)}
      </fieldset>
      {error && <p role="alert" className="text-sm text-(--coral)">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={saving || values.length >= 20} onClick={() => setDraft([...values, values[values.length - 1]])}><Plus size={16} /> Add tier</Button>
        {draft && <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => { setDraft(null); setError('') }}>Cancel</Button>}
        <Button type="submit" size="sm" disabled={saving || !draft}>{saving ? 'Saving…' : 'Save penalty tiers'}</Button>
      </div>
    </form>
  </section>
}
