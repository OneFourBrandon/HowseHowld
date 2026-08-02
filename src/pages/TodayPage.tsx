import { cn } from '../lib/cn'
import {
  ArrowRight,
  BellRing,
  CarFront,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppData } from '../state/AppDataContext'
import { Avatar, Badge, Button, Card, SectionHeader } from '../components/ui'
import {
  formatDateTime,
  formatMoney,
  formatShortTime,
  timeUntil,
} from '../lib/utils'

export function TodayPage() {
  const { data, busy, completeOccurrence } = useAppData()
  const currentMember = data.members.find(
    (member) => member.id === data.household.currentMemberId,
  )!
  const myTask = data.occurrences.find(
    (item) =>
      item.assigneeId === currentMember.id &&
      item.status === 'assigned' &&
      new Date(item.dueAt).toDateString() === new Date().toDateString(),
  )
  const myBalance = data.balances.find(
    (balance) => balance.memberId === currentMember.id,
  )!
  const nextDeparture = [...data.departures].sort(
    (a, b) =>
      new Date(a.requiredAt).getTime() - new Date(b.requiredAt).getTime(),
  )[0]
  const targetVehicle = data.vehicles.find(
    (vehicle) => vehicle.id === nextDeparture?.vehicleId,
  )
  const blockers = nextDeparture?.blockerVehicleIds
    .map((id) => data.vehicles.find((vehicle) => vehicle.id === id))
    .filter(Boolean)

  return (
    <div className={"page-stack grid gap-14.5 max-[980px]:gap-13 max-[640px]:gap-11.5 today-page"}>
      {data.household.enabledFeatures.includes('notifications') &&
        !data.notificationHealth.subscribed && (
        <Link to="/settings" className="alert-card alert-card-amber grid grid-cols-[auto_1fr_auto] items-center gap-3.25 rounded-none border border-[#e3d0a1] border-l-[3px] border-l-(--gold) bg-[#f1e5c8] p-[16px_19px] text-[#76561d] text-[.84rem]">
          <BellRing size={20} />
          <div className="grid gap-0.5">
            <strong>Don’t miss the last call</strong>
            <span className="text-[#756a52]">Enable reminders on this device for chore and driveway alerts.</span>
          </div>
          <ChevronRight size={20} />
        </Link>
      )}

      <header className="page-hero flex items-end justify-between gap-10 border-b border-b-(--line-strong) pb-7.5 max-[640px]:items-start max-[640px]:gap-5.5 max-[640px]:pb-4.5">
        <div className="grid gap-3.75">
          <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>
            {new Intl.DateTimeFormat('en-CA', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(new Date())}
          </p>
          <h1 className="max-[640px]:text-[clamp(2.55rem,13vw,3.35rem)]">Good evening, {currentMember.displayName}.</h1>
          <p>Here’s what the house needs from you today.</p>
        </div>
        <div className="member-cluster flex max-[640px]:hidden" aria-label={`${data.members.length} house members`}>
          {data.members.map((member) => (
            <Avatar
              key={member.id}
              initials={member.initials}
              color={member.color}
              imageUrl={member.avatarUrl}
              size="sm"
              className="-ml-1.25 first:ml-0"
            />
          ))}
        </div>
      </header>

      {data.household.enabledFeatures.includes('chores') && <section>
        <SectionHeader
          eyebrow="YOUR TURN"
          title="Today’s chore"
          action={<Link className="inline-flex items-center gap-1.5 text-[.82rem] font-bold text-(--forest-2)" to="/chores">See all chores <ArrowRight size={15} /></Link>}
        />
        {myTask ? (
          <Card className={"hero-task grid overflow-visible border-t border-t-(--line) border-b border-b-(--line) grid-cols-[140px_1fr] max-[640px]:grid-cols-[82px_1fr]"}>
            <div className="task-art grid min-h-60 place-items-center bg-(--gold) text-white max-[640px]:min-h-62.5" aria-hidden="true">
              <Sparkles className="h-13.75 w-13.75 opacity-[.88]" />
            </div>
            <div className="hero-task-body grid content-center gap-3.5 p-[32px_38px] max-[640px]:p-[24px_0_24px_22px]">
              <div className={"card-topline flex justify-between items-center"}>
                <Badge tone="amber">{myTask.area}</Badge>
                <span className={"deadline inline-flex items-center gap-1.5 text-(--coral) font-[750] text-[.78rem] font-sans tabular-nums"}>
                  <Clock3 size={15} />
                  Due {formatShortTime(myTask.dueAt)}
                </span>
              </div>
              <h2 className="text-[clamp(2rem,2.8vw,2.6rem)] max-[640px]:text-[1.85rem]">{myTask.taskTitle}</h2>
              <p>{myTask.reminderLabel}</p>
              <div className="task-actions mt-3 flex items-center gap-3.5 max-[640px]:flex-col max-[640px]:items-stretch">
                <Button
                  className="max-[640px]:w-full"
                  size="lg"
                  disabled={busy === `complete:${myTask.id}`}
                  onClick={() => completeOccurrence(myTask.id)}
                >
                  <Check size={19} />
                  {busy === `complete:${myTask.id}` ? 'Saving…' : 'Mark complete'}
                </Button>
                <span className="text-[.78rem] text-[#84908a]">Checked by the server before midnight</span>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="all-clear flex items-center gap-4 border-y border-(--line) py-7">
            <div className={"success-orb w-12.5 h-12.5 grid place-items-center rounded-full text-white bg-(--green)"}><Check /></div>
            <div>
              <h2>You’re all clear.</h2>
              <p>No unfinished chores assigned to you today.</p>
            </div>
          </Card>
        )}
      </section>}

      <div className="dashboard-grid grid grid-cols-[minmax(0,1.45fr)_minmax(280px,.75fr)] gap-11 has-[>section:only-child]:grid-cols-1 max-[980px]:grid-cols-1 max-[980px]:gap-12.5">
        {(data.household.enabledFeatures.includes('calendar') ||
          data.household.enabledFeatures.includes('courses')) && <section>
          <SectionHeader
            eyebrow="UP NEXT"
            title="Around the house"
            action={<Link className="inline-flex items-center gap-1.5 text-[.82rem] font-bold text-(--forest-2)" to="/calendar">Calendar <ArrowRight size={15} /></Link>}
          />
          <Card className={"timeline-card p-0"}>
            {data.events.slice(0, 3).map((event, index) => (
              <div className="timeline-item grid min-h-22.5 grid-cols-[72px_14px_1fr] items-center gap-3 border-t border-(--line) px-1 first:border-t-0" key={event.id}>
                <div className="timeline-time font-sans tabular-nums">
                  <strong className="block text-[.86rem]">{formatShortTime(event.startAt)}</strong>
                  <span>{index === 0 ? 'Today' : formatDateTime(event.startAt).split(' · ')[0]}</span>
                </div>
                <span
                  className={cn(
                    'timeline-dot w-2.25 h-2.25 rounded-full bg-(--green)',
                    event.kind === 'class' && 'timeline-dot-class bg-(--blue)!',
                    event.kind === 'exam' && 'timeline-dot-exam bg-(--coral)!',
                  )}
                  aria-hidden="true"
                />
                <div className="timeline-detail">
                  <strong className="block text-[.86rem]">{event.title}</strong>
                  <span className="mt-0.75 block text-[.76rem] leading-[1.4] text-(--muted)">{event.location ?? 'Household event'}</span>
                </div>
              </div>
            ))}
          </Card>
        </section>}

        {data.household.enabledFeatures.includes('money') && <section>
          <SectionHeader eyebrow="QUICK LOOK" title="Shared money" />
          <Card className="balance-card grid min-h-63 content-center border-l-[3px] border-l-(--green) py-7.5 pl-7">
            <div className={"balance-icon w-10.5 h-10.5 grid place-items-center text-(--forest) bg-(--sage) rounded-lg"}>
              <CircleDollarSign />
            </div>
            <p className="mt-4.5 text-[.78rem] text-(--muted)">Your house balance</p>
            <strong className={cn('mt-0.75 font-display text-[2.35rem] font-[720]', myBalance.netCents >= 0 ? 'money-positive text-(--green)!' : 'money-negative text-(--coral)!')}>
              {formatMoney(myBalance.netCents, true)}
            </strong>
            <span className="text-[.78rem] text-(--muted)">
              {myBalance.netCents >= 0
                ? 'The house owes you'
                : 'You owe the house'}
            </span>
            {myBalance.fundOwedCents > 0 && (
              <div className={"fund-warning mt-2.5 p-[8px_10px] rounded-lg text-[#99402f] bg-(--coral-soft) text-[.78rem]"}>
                Household fund due: {formatMoney(myBalance.fundOwedCents)}
              </div>
            )}
            <Link to="/money" className={"card-link inline-flex items-center gap-1.5 text-(--forest) font-[750] mt-4.5 text-[.78rem]"}>
              Open shared money <ArrowRight size={16} />
            </Link>
          </Card>
        </section>}
      </div>

      {data.household.enabledFeatures.includes('driveway') &&
        nextDeparture && targetVehicle && (
        <section>
          <SectionHeader
            eyebrow="DRIVEWAY"
            title="Next departure"
            action={<Link className="inline-flex items-center gap-1.5 text-[.82rem] font-bold text-(--forest-2)" to="/driveway">Manage lineup <ArrowRight size={15} /></Link>}
          />
          <Card className={"departure-strip grid grid-cols-[auto_1fr_auto] items-center gap-3.75 max-[640px]:grid-cols-[auto_1fr] p-[20px_0] border-b border-b-(--line) py-6"}>
            <div className={"departure-icon w-11.5 h-11.5 grid place-items-center rounded-[13px] text-(--blue) bg-(--blue-soft)"}><CarFront /></div>
            <div className="departure-main flex items-center gap-3.25">
              <div className="grid gap-1">
                <strong className="text-[.94rem]">{targetVehicle.label} needs out</strong>
                <span>{nextDeparture.sourceLabel} · {formatDateTime(nextDeparture.requiredAt)}</span>
              </div>
              <Badge tone="blue">{timeUntil(nextDeparture.requiredAt)}</Badge>
            </div>
            <div className={"blocker-summary flex items-center gap-2.5 text-(--muted) max-[640px]:col-[2] text-[.78rem]"}>
              <span>{blockers?.length ?? 0} blocking car{blockers?.length === 1 ? '' : 's'}</span>
              <div className="mini-cars flex">
                {blockers?.map((vehicle) => (
                  <span className="-ml-1 h-2.5 w-4.5 rounded border-2 border-(--surface) first:ml-0" key={vehicle!.id} style={{ background: vehicle!.color }} />
                ))}
              </div>
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
