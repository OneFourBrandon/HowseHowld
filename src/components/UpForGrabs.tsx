import { useEffect, useState } from 'react'
import { Camera, Scale } from 'lucide-react'
import { choresUpForGrabs, claimVoterIds, lastMinuteBefore, listNames } from '../lib/chores'
import { formatInlineDateTime, formatMoney } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { Member } from '../types'
import { ChoreOccurrenceIcon } from './ChoreOccurrenceIcon'
import { ClaimChoreDialog, FinishClaimDialog } from './ClaimDialogs'
import { Avatar, Badge, Button, SectionHeader } from './ui'

const formerMember = { displayName: 'Former roommate', initials: '?', color: '#8a918d' } as Member

export function UpForGrabs({ now }: { now: number }) {
  const { data } = useAppData()
  const currentMemberId = data.household.currentMemberId
  const memberById = (id: string) => data.members.find(member => member.id === id) ?? formerMember
  const items = choresUpForGrabs(data, now, currentMemberId)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [finishingId, setFinishingId] = useState<string | null>(null)
  // Dialogs follow the live list, so a chore that stops being claimable closes its dialog.
  const claiming = items.find(item => item.occurrence.id === claimingId && !item.claim)
  const finishing = items.find(item => item.occurrence.id === finishingId && item.claim?.status === 'claimed')
  // Forget a closed dialog's chore so it can't reopen if the chore becomes claimable again.
  useEffect(() => {
    if (claimingId && !claiming) setClaimingId(null)
    if (finishingId && !finishing) setFinishingId(null)
  }, [claiming, claimingId, finishing, finishingId])

  if (!items.length) return null

  const voterNamesFor = (claimerId: string, assigneeId: string) => listNames(
    claimVoterIds(data.members, { claimerId, assigneeId })
      .map(id => id === currentMemberId ? 'you' : memberById(id).displayName),
  ).replace(/^you/, 'You')

  return (
    <section className="min-w-0 rounded-2xl border border-(--line) bg-(--surface-strong) p-4 max-[640px]:p-3 [&_.section-header]:mb-3 [&_.section-header]:min-h-0 [&_.section-header]:border-0" aria-label="Up for grabs">
      <SectionHeader
        eyebrow="COVER A CHORE"
        title="Up for grabs"
        description="Do a missed chore for a roommate. Take a before photo, do it, then an after photo. If the rest of the house approves, their penalty goes to you."
      />
      <div className="grid gap-2">
        {items.map(item => {
          const assignee = memberById(item.occurrence.assigneeId)
          const claimer = item.claim ? memberById(item.claim.claimerId) : undefined
          const isMyMiss = item.occurrence.assigneeId === currentMemberId
          const isMyClaim = item.claim?.claimerId === currentMemberId
          const inReview = item.claim?.status === 'submitted'
          const when = formatInlineDateTime(lastMinuteBefore(item.deadline).toISOString())
          return (
            <article
              key={item.occurrence.id}
              className="grab-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-(--surface) px-4 py-3 max-[640px]:grid-cols-[auto_minmax(0,1fr)] max-[640px]:gap-x-2.5 max-[640px]:px-3"
            >
              {inReview
                ? <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--blue-soft) text-(--blue)" aria-hidden="true"><Scale size={18} /></span>
                : item.claim
                  ? <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--blue-soft) text-(--blue)" aria-hidden="true"><Camera size={18} /></span>
                  : <ChoreOccurrenceIcon status="missed" />}
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>{item.occurrence.area}</Badge>
                  {inReview
                    ? <Badge tone="blue">In review</Badge>
                    : item.claim && <Badge tone="blue">{isMyClaim ? 'Your claim' : 'Claimed'}</Badge>}
                </div>
                <h3 className="break-words text-[.94rem]">{item.occurrence.taskTitle}</h3>
                <span className="text-[.78rem] text-(--muted)">
                  {inReview
                    ? <>Your photos are with the house · Vote closes {when}</>
                    : item.claim
                      ? <>{isMyClaim ? 'You’re covering this' : `${claimer?.displayName} is covering this`} for {isMyMiss ? 'you' : assignee.displayName} · After photo due {when}</>
                      : <>{isMyMiss ? 'You' : assignee.displayName} missed it · Claim by {when}</>}
                </span>
              </div>
              <div className="flex items-center gap-3 max-[640px]:col-span-full max-[640px]:justify-between max-[640px]:border-t max-[640px]:border-(--line) max-[640px]:pt-2.5">
                <span className="grid justify-items-end leading-tight max-[640px]:justify-items-start">
                  <strong className="font-sans text-[.92rem] text-[#8b6522] tabular-nums dark:text-(--gold)">{formatMoney(item.rewardCents)}</strong>
                  <span className="text-[.66rem] font-bold uppercase tracking-[.06em] text-(--muted)">Reward</span>
                </span>
                {inReview ? (
                  <span className="text-[.74rem] font-semibold text-(--muted)">Details in Infractions</span>
                ) : isMyClaim ? (
                  <Button size="sm" aria-label={`Add after photo: ${item.occurrence.taskTitle}`} onClick={() => setFinishingId(item.occurrence.id)}>
                    <Camera size={16} /> Add after photo
                  </Button>
                ) : item.claim ? (
                  claimer && <Avatar initials={claimer.initials} color={claimer.color} imageUrl={claimer.avatarUrl} size="sm" />
                ) : isMyMiss ? (
                  <span className="text-[.74rem] font-semibold text-(--muted)">Open to roommates</span>
                ) : (
                  <Button size="sm" aria-label={`Cover chore: ${item.occurrence.taskTitle}`} onClick={() => setClaimingId(item.occurrence.id)}>
                    <Camera size={16} /> Cover chore
                  </Button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {claiming && (
        <ClaimChoreDialog
          key={claiming.occurrence.id}
          occurrence={claiming.occurrence}
          assigneeName={memberById(claiming.occurrence.assigneeId).displayName}
          rewardCents={claiming.rewardCents}
          deadline={claiming.deadline}
          onClose={() => setClaimingId(null)}
        />
      )}
      {finishing?.claim && (
        <FinishClaimDialog
          key={finishing.claim.id}
          claim={finishing.claim}
          voterNames={voterNamesFor(finishing.claim.claimerId, finishing.claim.assigneeId)}
          onClose={() => setFinishingId(null)}
        />
      )}
    </section>
  )
}
