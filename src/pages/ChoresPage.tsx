import { cn } from '../lib/cn'
import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pause,
  Pencil,
  Plus,
  RotateCw,
  Scale,
} from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { Avatar, Badge, Button, Card, Modal, SectionHeader } from '../components/ui'
import { ChoreOccurrenceIcon } from '../components/ChoreOccurrenceIcon'
import {
  formatDateTime,
  formatMoney,
  nextOpenOccurrencePerTask,
  taskCompletionAvailability,
} from '../lib/utils'

const taskSchema = z.object({
  title: z.string().trim().min(2, 'Give the chore a name.'),
  area: z.string().trim().min(2, 'Choose an area.'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'once', 'rolling_queue']),
  interval: z.number().int().min(1).max(30),
  startsOn: z.string().min(1),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/),
  assignmentMode: z.enum(['rotation', 'fixed', 'manual', 'one_off']),
  penaltyEnabled: z.boolean(),
})
type TaskForm = z.infer<typeof taskSchema>
const UPCOMING_PAGE_SIZE = 5

export function ChoresPage() {
  const {
    data,
    busy,
    completeOccurrence,
    addTask,
    updateTask,
    assignManualTask,
    disputeInfraction,
    voteInfraction,
  } = useAppData()
  const [taskModal, setTaskModal] = useState(false)
  const [disputeId, setDisputeId] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([1])
  const [rotationIds, setRotationIds] = useState(
    () => data.members.filter((member) => member.active).map((member) => member.id),
  )
  const [fixedMemberId, setFixedMemberId] = useState(data.members[0]?.id ?? '')
  const [reminderTimes, setReminderTimes] = useState(['09:00', '18:00', '22:00', '23:30'])
  const [assignTaskId, setAssignTaskId] = useState('')
  const [assignMemberId, setAssignMemberId] = useState(data.members[0]?.id ?? '')
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10))
  const [upcomingPageIndex, setUpcomingPageIndex] = useState(0)
  const currentMemberId = data.household.currentMemberId
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      area: '',
      frequency: 'weekly',
      interval: 1,
      startsOn: new Date().toISOString().slice(0, 10),
      dueTime: '23:59',
      assignmentMode: 'rotation',
      penaltyEnabled: true,
    },
  })
  const assignmentMode = watch('assignmentMode')
  const frequency = watch('frequency')

  useEffect(() => {
    if (frequency === 'rolling_queue' && assignmentMode !== 'rotation') {
      setValue('assignmentMode', 'rotation')
    }
  }, [assignmentMode, frequency, setValue])

  const upcoming = useMemo(
    () => nextOpenOccurrencePerTask(data.occurrences),
    [data.occurrences],
  )
  const upcomingPageCount = Math.max(1, Math.ceil(upcoming.length / UPCOMING_PAGE_SIZE))
  const safeUpcomingPageIndex = Math.min(upcomingPageIndex, upcomingPageCount - 1)
  const visibleUpcoming = upcoming.slice(
    safeUpcomingPageIndex * UPCOMING_PAGE_SIZE,
    (safeUpcomingPageIndex + 1) * UPCOMING_PAGE_SIZE,
  )

  useEffect(() => {
    if (upcomingPageIndex !== safeUpcomingPageIndex) {
      setUpcomingPageIndex(safeUpcomingPageIndex)
    }
  }, [safeUpcomingPageIndex, upcomingPageIndex])

  const submitTask = handleSubmit(async (values) => {
    const rollingQueue = values.frequency === 'rolling_queue'
    const recurrence = {
      frequency: values.assignmentMode === 'one_off' ? 'once' as const : values.frequency,
      interval: rollingQueue ? 1 : values.interval,
      weekdays: values.frequency === 'weekly' ? weekdays : undefined,
    }
    await addTask({
      title: values.title,
      area: values.area,
      assignmentMode: values.assignmentMode,
      fixedMemberId: values.assignmentMode !== 'rotation' ? fixedMemberId : undefined,
      recurrence,
      recurrenceLabel: recurrenceSummary(recurrence),
      startsOn: values.startsOn,
      dueTime: values.dueTime,
      reminderTimes,
      penaltyEnabled: values.penaltyEnabled,
      description: '',
      rotationMemberIds:
        values.assignmentMode === 'rotation'
          ? rotationIds
          : [fixedMemberId],
    })
    reset()
    setTaskModal(false)
  })
  const completedThisMonth = data.occurrences.filter((occurrence) => {
    if (occurrence.status !== 'completed' || !occurrence.completedAt) return false
    const completed = new Date(occurrence.completedAt)
    const now = new Date()
    return completed.getMonth() === now.getMonth() && completed.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className={"page-stack grid gap-10 max-[980px]:gap-13 max-[640px]:gap-11.5"}>
      <header className="page-header flex items-end justify-between gap-4 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-4 max-[640px]:pb-4.5">
        <div className="grid gap-3.75">
          <h1 className="text-[clamp(3.15rem,4.5vw,4.8rem)] max-[640px]:text-[clamp(2.55rem,13vw,3.35rem)]">Chores</h1>
          <p className="pl-2">Do your chores... or else.</p>
        </div>
        <Button className="max-[640px]:w-full" onClick={() => setTaskModal(true)}>
          <Plus size={18} /> New chore
        </Button>
      </header>

      <div className={"stats-row grid grid-cols-3 gap-0 border-t border-t-(--line) border-b border-b-(--line)"}>
        <Card className="stat-card flex min-h-28 items-center gap-3.25 border-l border-(--line) p-[23px_28px] first:border-l-0 max-[640px]:min-h-20 max-[640px]:gap-1.5 max-[640px]:px-2 max-[640px]:py-3">
          <CheckCircle2 className="h-10 w-10 shrink-0 rounded-[7px] bg-(--green-soft) p-2 text-(--green) max-[640px]:h-8 max-[640px]:w-8 max-[640px]:p-1.5" />
          <div className="min-w-0"><strong className="block font-display text-[1.65rem] max-[640px]:text-[1.3rem]">{completedThisMonth}</strong><span className="block text-[.76rem] text-(--muted) max-[640px]:text-[.65rem] max-[640px]:leading-tight">Completed this month</span></div>
        </Card>
        <Card className="stat-card flex min-h-28 items-center gap-3.25 border-l border-(--line) p-[23px_28px] first:border-l-0 max-[640px]:min-h-20 max-[640px]:gap-1.5 max-[640px]:px-2 max-[640px]:py-3">
          <RotateCw className="h-10 w-10 shrink-0 rounded-[7px] bg-(--green-soft) p-2 text-(--green) max-[640px]:h-8 max-[640px]:w-8 max-[640px]:p-1.5" />
          <div className="min-w-0"><strong className="block font-display text-[1.65rem] max-[640px]:text-[1.3rem]">{data.tasks.filter((task) => task.active).length}</strong><span className="block text-[.76rem] text-(--muted) max-[640px]:text-[.65rem] max-[640px]:leading-tight">Active rotations</span></div>
        </Card>
        <Card className="stat-card flex min-h-28 items-center gap-3.25 border-l border-(--line) p-[23px_28px] first:border-l-0 max-[640px]:min-h-20 max-[640px]:gap-1.5 max-[640px]:px-2 max-[640px]:py-3">
          <AlertTriangle className="h-10 w-10 shrink-0 rounded-[7px] bg-(--green-soft) p-2 text-(--green) max-[640px]:h-8 max-[640px]:w-8 max-[640px]:p-1.5" />
          <div className="min-w-0"><strong className="block font-display text-[1.65rem] max-[640px]:text-[1.3rem]">{data.infractions.filter((item) => item.status !== 'excused' && item.status !== 'paid').length}</strong><span className="block text-[.76rem] text-(--muted) max-[640px]:text-[.65rem] max-[640px]:leading-tight">Open infractions</span></div>
        </Card>
      </div>

      <section>
        <SectionHeader
          eyebrow="ASSIGNMENTS"
          title="Coming up"
          description="Server-confirmed deadlines in Toronto time."
        />
        <div className={"occurrence-list grid gap-0"}>
          {visibleUpcoming.map((occurrence) => {
            const member = data.members.find((item) => item.id === occurrence.assigneeId)!
            const isMine = member.id === currentMemberId
            const completionAvailability = taskCompletionAvailability(
              occurrence.scheduledDate,
              occurrence.dueAt,
              data.household.timezone,
            )
            return (
              <Card key={occurrence.id} className="occurrence-card grid min-h-25.5 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3.25 border-b border-b-(--line) px-1 py-5 max-[640px]:grid-cols-[auto_1fr_auto] max-[640px]:px-0">
                <ChoreOccurrenceIcon status={occurrence.status} />
                <div className="occurrence-detail grid gap-1.25">
                  <div className="flex gap-1.25">
                    <Badge>{occurrence.area}</Badge>
                    {isMine && occurrence.status === 'assigned' && (
                      <span className="max-[640px]:hidden"><Badge tone="amber">Your turn</Badge></span>
                    )}
                  </div>
                  <h3 className="text-[.94rem]">{occurrence.taskTitle}</h3>
                  <span>{formatDateTime(occurrence.dueAt)} · {occurrence.reminderLabel}</span>
                </div>
                <div className={"occurrence-person flex items-center gap-1.75 text-(--muted) max-[640px]:col-[2] text-[.76rem]"}>
                  <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                  <span>{member.displayName}</span>
                  {isMine && occurrence.status === 'assigned' && (
                    <span className="hidden whitespace-nowrap rounded-full bg-(--gold-soft) px-2 py-1 text-[.62rem] font-extrabold uppercase tracking-[.035em] text-[#8b6522] max-[640px]:inline-flex">
                      Your turn
                    </span>
                  )}
                </div>
                {isMine && occurrence.status === 'assigned' && (
                  <Button
                    className="max-[640px]:col-[3] max-[640px]:row-[1/span_2]"
                    variant="secondary"
                    disabled={
                      busy === `complete:${occurrence.id}` ||
                      completionAvailability !== 'available'
                    }
                    title={
                      completionAvailability === 'early'
                        ? `Available on ${occurrence.scheduledDate}`
                        : completionAvailability === 'expired'
                          ? 'This task has expired'
                          : 'Mark this task complete'
                    }
                    onClick={() => completeOccurrence(occurrence.id)}
                  >
                    <Check size={17} />
                    {completionAvailability === 'early'
                      ? 'Not yet'
                      : completionAvailability === 'expired'
                        ? 'Expired'
                        : 'Done'}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
        {upcomingPageCount > 1 && (
          <nav className="mt-4 flex items-center justify-end gap-1 border-t border-(--line) pt-4" aria-label="Coming up pages">
            <Button
              size="sm"
              variant="ghost"
              disabled={safeUpcomingPageIndex === 0}
              onClick={() => setUpcomingPageIndex((page) => Math.max(0, page - 1))}
              aria-label="Previous assignments page"
            >
              <ChevronLeft size={16} />
            </Button>
            {Array.from({ length: upcomingPageCount }, (_, page) => (
              <Button
                className="min-w-8 px-2"
                size="sm"
                variant={page === safeUpcomingPageIndex ? 'primary' : 'ghost'}
                onClick={() => setUpcomingPageIndex(page)}
                aria-current={page === safeUpcomingPageIndex ? 'page' : undefined}
                aria-label={`Assignments page ${page + 1}`}
                key={page}
              >
                {page + 1}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              disabled={safeUpcomingPageIndex === upcomingPageCount - 1}
              onClick={() => setUpcomingPageIndex((page) => Math.min(upcomingPageCount - 1, page + 1))}
              aria-label="Next assignments page"
            >
              <ChevronRight size={16} />
            </Button>
          </nav>
        )}
      </section>

      <div className={"content-grid-two grid grid-cols-[minmax(0,1.12fr)_minmax(300px,.88fr)] gap-6.25 items-start max-[980px]:grid-cols-1 max-[980px]:gap-12.5"}>
        <section>
          <SectionHeader eyebrow="ROTATIONS" title="House routines" />
          <Card className={"routine-list p-0"}>
            {data.tasks.map((task) => {
              const next = data.members.find((member) => member.id === task.nextMemberId)
              return (
                <div className="routine-row grid min-h-34 grid-cols-[64px_minmax(0,1fr)_minmax(280px,1fr)] items-center gap-4 border-t border-(--line) px-1 py-4 first:border-t-0 max-[700px]:grid-cols-[52px_minmax(0,1fr)] max-[700px]:gap-x-3" key={task.id}>
                  <div className="routine-frequency flex h-full min-h-24 flex-col items-center justify-center gap-2 border-l-[3px] border-(--forest) text-(--forest)">
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-(--line) bg-(--sage-2)" aria-hidden="true"><RotateCw size={18} /></span>
                    <span className="text-[.62rem] font-extrabold uppercase tracking-[.08em]">{routineFrequencyLabel(task.recurrence.frequency)}</span>
                  </div>
                  <div className="min-w-0 max-[700px]:self-center">
                    <strong className="block text-[.94rem] leading-snug">{task.title}</strong>
                    <span className="mt-1 block text-[.78rem] text-(--muted)">{task.area}</span>
                    <span className="mt-1.5 block text-[.8rem] font-semibold text-(--forest-2)">{task.recurrenceLabel}</span>
                  </div>
                  <div className="routine-right grid min-w-0 grid-cols-1 gap-y-3 border-l border-(--line) pl-4 max-[700px]:col-start-2 max-[700px]:mt-2 max-[700px]:border-l-0 max-[700px]:border-t max-[700px]:pl-0 max-[700px]:pt-3">
                    <div className="flex min-h-10 min-w-0 items-center justify-between gap-4">
                      <div className="routine-assignee flex min-w-0 items-center gap-2">
                        {next && <Avatar initials={next.initials} color={next.color} imageUrl={next.avatarUrl} size="sm" />}
                        <span className="text-[.78rem]"><span className="block text-[.68rem] font-bold uppercase tracking-[.06em] text-(--muted)">Next up</span>{next?.displayName ?? 'Manual assignment'}</span>
                      </div>
                      <div className="inline-flex min-h-10 items-center justify-self-start gap-2 self-center text-[.8rem] font-bold text-(--forest-2) tabular-nums">
                        <Clock3 size={16} /> {formatRoutineDueTime(task.dueTime)}
                      </div>
                    </div>
                    <div className="flex flex-nowrap items-center justify-start gap-x-1 border-t border-(--line) pt-1.5">
                      {task.assignmentMode === 'manual' && (
                        <Button size="sm" variant="ghost" onClick={() => setAssignTaskId(task.id)}>Assign</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => updateTask(task.id, { active: !task.active })}>
                        {task.active ? <Pause size={15} /> : <RotateCw size={15} />}
                        {task.active ? 'Pause' : 'Resume'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        const title = window.prompt('Rename this chore', task.title)
                        if (title?.trim()) updateTask(task.id, { title: title.trim() })
                      }}>
                        <Pencil size={15} /> Edit
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </Card>
        </section>

        <section>
          <SectionHeader eyebrow="PEER REVIEW" title="Infractions" />
          {data.infractions.map((infraction) => {
            const member = data.members.find((item) => item.id === infraction.memberId)!
            const hasVoted =
              infraction.upholdVotes.includes(currentMemberId) ||
              infraction.excuseVotes.includes(currentMemberId)
            return (
              <Card className="infraction-card grid gap-3.25 border-b border-b-(--line) px-7 py-6.25" key={infraction.id}>
                <div className="infraction-heading grid grid-cols-[auto_1fr_auto] items-center gap-2.25">
                  <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                  <div>
                    <strong>{member.displayName} · {infraction.taskTitle}</strong>
                    <span>{formatMoney(infraction.amountCents)} pending</span>
                  </div>
                  <Badge tone={infraction.status === 'excused' ? 'green' : 'red'}>
                    {infraction.status}
                  </Badge>
                </div>
                {infraction.disputeReason && (
                  <blockquote>“{infraction.disputeReason}”</blockquote>
                )}
                <div className={"vote-meter flex justify-between text-(--muted) text-[.75rem]"}>
                  <span>{infraction.excuseVotes.length} excuse</span>
                  <span>{infraction.upholdVotes.length} uphold</span>
                </div>
                {infraction.memberId === currentMemberId &&
                  infraction.status === 'pending' && (
                    <Button variant="secondary" onClick={() => setDisputeId(infraction.id)}>
                      Open a dispute
                    </Button>
                  )}
                {infraction.memberId !== currentMemberId &&
                  infraction.status === 'disputed' &&
                  !hasVoted && (
                    <div className={"button-row flex items-center gap-2.25 flex-wrap"}>
                      <Button
                        variant="secondary"
                        onClick={() => voteInfraction(infraction.id, 'excuse')}
                      >
                        Excuse
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => voteInfraction(infraction.id, 'uphold')}
                      >
                        Uphold
                      </Button>
                    </div>
                  )}
                <div className={"deadline-note flex items-center gap-1.5 text-(--muted) text-[.75rem] font-sans tabular-nums"}>
                  <Scale size={15} />
                  Review closes {formatDateTime(infraction.disputeDeadline)}
                </div>
              </Card>
            )
          })}
        </section>
      </div>

      <Modal
        open={taskModal}
        onClose={() => setTaskModal(false)}
        title="Create a chore"
        description="Set the routine once. The server handles every turn."
      >
        <form className={"form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"} onSubmit={submitTask}>
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Chore name
            <input {...register('title')} placeholder="Clean the bathroom" />
            {errors.title && <span className={"form-error mt-1.25 text-(--coral) text-[.75rem]"}>{errors.title.message}</span>}
          </label>
          <label>Area
            <input {...register('area')} placeholder="e.g. Bathroom" />
            {errors.area && <span className="form-error mt-1.25 text-[.75rem] text-(--coral)">{errors.area.message}</span>}
          </label>
          <label>Assignment
            <select {...register('assignmentMode')} disabled={frequency === 'rolling_queue'}>
              <option value="rotation">Fair rotation</option>
              <option value="fixed">Fixed roommate</option>
              <option value="manual">Assign manually</option>
              <option value="one_off">One-time task</option>
            </select>
          </label>
          <label>Repeats
            <select {...register('frequency')}>
              <option value="daily">Daily</option>
              <option value="weekly">Selected weekdays</option>
              <option value="monthly">Monthly</option>
              <option value="once">Once</option>
              <option value="rolling_queue">Rolling queue · one per day</option>
            </select>
          </label>
          {frequency === 'rolling_queue' ? (
            <p className="self-end rounded-lg border border-(--line) bg-(--sage-2) p-3 text-[.74rem] leading-normal text-(--muted)">
              This chore joins the household queue. One queued chore is selected each day, with assignees advancing through the selected rotation.
            </p>
          ) : (
            <label>Every
              <div className="input-with-suffix grid grid-cols-[minmax(70px,1fr)_auto] items-center gap-2.5">
                <input type="number" min="1" max="30" {...register('interval', { valueAsNumber: true })} />
                <span>{frequency === 'daily' ? 'days' : frequency === 'weekly' ? 'weeks' : frequency === 'monthly' ? 'months' : 'time'}</span>
              </div>
            </label>
          )}
          {frequency === 'weekly' && (
            <fieldset className={"field-span-2 col-span-full max-[640px]:col-[1] compact-options py-[8px_14px] border-0 border-b border-b-(--line)"}>
              <legend>Weekdays</legend>
              <div className="weekday-picker grid grid-cols-7 gap-2 max-[560px]:gap-1">
                {[
                  { label: 'Su', day: 7 },
                  { label: 'M', day: 1 },
                  { label: 'T', day: 2 },
                  { label: 'W', day: 3 },
                  { label: 'Th', day: 4 },
                  { label: 'F', day: 5 },
                  { label: 'Sa', day: 6 },
                ].map(({ label, day }) => {
                  return (
                    <button
                      type="button"
                      key={`${label}-${day}`}
                      aria-pressed={weekdays.includes(day)}
                      className={cn(
                        'min-h-10 rounded-full border border-(--line) bg-transparent font-[inherit] font-bold text-(--muted) transition-[background-color,color,border-color,box-shadow] duration-150 hover:border-(--forest-2) hover:bg-(--sage-2) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--forest)',
                        weekdays.includes(day) && 'is-selected border-(--forest)! bg-(--forest)! text-white! shadow-[0_5px_14px_rgba(43,75,31,.18)] hover:border-(--forest)! hover:bg-(--forest-2)!',
                      )}
                      onClick={() => setWeekdays((current) =>
                        current.includes(day)
                          ? current.filter((item) => item !== day)
                          : [...current, day].sort(),
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}
          <label>Starts on
            <input type="date" {...register('startsOn')} />
          </label>
          <label>Due time
            <input type="time" {...register('dueTime')} />
          </label>
          {assignmentMode !== 'rotation' && (
            <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Assigned roommate
              <select value={fixedMemberId} onChange={(event) => setFixedMemberId(event.target.value)}>
                {data.members.filter((member) => member.active).map((member) => (
                  <option key={member.id} value={member.id}>{member.displayName}</option>
                ))}
              </select>
            </label>
          )}
          {assignmentMode === 'rotation' && (
            <fieldset className={"field-span-2 col-span-full max-[640px]:col-[1] compact-options py-[8px_14px] border-0 border-b border-b-(--line)"}>
              <legend>Rotation order and eligibility</legend>
              <div className={"member-check-grid grid grid-cols-2 gap-2 max-[640px]:grid-cols-1"}>
                {data.members.filter((member) => member.active).map((member) => (
                  <label className="member-check flex items-center gap-1.75 rounded-[10px] border border-(--line) bg-white p-2.25" key={member.id}>
                    <input
                      type="checkbox"
                      checked={rotationIds.includes(member.id)}
                      onChange={(event) => setRotationIds((current) =>
                        event.target.checked
                          ? [...current, member.id]
                          : current.filter((id) => id !== member.id),
                      )}
                    />
                    <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                    {member.displayName}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className={"field-span-2 col-span-full max-[640px]:col-[1] compact-options py-[8px_14px] border-0 border-b border-b-(--line)"}>
            <legend>Task reminders</legend>
            <div className={"member-check-grid grid grid-cols-2 gap-2 max-[640px]:grid-cols-1"}>
              {[
                ['09:00', 'Morning'],
                ['18:00', '6:00 PM'],
                ['22:00', '10:00 PM'],
                ['23:30', '11:30 PM'],
              ].map(([time, label]) => (
                <label className="member-check flex items-center gap-1.75 rounded-[10px] border border-(--line) bg-white p-2.25" key={time}>
                  <input
                    type="checkbox"
                    checked={reminderTimes.includes(time)}
                    onChange={(event) => setReminderTimes((current) =>
                      event.target.checked
                        ? [...current, time].sort()
                        : current.filter((item) => item !== time),
                    )}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className={"checkbox-field flex items-center gap-2 p-[10px_0] field-span-2 col-span-full max-[640px]:col-[1]"}>
            <input type="checkbox" {...register('penaltyEnabled')} />
            Apply the household penalty when missed
          </label>
          <div className={"modal-actions flex justify-end gap-2.25 mt-1.5 field-span-2 col-span-full max-[640px]:col-[1]"}>
            <Button type="button" variant="ghost" onClick={() => setTaskModal(false)}>Cancel</Button>
            <Button type="submit" disabled={busy === 'task:new'}>Create chore</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(disputeId)}
        onClose={() => setDisputeId(null)}
        title="Dispute the infraction"
        description="Your reason will be visible to the other roommates."
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (!disputeId || disputeReason.trim().length < 5) return
            await disputeInfraction(disputeId, disputeReason.trim())
            setDisputeId(null)
            setDisputeReason('')
          }}
        >
          <label>What happened?
            <textarea
              value={disputeReason}
              onChange={(event) => setDisputeReason(event.target.value)}
              placeholder="Give enough context for a fair vote."
              rows={4}
            />
          </label>
          <div className={"modal-actions flex justify-end gap-2.25 mt-1.5"}>
            <Button type="button" variant="ghost" onClick={() => setDisputeId(null)}>Cancel</Button>
            <Button type="submit" disabled={disputeReason.trim().length < 5}>Open dispute</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(assignTaskId)}
        onClose={() => setAssignTaskId('')}
        title="Assign this chore"
        description="Manual chores appear only when someone explicitly assigns them."
      >
        <form
          className={"form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"}
          onSubmit={async (event) => {
            event.preventDefault()
            await assignManualTask(assignTaskId, assignMemberId, assignDate)
            setAssignTaskId('')
          }}
        >
          <label>Roommate
            <select value={assignMemberId} onChange={(event) => setAssignMemberId(event.target.value)}>
              {data.members.filter((member) => member.active).map((member) => (
                <option value={member.id} key={member.id}>{member.displayName}</option>
              ))}
            </select>
          </label>
          <label>Due date
            <input type="date" value={assignDate} onChange={(event) => setAssignDate(event.target.value)} />
          </label>
          <div className={"modal-actions flex justify-end gap-2.25 mt-1.5 field-span-2 col-span-full max-[640px]:col-[1]"}>
            <Button type="button" variant="ghost" onClick={() => setAssignTaskId('')}>Cancel</Button>
            <Button type="submit">Assign chore</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function recurrenceSummary(recurrence: {
  frequency: 'daily' | 'weekly' | 'monthly' | 'once' | 'rolling_queue'
  interval: number
  weekdays?: number[]
}) {
  if (recurrence.frequency === 'once') return 'One time'
  if (recurrence.frequency === 'rolling_queue') return 'Rolling queue · one per day'
  if (recurrence.frequency === 'weekly' && recurrence.weekdays?.length) {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return `Every ${recurrence.interval > 1 ? `${recurrence.interval} weeks on ` : ''}${recurrence.weekdays.map((day) => names[day - 1]).join(', ')}`
  }
  const unit = recurrence.frequency === 'daily' ? 'day' : recurrence.frequency === 'monthly' ? 'month' : 'week'
  return recurrence.interval === 1 ? `Every ${unit}` : `Every ${recurrence.interval} ${unit}s`
}

function routineFrequencyLabel(frequency: string) {
  if (frequency === 'rolling_queue') return 'Queue'
  if (frequency === 'once') return 'Once'
  if (frequency === 'daily') return 'Daily'
  if (frequency === 'monthly') return 'Monthly'
  return 'Weekly'
}

function formatRoutineDueTime(time: string) {
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
}
