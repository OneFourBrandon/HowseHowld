import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../lib/cn'
import { CLAIM_VOTE_HOURS, lastMinuteBefore } from '../lib/chores'
import { useClaimPhotoUrls } from '../lib/useClaimPhotoUrls'
import { formatInlineDateTime, formatMoney } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { ChoreClaim, MoneyCents, TaskOccurrence } from '../types'
import { PhotoCapture } from './ClaimPhotos'
import { Button, Modal } from './ui'

const STEPS = ['Before photo', 'Do the chore', 'After photo']

function ClaimSteps({ current }: { current: number }) {
  return (
    <ol className="grid min-w-0 grid-cols-3 gap-1.5" aria-label="Steps to cover a chore">
      {STEPS.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? 'step' : undefined}
          className={cn(
            'grid min-w-0 justify-items-center gap-1 rounded-lg border border-(--line) bg-(--surface) px-1.5 py-2 text-center text-[.7rem] leading-tight font-semibold text-(--muted)',
            index < current && 'text-(--ink)!',
            index === current && 'border-(--forest)! bg-(--sage)! text-(--ink)!',
          )}
        >
          <span className={cn(
            'grid size-5 place-items-center rounded-full bg-(--line-strong) text-[.66rem] font-extrabold text-(--ink)',
            index < current && 'bg-(--green-soft)! text-(--green)!',
            index === current && 'bg-(--forest)! text-white!',
          )}>
            {index < current ? <Check size={12} strokeWidth={3} aria-label="Done" /> : index + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  )
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Something went wrong. Try again.'
}

/** Shared submit handling: inline errors, and the dialog can always be closed. */
function usePhotoSubmit(action: (photo: File) => Promise<void>, onDone: () => void) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!photo) return
    setError('')
    try {
      await action(photo)
      onDone()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }
  return { photo, setPhoto: (file: File | null) => { setError(''); setPhoto(file) }, error, submit }
}

export function ClaimChoreDialog({ occurrence, assigneeName, rewardCents, deadline, onClose }: {
  occurrence: TaskOccurrence
  assigneeName: string
  rewardCents: MoneyCents
  deadline: Date
  onClose: () => void
}) {
  const { busy, claimChore } = useAppData()
  const working = busy === `claim:${occurrence.id}`
  const { photo, setPhoto, error, submit } = usePhotoSubmit(file => claimChore(occurrence.id, file), onClose)
  return (
    <Modal
      open
      onClose={onClose}
      title="Cover this chore"
      description={`${assigneeName} missed “${occurrence.taskTitle}”. Start with a photo that shows it still needs doing.`}
    >
      <form className="grid grid-cols-[minmax(0,1fr)] gap-4" onSubmit={submit}>
        <ClaimSteps current={0} />
        <PhotoCapture
          label="Take the before photo"
          hint="Show the chore as it is now, before you start."
          caption="Before"
          file={photo}
          onChange={setPhoto}
          disabled={working}
        />
        <p className="rounded-lg bg-(--sage-2) p-3 text-[.76rem] leading-normal text-(--muted)">
          Once you claim it, only you can finish it. Add the after photo by {formatInlineDateTime(lastMinuteBefore(deadline).toISOString())} or the claim lapses. If the house approves, you earn {formatMoney(rewardCents)}.
        </p>
        {error && <p role="alert" className="text-[.8rem] text-(--coral)">{error}</p>}
        <div className="modal-actions flex justify-end gap-2.25">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!photo || working}>{working ? 'Uploading…' : 'Claim chore'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export function FinishClaimDialog({ claim, voterNames, onClose }: {
  claim: ChoreClaim
  voterNames: string
  onClose: () => void
}) {
  const { busy, finishChoreClaim } = useAppData()
  const working = busy === `claim:finish:${claim.id}`
  const { photo, setPhoto, error, submit } = usePhotoSubmit(file => finishChoreClaim(claim.id, file), onClose)
  return (
    <Modal
      open
      onClose={onClose}
      title="Add the after photo"
      description="Take it from the same spot as your before photo so the house can compare them."
    >
      <form className="grid grid-cols-[minmax(0,1fr)] gap-4" onSubmit={submit}>
        <ClaimSteps current={2} />
        <div className="grid grid-cols-2 items-start gap-2">
          <BeforeThumbnail path={claim.beforePhotoPath} />
          <PhotoCapture
            label="After photo"
            hint="Show the finished chore."
            caption="After"
            file={photo}
            onChange={setPhoto}
            disabled={working}
            compact
          />
        </div>
        <p className="rounded-lg bg-(--sage-2) p-3 text-[.76rem] leading-normal text-(--muted)">
          {voterNames ? `${voterNames} then vote` : 'The house then votes'}, for up to {CLAIM_VOTE_HOURS} hours. Approved: you earn {formatMoney(claim.rewardCents)}. A tie or no votes approves it.
        </p>
        {error && <p role="alert" className="text-[.8rem] text-(--coral)">{error}</p>}
        <div className="modal-actions flex justify-end gap-2.25">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!photo || working}>{working ? 'Uploading…' : 'Submit for review'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function BeforeThumbnail({ path }: { path: string }) {
  const { urls, failed } = useClaimPhotoUrls([path])
  return (
    <figure className="m-0 grid gap-1.5">
      {urls[path]
        ? <img className="aspect-[4/3] w-full rounded-xl border border-(--line) object-cover" src={urls[path]} alt="" />
        : <span className="grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed border-(--line-strong) text-[.72rem] text-(--muted)">{failed ? 'Photo unavailable' : 'Loading photo…'}</span>}
      <figcaption className="text-[.68rem] font-extrabold uppercase tracking-[.06em] text-(--muted)">Before</figcaption>
    </figure>
  )
}
