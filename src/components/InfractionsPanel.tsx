import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ListFilter, Scale } from 'lucide-react'
import { cn } from '../lib/cn'
import { isInfractionReviewOpen } from '../lib/infractions'
import { formatDateTime, formatMoney, timeUntil } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { Infraction, Member } from '../types'
import { Avatar, Badge, Button, SectionHeader } from './ui'

const OPEN_PAGE_SIZE = 4
const HISTORY_PAGE_SIZE = 5
const VOTES_TO_DECIDE = 2

type Tab = 'open' | 'history'
type Outcome = 'all' | 'upheld' | 'paid' | 'excused'

const TABS: { id: Tab; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'history', label: 'History' },
]
const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upheld', label: 'Upheld' },
  { id: 'paid', label: 'Paid' },
  { id: 'excused', label: 'Excused' },
]

const formerMember = {
  displayName: 'Former roommate',
  initials: '?',
  color: '#8a918d',
} as Member

// Same green-on-soft treatment as the danger variant, so Excuse and Uphold read as a pair.
const excuseButtonClasses = 'text-[#28644f]! dark:text-(--green)! bg-(--green-soft)! border-[#bfe0d3]!'

function closesLabel(deadline: string) {
  const when = formatDateTime(deadline)
  return when.startsWith('Today') || when.startsWith('Tomorrow')
    ? when.replace(' · ', ' at ').replace(/^T/, 't')
    : `${timeUntil(deadline)} · ${when}`
}

function closedAt(infraction: Infraction) {
  return infraction.resolvedAt ?? infraction.disputeDeadline
}

// Excused without a deciding vote means the admin stepped in.
function wasForgiven(infraction: Infraction) {
  return infraction.status === 'excused' && infraction.excuseVotes.length < VOTES_TO_DECIDE
}

function outcomeOf(infraction: Infraction): Exclude<Outcome, 'all'> {
  if (infraction.status === 'excused') return 'excused'
  if (infraction.status === 'paid') return 'paid'
  return 'upheld'
}

const outcomeStyles = {
  upheld: { label: 'Upheld', tone: 'red' as const, text: 'text-[#99402f] dark:text-(--coral)' },
  paid: { label: 'Paid', tone: 'neutral' as const, text: 'text-(--muted)' },
  excused: { label: 'Excused', tone: 'green' as const, text: 'text-[#28644f] dark:text-(--green)' },
}

export function InfractionsPanel({ now, onDispute }: { now: number; onDispute: (id: string) => void }) {
  const { data, busy, voteInfraction, forgiveInfraction } = useAppData()
  const currentMemberId = data.household.currentMemberId
  const isAdmin = data.members.some(member => member.id === currentMemberId && member.role === 'owner')
  const sectionRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ open: null, history: null })
  const [tab, setTab] = useState<Tab>('open')
  const [memberFilter, setMemberFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState<Outcome>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [changingVoteId, setChangingVoteId] = useState<string | null>(null)
  const [openPage, setOpenPage] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)
  // The Open tab keeps the order it had when it was opened. Cards that get a vote
  // or close mid-visit stay where they are instead of jumping or vanishing.
  const [openOrder, setOpenOrder] = useState<string[]>([])

  const memberById = (id: string) => data.members.find(member => member.id === id) ?? formerMember
  const canVote = (infraction: Infraction) => infraction.memberId !== currentMemberId
  const voteOf = (infraction: Infraction) =>
    infraction.excuseVotes.includes(currentMemberId) ? 'excuse' as const
      : infraction.upholdVotes.includes(currentMemberId) ? 'uphold' as const : null
  const needsMyVote = (infraction: Infraction) => canVote(infraction) && !voteOf(infraction)

  const openIds = useMemo(
    () => data.infractions.filter(item => isInfractionReviewOpen(item, now)).map(item => item.id),
    [data.infractions, now],
  )
  const sortOpen = (ids: string[]) => ids
    .map(id => data.infractions.find(item => item.id === id)!)
    .sort((a, b) => {
      if (needsMyVote(a) !== needsMyVote(b)) return needsMyVote(a) ? -1 : 1
      return a.disputeDeadline.localeCompare(b.disputeDeadline)
    })
    .map(item => item.id)
  const openDisplayIds = tab === 'open'
    ? [...openOrder, ...sortOpen(openIds.filter(id => !openOrder.includes(id)))]
    : sortOpen(openIds)
  const openItems = openDisplayIds
    .map(id => data.infractions.find(item => item.id === id))
    .filter((item): item is Infraction => Boolean(item))

  const openDisplayKey = openDisplayIds.join(',')
  useEffect(() => {
    if (tab !== 'open') return
    setOpenOrder(current => current.join(',') === openDisplayKey ? current : openDisplayKey.split(',').filter(Boolean))
  }, [openDisplayKey, tab])

  const awaitingMyVote = data.infractions.filter(item => openIds.includes(item.id) && needsMyVote(item)).length

  const closedItems = data.infractions
    .filter(item => !openIds.includes(item.id))
    .sort((a, b) => closedAt(b).localeCompare(closedAt(a)))
  const formerMemberIds = [...new Set(closedItems.map(item => item.memberId))]
    .filter(id => !data.members.some(member => member.id === id))
  const memberItems = closedItems.filter(item => memberFilter === 'all' || item.memberId === memberFilter)
  const historyItems = memberItems.filter(item => outcomeFilter === 'all' || outcomeOf(item) === outcomeFilter)
  const centsFor = (kind: Exclude<Outcome, 'all'>) => memberItems
    .filter(item => outcomeOf(item) === kind)
    .reduce((sum, item) => sum + item.amountCents, 0)
  const countFor = (kind: Outcome) => kind === 'all' ? memberItems.length : memberItems.filter(item => outcomeOf(item) === kind).length

  const openPageCount = Math.max(1, Math.ceil(openItems.length / OPEN_PAGE_SIZE))
  const safeOpenPage = Math.min(openPage, openPageCount - 1)
  const historyPageCount = Math.max(1, Math.ceil(historyItems.length / HISTORY_PAGE_SIZE))
  const safeHistoryPage = Math.min(historyPage, historyPageCount - 1)
  const visibleOpen = openItems.slice(safeOpenPage * OPEN_PAGE_SIZE, (safeOpenPage + 1) * OPEN_PAGE_SIZE)
  const visibleHistory = historyItems.slice(safeHistoryPage * HISTORY_PAGE_SIZE, (safeHistoryPage + 1) * HISTORY_PAGE_SIZE)

  const keepPanelInView = () => {
    const top = sectionRef.current?.getBoundingClientRect().top
    if (top !== undefined && top < 0) sectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const switchTab = (next: Tab, focus = false) => {
    if (focus) tabRefs.current[next]?.focus()
    if (next === tab) return
    setTab(next)
    setOpenOrder(sortOpen(openIds))
    setExpandedId(null)
    setChangingVoteId(null)
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = TABS.findIndex(item => item.id === tab)
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? TABS.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    switchTab(TABS[next].id, true)
  }

  const forgive = (infraction: Infraction) => {
    const name = memberById(infraction.memberId).displayName
    const consequence = infraction.status === 'paid'
      ? 'It was already paid, so the penalty will be reversed and marked excused.'
      : 'It will be marked excused and will not be charged.'
    if (window.confirm(`Forgive ${name}'s ${formatMoney(infraction.amountCents)} infraction for "${infraction.taskTitle}"? ${consequence}`)) {
      void forgiveInfraction(infraction.id).catch(() => {})
    }
  }

  const vote = (infraction: Infraction, choice: 'excuse' | 'uphold') => {
    setChangingVoteId(null)
    void voteInfraction(infraction.id, choice)
  }

  return (
    <section ref={sectionRef} className="min-w-0 scroll-mt-4 rounded-2xl border border-(--line) bg-(--surface-strong) p-4 max-[640px]:p-3 [&_.section-header]:mb-3 [&_.section-header]:min-h-0 [&_.section-header]:border-0">
      <SectionHeader
        eyebrow="PEER REVIEW"
        title="Infractions"
        description={`Roommates have a week to vote. First side to ${VOTES_TO_DECIDE} votes decides.`}
      />

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-(--line) bg-(--surface) p-1" role="tablist" aria-label="Infraction views">
        {TABS.map(item => {
          const selected = tab === item.id
          const count = item.id === 'open' ? openIds.length : closedItems.length
          const alert = item.id === 'open' && awaitingMyVote > 0
          return (
            <button
              key={item.id}
              ref={node => { tabRefs.current[item.id] = node }}
              id={`infractions-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`infractions-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => switchTab(item.id)}
              onKeyDown={onTabKeyDown}
              className={cn(
                'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border-0 bg-transparent text-[.8rem] font-[750] text-(--muted) transition-colors hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--forest)',
                selected && 'bg-(--surface-strong)! text-(--ink)! shadow-[0_0_0_1px_var(--line-strong)]',
              )}
            >
              {item.label}
              <span className={cn(
                'min-w-5.5 rounded-full bg-(--sage-2) px-1.5 py-0.5 text-[.68rem] tabular-nums',
                alert && 'bg-(--gold-soft) text-[#8b6522] dark:text-(--gold)',
              )}>{count}</span>
            </button>
          )
        })}
      </div>

      {tab === 'open' ? (
        <div id="infractions-panel-open" role="tabpanel" aria-labelledby="infractions-tab-open">
          {awaitingMyVote > 0 && (
            <p className="mb-2 px-1 text-[.75rem] font-semibold text-[#8b6522] dark:text-(--gold)">
              {awaitingMyVote} {awaitingMyVote === 1 ? 'review needs' : 'reviews need'} your vote
            </p>
          )}
          {visibleOpen.map(infraction => {
            const member = memberById(infraction.memberId)
            const reviewOpen = openIds.includes(infraction.id)
            const myVote = voteOf(infraction)
            const isMine = infraction.memberId === currentMemberId
            const showVoteButtons = reviewOpen && canVote(infraction) && (!myVote || changingVoteId === infraction.id)
            const result = outcomeStyles[outcomeOf(infraction)]
            return (
              <article className="infraction-card mb-2 grid gap-3 rounded-xl bg-(--surface) px-4 py-3 last:mb-0" key={infraction.id}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                  <div className="grid min-w-0 gap-0.5">
                    <strong className="break-words text-[.92rem] leading-snug">{infraction.taskTitle}</strong>
                    <span className="text-[.78rem] text-(--muted) tabular-nums">{isMine ? 'You' : member.displayName} · {formatMoney(infraction.amountCents)}</span>
                  </div>
                  {!reviewOpen
                    ? <Badge tone={result.tone}>{result.label}</Badge>
                    : infraction.status === 'disputed' && <Badge tone="amber">Disputed</Badge>}
                </div>

                {infraction.disputeReason && (
                  <blockquote className="border-l-2 border-(--line-strong) pl-3 text-[.84rem] leading-normal">“{infraction.disputeReason}”</blockquote>
                )}

                <VoteTally infraction={infraction} />

                {reviewOpen && isMine && infraction.status === 'pending' && (
                  <Button className="bg-(--surface-strong)!" variant="secondary" onClick={() => onDispute(infraction.id)}>Open a dispute</Button>
                )}
                {reviewOpen && isMine && (
                  <p className="text-[.75rem] text-(--muted)">Your roommates decide this one.</p>
                )}
                {showVoteButtons && (
                  <div className="grid grid-cols-2 gap-2 [&>button]:min-h-11">
                    <Button className={excuseButtonClasses} variant="secondary" disabled={busy === `vote:${infraction.id}` || myVote === 'excuse'} onClick={() => vote(infraction, 'excuse')}>Excuse</Button>
                    <Button variant="danger" disabled={busy === `vote:${infraction.id}` || myVote === 'uphold'} onClick={() => vote(infraction, 'uphold')}>Uphold</Button>
                    {myVote && (
                      <button className="col-span-2 justify-self-center border-0 bg-transparent py-1 text-[.78rem] font-bold text-(--muted)" type="button" onClick={() => setChangingVoteId(null)}>
                        Keep my vote to {myVote}
                      </button>
                    )}
                  </div>
                )}
                {reviewOpen && myVote && !showVoteButtons && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-(--surface-strong) px-3 py-1">
                    <span className="text-[.78rem]">You voted to <strong className={myVote === 'excuse' ? outcomeStyles.excused.text : outcomeStyles.upheld.text}>{myVote}</strong></span>
                    <Button className="-mr-2" size="sm" variant="ghost" onClick={() => setChangingVoteId(infraction.id)}>Change vote</Button>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-(--line) pt-2.5">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-[.75rem] text-(--muted) tabular-nums">
                    <Scale className="shrink-0" size={15} />
                    {reviewOpen
                      ? <>Closes {closesLabel(infraction.disputeDeadline)}</>
                      : 'Decided · moves to History'}
                  </span>
                  {isAdmin && infraction.status !== 'excused' && (
                    <Button className="-mr-2 shrink-0" size="sm" variant="ghost" disabled={busy === `forgive:${infraction.id}`} aria-label={`Forgive infraction: ${infraction.taskTitle}`} onClick={() => forgive(infraction)}>
                      Forgive
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
          {!openItems.length && (
            <div className="grid justify-items-center gap-2 rounded-xl bg-(--surface) px-4 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 rounded-[7px] bg-(--green-soft) p-2 text-(--green)" />
              <strong className="text-[.92rem]">Nothing to review</strong>
              <p className="max-w-64 text-[.78rem] text-(--muted)">Missed chores land here for a one-week house vote.</p>
              {closedItems.length > 0 && (
                <button className="mt-1 border-0 bg-transparent py-1 text-[.8rem] font-bold text-(--forest-2)" type="button" onClick={() => switchTab('history')}>
                  View history
                </button>
              )}
            </div>
          )}
          <Pager label="Open infraction pages" page={safeOpenPage} pageCount={openPageCount} onChange={page => { setOpenPage(page); keepPanelInView() }} />
        </div>
      ) : (
        <div id="infractions-panel-history" role="tabpanel" aria-labelledby="infractions-tab-history" className="rounded-xl bg-(--surface) px-4 py-3 max-[640px]:px-3">
          <div className="grid gap-2.5 border-b border-(--line) pb-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <label className="relative inline-flex items-center gap-2 text-[.8rem] font-semibold text-(--muted)">
                <ListFilter size={18} />
                <span className="sr-only">Filter by roommate</span>
                <select
                  className="mt-0! min-h-0 appearance-none border-0 bg-transparent py-1 pr-8! pl-4! text-[.8rem] shadow-none"
                  value={memberFilter}
                  onChange={event => { setMemberFilter(event.target.value); setHistoryPage(0); setExpandedId(null) }}
                >
                  <option value="all">Everyone</option>
                  {data.members.map(member => <option key={member.id} value={member.id}>{member.displayName}</option>)}
                  {formerMemberIds.map(id => <option key={id} value={id}>Former roommate</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5" size={14} />
              </label>
              <span className="text-[.73rem] text-(--muted) tabular-nums">
                {formatMoney(centsFor('upheld'))} unpaid · {formatMoney(centsFor('paid'))} paid
              </span>
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filter by outcome">
              {OUTCOMES.map(option => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={outcomeFilter === option.id}
                  onClick={() => { setOutcomeFilter(option.id); setHistoryPage(0); setExpandedId(null) }}
                  className={cn(
                    'inline-flex min-h-8 flex-1 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-(--line) bg-(--surface-strong) px-2.5 text-xs font-semibold text-(--ink)',
                    outcomeFilter === option.id && 'border-(--forest)! bg-(--forest)! text-white!',
                  )}
                >
                  {option.label}
                  <span className={cn('tabular-nums text-(--muted)', outcomeFilter === option.id && 'text-white/75')}>{countFor(option.id)}</span>
                </button>
              ))}
            </div>
          </div>

          {visibleHistory.map((infraction, index) => {
            const member = memberById(infraction.memberId)
            const previous = visibleHistory[index - 1]
            const monthLabel = format(new Date(closedAt(infraction)), 'MMMM yyyy')
            const showMonth = !previous || format(new Date(closedAt(previous)), 'MMMM yyyy') !== monthLabel
            const result = outcomeStyles[outcomeOf(infraction)]
            const expanded = expandedId === infraction.id
            return (
              <div key={infraction.id} className="infraction-card">
                {showMonth && <p className="pt-3 pb-1 text-[.72rem] font-semibold text-(--muted)">{monthLabel}</p>}
                <div className={cn('border-b border-(--line)', expanded && 'my-1 rounded-lg border-b-0 bg-(--surface-strong) shadow-[0_0_0_1px_var(--line)]')}>
                  <button
                    type="button"
                    className={cn(
                      'grid min-h-15 w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-0 bg-transparent px-1 py-2.5 text-left font-sans text-(--ink) transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--forest) max-[520px]:gap-2',
                      expanded ? 'px-3' : 'hover:bg-(--sage-2)',
                    )}
                    aria-expanded={expanded}
                    aria-controls={`infraction-detail-${infraction.id}`}
                    onClick={() => setExpandedId(expanded ? null : infraction.id)}
                  >
                    <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                    <span className="min-w-0">
                      <strong className={cn('break-words text-[.84rem] leading-snug', expanded ? 'block' : 'line-clamp-2')}>{infraction.taskTitle}</strong>
                      <span className="block truncate text-[.72rem] text-(--muted)">{member.displayName} · Closed {format(new Date(closedAt(infraction)), 'MMM d')}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="grid justify-items-end gap-0.5">
                        <strong className={cn('font-sans text-[.82rem] tabular-nums', infraction.status === 'excused' && 'text-(--muted) line-through decoration-1')}>{formatMoney(infraction.amountCents)}</strong>
                        <span className={cn('text-[.68rem] font-extrabold uppercase tracking-[.035em]', result.text)}>{wasForgiven(infraction) ? 'Forgiven' : result.label}</span>
                      </span>
                      <ChevronDown size={16} className={cn('text-(--muted) transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                    </span>
                  </button>
                  {expanded && (
                    <div id={`infraction-detail-${infraction.id}`} className="grid gap-2.5 px-3 pb-3">
                      {infraction.disputeReason
                        ? <blockquote className="border-l-2 border-(--line-strong) pl-3 text-[.8rem] leading-normal">“{infraction.disputeReason}”</blockquote>
                        : <p className="text-[.75rem] text-(--muted)">No dispute was filed.</p>}
                      {wasForgiven(infraction) && <p className="text-[.75rem] text-(--muted)">Forgiven by the house admin.</p>}
                      <VoteTally infraction={infraction} />
                      <div className="flex items-center justify-between gap-2 border-t border-(--line) pt-2.5">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-[.72rem] text-(--muted) tabular-nums">
                          <Scale className="shrink-0" size={14} /> Closed {formatDateTime(closedAt(infraction))}
                        </span>
                        {isAdmin && infraction.status !== 'excused' && (
                          <Button className="-mr-2 shrink-0" size="sm" variant="ghost" disabled={busy === `forgive:${infraction.id}`} aria-label={`Forgive infraction: ${infraction.taskTitle}`} onClick={() => forgive(infraction)}>
                            Forgive
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {!historyItems.length && (
            <p className="py-8 text-center text-[.8rem] text-(--muted)">
              {!closedItems.length
                ? 'No closed infractions yet.'
                : memberFilter !== 'all' && !memberItems.length
                  ? `${memberById(memberFilter).displayName} has a clean record.`
                  : `No ${outcomeFilter} infractions${memberFilter === 'all' ? '' : ` for ${memberById(memberFilter).displayName}`}.`}
            </p>
          )}
          <Pager label="Infraction history pages" page={safeHistoryPage} pageCount={historyPageCount} onChange={page => { setHistoryPage(page); setExpandedId(null); keepPanelInView() }} />
        </div>
      )}
    </section>
  )
}

function VoteTally({ infraction }: { infraction: Infraction }) {
  const rows = [
    { label: 'excuse', votes: infraction.excuseVotes.length, fill: 'bg-(--green)' },
    { label: 'uphold', votes: infraction.upholdVotes.length, fill: 'bg-(--coral)' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[.75rem] text-(--muted) tabular-nums">
      {rows.map(row => (
        <span key={row.label} className="inline-flex items-center gap-1.5">
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: Math.max(VOTES_TO_DECIDE, row.votes) }, (_, index) => (
              <i key={index} className={cn('size-2 rounded-full', index < row.votes ? row.fill : 'bg-(--line-strong)')} />
            ))}
          </span>
          {row.votes} {row.label}
        </span>
      ))}
    </div>
  )
}

function Pager({ label, page, pageCount, onChange }: { label: string; page: number; pageCount: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null
  return (
    <nav className="mt-3 flex items-center justify-end gap-1 border-t border-(--line) pt-3" aria-label={label}>
      <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft size={16} />
      </Button>
      {pageCount <= 5
        ? Array.from({ length: pageCount }, (_, index) => (
          <Button
            className="min-w-8 px-2"
            size="sm"
            variant={index === page ? 'primary' : 'ghost'}
            onClick={() => onChange(index)}
            aria-current={index === page ? 'page' : undefined}
            aria-label={`Page ${index + 1}`}
            key={index}
          >
            {index + 1}
          </Button>
        ))
        : <span className="px-2 text-[.78rem] font-[750] text-(--muted) tabular-nums">{page + 1} of {pageCount}</span>}
      <Button size="sm" variant="ghost" disabled={page === pageCount - 1} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight size={16} />
      </Button>
    </nav>
  )
}
