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
    <div className="page-stack today-page">
      {data.household.enabledFeatures.includes('notifications') &&
        !data.notificationHealth.subscribed && (
        <Link to="/settings" className="alert-card alert-card-amber">
          <BellRing size={20} />
          <div>
            <strong>Don’t miss the last call</strong>
            <span>Enable reminders on this device for chore and driveway alerts.</span>
          </div>
          <ChevronRight size={20} />
        </Link>
      )}

      <header className="page-hero">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat('en-CA', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(new Date())}
          </p>
          <h1>Good evening, {currentMember.displayName}.</h1>
          <p>Here’s what the house needs from you today.</p>
        </div>
        <div className="member-cluster" aria-label={`${data.members.length} house members`}>
          {data.members.map((member) => (
            <Avatar
              key={member.id}
              initials={member.initials}
              color={member.color}
              size="sm"
            />
          ))}
        </div>
      </header>

      {data.household.enabledFeatures.includes('chores') && <section>
        <SectionHeader
          eyebrow="YOUR TURN"
          title="Today’s chore"
          action={<Link to="/chores">See all chores <ArrowRight size={15} /></Link>}
        />
        {myTask ? (
          <Card className="hero-task">
            <div className="task-art" aria-hidden="true">
              <Sparkles size={32} />
            </div>
            <div className="hero-task-body">
              <div className="card-topline">
                <Badge tone="amber">{myTask.area}</Badge>
                <span className="deadline">
                  <Clock3 size={15} />
                  Due {formatShortTime(myTask.dueAt)}
                </span>
              </div>
              <h2>{myTask.taskTitle}</h2>
              <p>{myTask.reminderLabel}</p>
              <div className="task-actions">
                <Button
                  size="lg"
                  disabled={busy === `complete:${myTask.id}`}
                  onClick={() => completeOccurrence(myTask.id)}
                >
                  <Check size={19} />
                  {busy === `complete:${myTask.id}` ? 'Saving…' : 'Mark complete'}
                </Button>
                <span>Checked by the server before midnight</span>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="all-clear">
            <div className="success-orb"><Check /></div>
            <div>
              <h2>You’re all clear.</h2>
              <p>No unfinished chores assigned to you today.</p>
            </div>
          </Card>
        )}
      </section>}

      <div className="dashboard-grid">
        {(data.household.enabledFeatures.includes('calendar') ||
          data.household.enabledFeatures.includes('courses')) && <section>
          <SectionHeader
            eyebrow="UP NEXT"
            title="Around the house"
            action={<Link to="/calendar">Calendar <ArrowRight size={15} /></Link>}
          />
          <Card className="timeline-card">
            {data.events.slice(0, 3).map((event, index) => (
              <div className="timeline-item" key={event.id}>
                <div className="timeline-time">
                  <strong>{formatShortTime(event.startAt)}</strong>
                  <span>{index === 0 ? 'Today' : formatDateTime(event.startAt).split(' · ')[0]}</span>
                </div>
                <span
                  className={`timeline-dot timeline-dot-${event.kind}`}
                  aria-hidden="true"
                />
                <div className="timeline-detail">
                  <strong>{event.title}</strong>
                  <span>{event.location ?? 'Household event'}</span>
                </div>
              </div>
            ))}
          </Card>
        </section>}

        {data.household.enabledFeatures.includes('money') && <section>
          <SectionHeader eyebrow="QUICK LOOK" title="Shared money" />
          <Card className="balance-card">
            <div className="balance-icon">
              <CircleDollarSign />
            </div>
            <p>Your house balance</p>
            <strong className={myBalance.netCents >= 0 ? 'money-positive' : 'money-negative'}>
              {formatMoney(myBalance.netCents, true)}
            </strong>
            <span>
              {myBalance.netCents >= 0
                ? 'The house owes you'
                : 'You owe the house'}
            </span>
            {myBalance.fundOwedCents > 0 && (
              <div className="fund-warning">
                Household fund due: {formatMoney(myBalance.fundOwedCents)}
              </div>
            )}
            <Link to="/money" className="card-link">
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
            action={<Link to="/driveway">Manage lineup <ArrowRight size={15} /></Link>}
          />
          <Card className="departure-strip">
            <div className="departure-icon"><CarFront /></div>
            <div className="departure-main">
              <div>
                <strong>{targetVehicle.label} needs out</strong>
                <span>{nextDeparture.sourceLabel} · {formatDateTime(nextDeparture.requiredAt)}</span>
              </div>
              <Badge tone="blue">{timeUntil(nextDeparture.requiredAt)}</Badge>
            </div>
            <div className="blocker-summary">
              <span>{blockers?.length ?? 0} blocking car{blockers?.length === 1 ? '' : 's'}</span>
              <div className="mini-cars">
                {blockers?.map((vehicle) => (
                  <span key={vehicle!.id} style={{ background: vehicle!.color }} />
                ))}
              </div>
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
