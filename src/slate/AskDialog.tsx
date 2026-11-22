import { type ReactNode, useState } from 'react'
import { Button, Modal } from '../components/ui'

/**
 * A short question before something is carried out: a reason, an amount, or a
 * plain yes. Slate uses this where the classic design uses browser prompts.
 */
export function AskDialog({
  title,
  description,
  field,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string
  description?: ReactNode
  /** Leave out for a plain confirmation. */
  field?: { label: string; kind: 'text' | 'money'; placeholder?: string }
  confirmLabel: string
  danger?: boolean
  onConfirm: (value: string) => void | Promise<void>
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const [working, setWorking] = useState(false)
  const amount = Number(value)
  const valid = !field
    || (field.kind === 'money' ? Number.isFinite(amount) && amount > 0 : value.trim().length > 0)

  return (
    <Modal open onClose={onClose} title={title} className="w-[min(440px,100%)]">
      <form
        className="grid gap-4"
        onSubmit={async event => {
          event.preventDefault()
          if (!valid || working) return
          setWorking(true)
          try {
            await onConfirm(value.trim())
            onClose()
          } catch {
            // The shared handler reports the failure; keep the dialog open to retry.
            setWorking(false)
          }
        }}
      >
        {description && <p className="sl-meta leading-normal">{description}</p>}
        {field && (
          <label>
            {field.label}
            {field.kind === 'money' ? (
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={value}
                placeholder={field.placeholder ?? '0.00'}
                onChange={event => setValue(event.target.value)}
                autoFocus
                required
              />
            ) : (
              <textarea
                rows={3}
                value={value}
                placeholder={field.placeholder}
                onChange={event => setValue(event.target.value)}
                autoFocus
                required
              />
            )}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={!valid || working}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  )
}
