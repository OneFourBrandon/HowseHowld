import { useState } from 'react'
import { Camera } from 'lucide-react'
import { cn } from '../lib/cn'
import { choresUpForGrabs, lastMinuteBefore, type ChoreUpForGrabs } from '../lib/chores'
import { formatDateTime, formatMoney } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { Member } from '../types'
import { ChoreOccurrenceIcon } from './ChoreOccurrenceIcon'
import { PhotoCapture } from './ClaimPhotos'
import { useClaimPhotoUrls } from '../lib/useClaimPhotoUrls'
import { Avatar, Badge, Button, Modal, SectionHeader } from './ui'

const formerMember = { displayName: 'Former roommate', initials: '?', color: '#8a918d' } as Member

function byDeadline(deadline: Date) {
  return formatDateTime(lastMinuteBefore(deadline).toISOString()).replace(' · ', ' at ')
}

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
            index === current && 'border-(--forest)! bg-(--green-soft)! text-(--ink)!',
          )}
        >
          <span className={cn(
            'grid size-5 place-items-center rounded-full bg-(--line) text-[.66rem] font-extrabold text-(--ink)',
            index < current && 'bg-(--green)! text-white!',
            index === current && 'bg-(--forest)! text-white!',
          )}>{index + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  )
}

export function UpForGrabs({ now }: { now: number }) {
  const { data, busy, claimChore, finishChoreClaim } = useAppData()
  const currentMemberId = data.household.currentMemberId
  const memberById = (id: string) => data.members.find(member => member.id === id) ?? formerMember
  const items = choresUpForGrabs(data, now)
  const [claiming, setClaiming] = useState<ChoreUpForGrabs | null>(null)
  const [finishing, setFinishing] = useState<ChoreUpForGrabs | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)

  if (!items.length) return null

  const closeModals = () => {
    setClaiming(null)
    setFinishing(null)
    setPhoto(null)
  }
  const claimBusy = claiming ? busy === `claim:${claiming.occurrence.id}` : false
  const finishBusy = finishing?.claim ? busy === `claim:finish:${finishing.claim.id}` : false

  return (
    <section className="min-w-0 rounded-2xl border border-(--line) bg-(--surface-strong) p-4 max-[640px]:p-3 [&_.section-header]:mb-3 [&_.section-header]:min-h-0 [&_.section-header]:border-0" aria-label="Up for grabs">
      <SectionHeader
        eyebrow="COVER A CHORE"
        title="Up for grabs"
        description="Do a missed chore for a roommate. If the rest of the house approves your before and after photos, you earn the reward and they pay the penalty."
      />
      <div className="grid gap-2">
        {items.map(item => {
          const assignee = memberById(item.occurrence.assigneeId)
          const claimer = item.claim ? memberById(item.claim.claimerId) : undefined
          const isMyMiss = item.occurrence.assigneeId === currentMemberId
          const isMyClaim = item.claim?.claimerId === currentMemberId
          return (
            <article
              key={item.occurrence.id}
              className="grab-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-(--surface) px-4 py-3 max-[640px]:grid-cols-[auto_minmax(0,1fr)] max-[640px]:gap-x-2.5 max-[640px]:px-3"
            >
              {item.claim
                ? <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--blue-soft) text-(--blue)" aria-hidden="true"><Camera size={18} /></span>
                : <ChoreOccurrenceIcon status="missed" />}
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>{item.occurrence.area}</Badge>
                  {item.claim && <Badge tone="blue">{isMyClaim ? 'Your claim' : 'Claimed'}</Badge>}
                </div>
                <h3 className="break-words text-[.94rem]">{item.occurrence.taskTitle}</h3>
                <span className="text-[.78rem] text-(--muted)">
                  {item.claim
                    ? <>{isMyClaim ? 'You’re covering this' : `${claimer?.displayName} is covering this`} for {isMyMiss ? 'you' : assignee.displayName} · After photo by {byDeadline(item.deadline)}</>
                    : <>{isMyMiss ? 'You' : assignee.displayName} missed it · Claim by {byDeadline(item.deadline)}</>}
                </span>
              </div>
              <div className="flex items-center gap-3 max-[640px]:col-span-full max-[640px]:justify-between max-[640px]:border-t max-[640px]:border-(--line) max-[640px]:pt-2.5">
                <span className="grid justify-items-end leading-tight max-[640px]:justify-items-start">
                  <strong className="font-sans text-[.92rem] text-[#8b6522] tabular-nums dark:text-(--gold)">{formatMoney(item.rewardCents)}</strong>
                  <span className="text-[.66rem] font-bold uppercase tracking-[.06em] text-(--muted)">Reward</span>
                </span>
                {isMyClaim ? (
                  <Button size="sm" onClick={() => setFinishing(item)}>
                    <Camera size={16} /> Finish
                  </Button>
                ) : item.claim ? (
                  claimer && <Avatar initials={claimer.initials} color={claimer.color} imageUrl={claimer.avatarUrl} size="sm" />
                ) : isMyMiss ? (
                  <span className="text-[.74rem] font-semibold text-(--muted)">Open to roommates</span>
                ) : (
                  <Button size="sm" onClick={() => setClaiming(item)}>
                    <Camera size={16} /> Cover chore
                  </Button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <Modal
        open={Boolean(claiming)}
        onClose={() => { if (!claimBusy) closeModals() }}
        title="Cover this chore"
        description={claiming
          ? `${memberById(claiming.occurrence.assigneeId).displayName} missed “${claiming.occurrence.taskTitle}”. Start with a photo that shows it still needs doing.`
          : undefined}
      >
        {claiming && (
          <form
            className="grid grid-cols-[minmax(0,1fr)] gap-4"
            onSubmit={async event => {
              event.preventDefault()
              if (!photo) return
              try {
                await claimChore(claiming.occurrence.id, photo)
                closeModals()
              } catch { /* The shared handler shows the error. */ }
            }}
          >
            <ClaimSteps current={0} />
            <PhotoCapture
              label="Take the before photo"
              hint="Show the chore as it is now, before you start."
              file={photo}
              onChange={setPhoto}
              disabled={claimBusy}
            />
            <p className="rounded-lg bg-(--sage-2) p-3 text-[.76rem] leading-normal text-(--muted)">
              Once you claim it, only you can finish it. Add the after photo by {byDeadline(claiming.deadline)} or the claim lapses. If the house approves, you earn {formatMoney(claiming.rewardCents)}.
            </p>
            <div className="modal-actions flex justify-end gap-2.25">
              <Button type="button" variant="ghost" disabled={claimBusy} onClick={closeModals}>Cancel</Button>
              <Button type="submit" disabled={!photo || claimBusy}>{claimBusy ? 'Uploading…' : 'Claim chore'}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(finishing)}
        onClose={() => { if (!finishBusy) closeModals() }}
        title="Finish and submit"
        description="Take the after photo from the same spot. The roommates outside this claim compare it with your before photo."
      >
        {finishing?.claim && (
          <form
            className="grid grid-cols-[minmax(0,1fr)] gap-4"
            onSubmit={async event => {
              event.preventDefault()
              if (!photo || !finishing.claim) return
              try {
                await finishChoreClaim(finishing.claim.id, photo)
                closeModals()
              } catch { /* The shared handler shows the error. */ }
            }}
          >
            <ClaimSteps current={2} />
            <div className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] items-start gap-3 max-[520px]:grid-cols-1">
              <BeforeThumbnail path={finishing.claim.beforePhotoPath} />
              <PhotoCapture
                label="Take the after photo"
                hint="Show the finished chore."
                file={photo}
                onChange={setPhoto}
                disabled={finishBusy}
              />
            </div>
            <p className="rounded-lg bg-(--sage-2) p-3 text-[.76rem] leading-normal text-(--muted)">
              Voting stays open for 48 hours, or until everyone outside the claim has voted. A tie or no votes approves it.
            </p>
            <div className="modal-actions flex justify-end gap-2.25">
              <Button type="button" variant="ghost" disabled={finishBusy} onClick={closeModals}>Cancel</Button>
              <Button type="submit" disabled={!photo || finishBusy}>{finishBusy ? 'Uploading…' : 'Submit for review'}</Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  )
}

function BeforeThumbnail({ path }: { path: string }) {
  const { urls } = useClaimPhotoUrls([path])
  return (
    <figure className="m-0 grid gap-1.5">
      {urls[path]
        ? <img className="aspect-[4/3] w-full rounded-xl border border-(--line) object-cover" src={urls[path]} alt="Your before photo" />
        : <span className="grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed border-(--line-strong) text-[.72rem] text-(--muted)">Loading photo…</span>}
      <figcaption className="text-[.68rem] font-extrabold uppercase tracking-[.06em] text-(--muted)">Your before photo</figcaption>
    </figure>
  )
}
