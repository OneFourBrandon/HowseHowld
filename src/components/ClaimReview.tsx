import { useState } from 'react'
import { Camera, MessageSquareText } from 'lucide-react'
import { cn } from '../lib/cn'
import { claimVoteOf, claimVoterIds, listNames } from '../lib/chores'
import { formatMoney } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { ChoreClaim, Member, MoneyCents } from '../types'
import { FinishClaimDialog } from './ClaimDialogs'
import { ClaimPhotoPair } from './ClaimPhotos'
import { Avatar, Button } from './ui'

const formerMember = { displayName: 'Former roommate', initials: '?', color: '#8a918d' } as Member

// Matches the Excuse button so the two vote pairs read the same way.
const approveButtonClasses = 'text-[#28644f]! dark:text-(--green)! bg-(--green-soft)! border-[#bfe0d3]!'

/** The claim behind an infraction: who covered it, the evidence, and the vote. */
export function ClaimReview({ claim, taskTitle, penaltyCents, now, compact = false }: {
  claim: ChoreClaim
  taskTitle: string
  penaltyCents: MoneyCents
  now: number
  compact?: boolean
}) {
  const { data, busy, voteChoreClaim, noteChoreClaim } = useAppData()
  const currentMemberId = data.household.currentMemberId
  const memberById = (id: string) => data.members.find(member => member.id === id) ?? formerMember
  const claimer = memberById(claim.claimerId)
  const assignee = memberById(claim.assigneeId)
  const voterIds = claimVoterIds(data.members, claim)
  const voterNames = listNames(voterIds.map(id => id === currentMemberId ? 'you' : memberById(id).displayName)).replace(/^you/, 'You')
  const isVoter = voterIds.includes(currentMemberId)
  const isAssignee = claim.assigneeId === currentMemberId
  const isClaimer = claim.claimerId === currentMemberId
  const myVote = claimVoteOf(claim, currentMemberId)
  const live = claim.status === 'claimed' || claim.status === 'submitted'
  const voteOpen = claim.status === 'submitted' && (!claim.voteDeadline || Date.parse(claim.voteDeadline) > now)
  const [changingVote, setChangingVote] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [note, setNote] = useState(claim.assigneeNote ?? '')
  const noteFormOpen = editingNote && isAssignee && live
  const showVoteButtons = voteOpen && isVoter && (!myVote || changingVote)
  const assigneeName = isAssignee ? 'your' : `${assignee.displayName}’s`

  const headline = claim.status === 'approved'
    ? `${isClaimer ? 'You' : claimer.displayName} covered this and earned ${formatMoney(claim.rewardCents)}`
    : claim.status === 'rejected'
      ? `The house rejected ${isClaimer ? 'your' : `${claimer.displayName}’s`} claim, so this miss was excused`
      : claim.status === 'submitted' && isVoter
        ? `Did ${claimer.displayName} really do it?`
        : `${isClaimer ? 'You’re' : `${claimer.displayName} is`} covering this for ${formatMoney(claim.rewardCents)}`
  const subline = claim.status === 'claimed'
    ? `Waiting for ${isClaimer ? 'your' : `${claimer.displayName}’s`} after photo`
    : claim.status === 'submitted'
      ? isVoter
        ? `${claimer.displayName} is claiming ${formatMoney(claim.rewardCents)} for covering ${assigneeName} chore`
        : voterNames ? `${voterNames} ${voterIds.length === 1 ? 'votes' : 'vote'} on this` : undefined
      : undefined

  return (
    <div className={cn('grid gap-3 rounded-lg bg-(--surface-strong) p-3 shadow-[0_0_0_1px_var(--line)]', compact && 'bg-(--surface)!')}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5">
        <Avatar initials={claimer.initials} color={claimer.color} imageUrl={claimer.avatarUrl} size="sm" />
        <span className="grid min-w-0 gap-0.5">
          <strong className="text-[.82rem] leading-snug">{headline}</strong>
          {subline && <span className="text-[.74rem] text-(--muted)">{subline}</span>}
        </span>
      </div>

      <ClaimPhotoPair
        beforePath={claim.beforePhotoPath}
        afterPath={claim.afterPhotoPath}
        afterPlaceholder={claim.status === 'lapsed' ? 'No after photo' : 'After photo pending'}
      />

      {isClaimer && claim.status === 'claimed' && (
        <Button className="justify-self-start" size="sm" aria-label={`Add after photo: ${taskTitle}`} onClick={() => setFinishing(true)}>
          <Camera size={15} /> Add after photo
        </Button>
      )}

      {claim.assigneeNote && !noteFormOpen && (
        <figure className="m-0 grid gap-1">
          <blockquote className="border-l-2 border-(--line-strong) pl-3 text-[.82rem] leading-normal">“{claim.assigneeNote}”</blockquote>
          <figcaption className="pl-3 text-[.7rem] text-(--muted)">{isAssignee ? 'Your note' : `${assignee.displayName}’s note`}</figcaption>
        </figure>
      )}
      {isAssignee && live && (noteFormOpen ? (
        <form
          className="grid gap-2"
          onSubmit={async event => {
            event.preventDefault()
            try {
              await noteChoreClaim(claim.id, note)
              setEditingNote(false)
            } catch { /* The shared handler shows the error. */ }
          }}
        >
          <label className="grid gap-1">
            <span className="text-[.78rem] font-semibold text-(--ink)">Your side, for the roommates voting</span>
            <textarea className="mt-0!" rows={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="For example: I did it before work, check the sink." />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingNote(false); setNote(claim.assigneeNote ?? '') }}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!note.trim() || busy === `claim:note:${claim.id}`}>Save note</Button>
          </div>
        </form>
      ) : (
        <Button className="justify-self-start" size="sm" variant="secondary" onClick={() => { setNote(claim.assigneeNote ?? ''); setEditingNote(true) }}>
          <MessageSquareText size={15} /> {claim.assigneeNote ? 'Edit your note' : 'Add your side'}
        </Button>
      ))}

      {claim.status !== 'claimed' && claim.status !== 'lapsed' && (
        <ClaimTally claim={claim} voterCount={voterIds.length} />
      )}

      {showVoteButtons && (
        <div className="grid grid-cols-2 gap-2 [&>button]:min-h-11">
          <Button variant="danger" aria-label={`Reject the claim: ${taskTitle}`} disabled={busy === `claim:vote:${claim.id}` || myVote === 'reject'} onClick={() => { setChangingVote(false); void voteChoreClaim(claim.id, 'reject').catch(() => {}) }}>Reject</Button>
          <Button className={approveButtonClasses} variant="secondary" aria-label={`Approve the claim: ${taskTitle}`} disabled={busy === `claim:vote:${claim.id}` || myVote === 'approve'} onClick={() => { setChangingVote(false); void voteChoreClaim(claim.id, 'approve').catch(() => {}) }}>Approve</Button>
          {myVote && (
            <button className="col-span-2 justify-self-center border-0 bg-transparent py-1 text-[.78rem] font-bold text-(--muted)" type="button" onClick={() => setChangingVote(false)}>
              Keep my vote to {myVote}
            </button>
          )}
        </div>
      )}
      {voteOpen && isVoter && myVote && !showVoteButtons && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-(--surface) px-3 py-1">
          <span className="text-[.78rem]">You voted to <strong className={myVote === 'approve' ? 'text-[#28644f] dark:text-(--green)' : 'text-[#99402f] dark:text-(--coral)'}>{myVote}</strong></span>
          <Button className="-mr-2" size="sm" variant="ghost" onClick={() => setChangingVote(true)}>Change vote</Button>
        </div>
      )}
      {voteOpen && isVoter && (
        <p className="text-[.72rem] leading-normal text-(--muted)">
          Approve: {claimer.displayName} earns {formatMoney(claim.rewardCents)} and {assigneeName} {formatMoney(penaltyCents)} penalty stands. Reject: no reward, and the miss is excused. A tie approves.
        </p>
      )}
      {claim.status === 'submitted' && !voteOpen && (
        <p className="text-[.72rem] text-(--muted)">The vote has closed. The result posts within a minute.</p>
      )}

      {finishing && (
        <FinishClaimDialog claim={claim} voterNames={voterNames} onClose={() => setFinishing(false)} />
      )}
    </div>
  )
}

function ClaimTally({ claim, voterCount }: { claim: ChoreClaim; voterCount: number }) {
  const rows = [
    { label: 'approve', votes: claim.approveVotes.length, fill: 'bg-(--green)' },
    { label: 'reject', votes: claim.rejectVotes.length, fill: 'bg-(--coral)' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[.75rem] text-(--muted) tabular-nums">
      {rows.map(row => (
        <span key={row.label} className="inline-flex items-center gap-1.5">
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: Math.max(voterCount, row.votes, 1) }, (_, index) => (
              <i key={index} className={cn('size-2 rounded-full', index < row.votes ? row.fill : 'bg-(--line-strong)')} />
            ))}
          </span>
          {row.votes} {row.label}
        </span>
      ))}
    </div>
  )
}
