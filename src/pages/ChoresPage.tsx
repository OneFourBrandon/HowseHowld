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
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  Inner,
  Modal,
  PageHeader,
  Pill,
  Tile,
} from '../components/ui'
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
    <>
      <PageHeader
        title="Chores"
        description="Do your chores... or else."
        actions={
          <Button className="max-[760px]:w-full" onClick={() => setTaskModal(true)}>
            <Plus size={16} /> New chore
          </Button>
        }
      />

      <Card className="grid grid-cols-3 max-[640px]:grid-cols-1">
        <div className="flex items-center gap-4 px-6 py-5 max-[640px]:px-4 max-[640px]:py-4">
          <Tile icon={CheckCircle2} tone="green" size={44} radius={14} />
          <div className="grid min-w-0 gap-0.5">
            <strong className="font-display text-[1.9rem] leading-none font-extrabold">{completedThisMonth}</strong>
            <span className="text-[.78rem] font-semibold text-(--text-3)">Completed this month</span>
          </div>
        </div>
        <div className="flex items-center gap-4 border-l border-(--line) px-6 py-5 max-[640px]:border-t max-[640px]:border-l-0 max-[640px]:px-4 max-[640px]:py-4">
          <Tile icon={RotateCw} tone="blue" size={44} radius={14} />
          <div className="grid min-w-0 gap-0.5">
            <strong className="font-display text-[1.9rem] leading-none font-extrabold">{data.tasks.filter((task) => task.active).length}</strong>
            <span className="text-[.78rem] font-semibold text-(--text-3)">Active rotations</span>
          </div>
        </div>
        <div className="flex items-center gap-4 border-l border-(--line) px-6 py-5 max-[640px]:border-t max-[640px]:border-l-0 max-[640px]:px-4 max-[640px]:py-4">
          <Tile icon={AlertTriangle} tone="pink" size={44} radius={14} />
          <div className="grid min-w-0 gap-0.5">
            <strong className="font-display text-[1.9rem] leading-none font-extrabold">{data.infractions.filter((item) => item.status !== 'excused' && item.status !== 'paid').length}</strong>
            <span className="text-[.78rem] font-semibold text-(--text-3)">Open infractions</span>
          </div>
        </div>
      </Card>

      <section>
        <Card className="pb-4">
          <CardHead title="Coming up" description="Server-confirmed deadlines in Toronto time." />
          <div className="grid grid-cols-3 gap-3 px-4 max-[1100px]:grid-cols-2 max-[720px]:grid-cols-1">
            {visibleUpcoming.map((occurrence) => {
              const member = data.members.find((item) => item.id === occurrence.assigneeId)!
              const isMine = member.id === currentMemberId
              const completionAvailability = taskCompletionAvailability(
                occurrence.scheduledDate,
                occurrence.dueAt,
                data.household.timezone,
              )
              const mineNow = isMine && occurrence.status === 'assigned'
              return (
                <Inner key={occurrence.id} className="grid content-start gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    {occurrence.status === 'completed' ? (
                      <Pill tone="green">Done</Pill>
                    ) : occurrence.status === 'missed' ? (
                      <Pill tone="red">Missed</Pill>
                    ) : mineNow ? (
                      <Pill tone="white">Your turn</Pill>
                    ) : (
                      <Pill tone="blue">Assigned</Pill>
                    )}
                    <span className="text-right text-[.72rem] leading-tight text-(--text-3)">
                      {occurrence.area}
                      <br />
                      {formatDateTime(occurrence.dueAt)}
                    </span>
                  </div>
                  <div className="grid gap-1">
                    <h3 className="text-[.98rem]">{occurrence.taskTitle}</h3>
                    <p className="text-[.78rem] leading-relaxed text-(--text-3)">
                      {occurrence.reminderLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 border-t border-(--line) pt-3">
                    <ChoreOccurrenceIcon status={occurrence.status} size={30} />
                    <Avatar
                      initials={member.initials}
                      color={member.color}
                      imageUrl={member.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 truncate text-[.8rem] font-bold">{member.displayName}</span>
                    {mineNow && (
                      <Button
                        className="ml-auto"
                        size="sm"
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
                        <Check size={15} />
                        {completionAvailability === 'early'
                          ? 'Not yet'
                          : completionAvailability === 'expired'
                            ? 'Expired'
                            : 'Done'}
                      </Button>
                    )}
                  </div>
                </Inner>
              )
            })}
            {!visibleUpcoming.length && (
              <EmptyState
                className="col-span-full"
                icon={CheckCircle2}
                title="Nothing assigned"
                description="Every chore in this house is done or paused."
              />
            )}
          </div>
        </Card>
        {upcomingPageCount > 1 && (
          <nav className="mt-3 flex items-center justify-end gap-1" aria-label="Coming up pages">
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

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] items-start gap-5 max-[1100px]:grid-cols-1">
        <Card className="pb-3">
          <CardHead
            title="House routines"
            description={`${data.tasks.filter((task) => task.active).length} of ${data.tasks.length} running`}
          />
          <div className="px-5 max-[640px]:px-3">
            {data.tasks.map((task, index) => {
              const next = data.members.find((member) => member.id === task.nextMemberId)
              return (
                <div
                  key={task.id}
                  className={cn(
                    'hh-row grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-4 py-3.5 max-[860px]:grid-cols-[auto_minmax(0,1fr)_auto] max-[860px]:gap-x-3',
                    index > 0 && 'border-t border-(--line)',
                    !task.active && 'opacity-60',
                  )}
                >
                  <Tile icon={RotateCw} tone={task.active ? 'blue' : 'neutral'} />
                  <div className="grid min-w-0 gap-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <strong className="truncate text-[.92rem]">{task.title}</strong>
                      {!task.active && <Badge>Paused</Badge>}
                    </div>
                    <span className="truncate text-[.78rem] text-(--text-3)">
                      {task.area} · {task.recurrenceLabel}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 max-[860px]:col-start-2 max-[860px]:row-start-2">
                    {next && (
                      <Avatar
                        initials={next.initials}
                        color={next.color}
                        imageUrl={next.avatarUrl}
                        size="sm"
                      />
                    )}
                    <span className="grid leading-tight">
                      <span className="text-[.65rem] font-bold tracking-[.06em] text-(--text-3) uppercase">
                        Next up
                      </span>
                      <span className="truncate text-[.8rem] font-bold">
                        {next?.displayName ?? 'Manual assignment'}
                      </span>
                    </span>
                  </div>
                  <Pill className="max-[860px]:hidden">
                    <Clock3 size={13} /> {formatRoutineDueTime(task.dueTime)}
                  </Pill>
                  <div className="flex items-center gap-1 max-[860px]:col-start-3 max-[860px]:row-start-2">
                    <Badge className="mr-1 max-[1280px]:hidden">
                      {routineFrequencyLabel(task.recurrence.frequency)}
                    </Badge>
                    {task.assignmentMode === 'manual' && (
                      <Button size="sm" variant="ghost" onClick={() => setAssignTaskId(task.id)}>
                        Assign
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-8 px-0"
                      aria-label={task.active ? `Pause ${task.title}` : `Resume ${task.title}`}
                      title={task.active ? 'Pause' : 'Resume'}
                      onClick={() => updateTask(task.id, { active: !task.active })}
                    >
                      {task.active ? <Pause size={15} /> : <RotateCw size={15} />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-8 px-0"
                      aria-label={`Rename ${task.title}`}
                      title="Rename"
                      onClick={() => {
                        const title = window.prompt('Rename this chore', task.title)
                        if (title?.trim()) updateTask(task.id, { title: title.trim() })
                      }}
                    >
                      <Pencil size={15} />
                    </Button>
                  </div>
                </div>
              )
            })}
            {!data.tasks.length && (
              <EmptyState
                icon={RotateCw}
                title="No routines yet"
                description="Create a chore and the server handles every turn after that."
                action={<Button size="sm" onClick={() => setTaskModal(true)}><Plus size={15} /> New chore</Button>}
              />
            )}
          </div>
        </Card>

        <Card className="grid content-start gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2>Infractions</h2>
            <Pill>Peer review</Pill>
          </div>
          {data.infractions.map((infraction) => {
            const member = data.members.find((item) => item.id === infraction.memberId)!
            const hasVoted =
              infraction.upholdVotes.includes(currentMemberId) ||
              infraction.excuseVotes.includes(currentMemberId)
            return (
              <Inner className="grid gap-3.5 p-4" key={infraction.id}>
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <Avatar
                    initials={member.initials}
                    color={member.color}
                    imageUrl={member.avatarUrl}
                    size="md"
                  />
                  <div className="grid min-w-0 gap-0.5">
                    <strong className="truncate text-[.88rem]">
                      {member.displayName} · {infraction.taskTitle}
                    </strong>
                    <span className="text-[.76rem] text-(--text-3)">
                      <span className="font-bold text-(--text) tabular-nums">
                        {formatMoney(infraction.amountCents)}
                      </span>{' '}
                      pending
                    </span>
                  </div>
                  <Pill tone={infraction.status === 'excused' ? 'green' : 'pink'}>
                    {infraction.status}
                  </Pill>
                </div>
                {infraction.disputeReason && (
                  <blockquote className="m-0 rounded-xl border border-(--line) bg-(--card) px-3.5 py-3 text-[.85rem] leading-relaxed text-(--text-2)">
                    “{infraction.disputeReason}”
                  </blockquote>
                )}
                <div className="flex items-center gap-3">
                  <span className="grid size-14 place-items-center rounded-full bg-(--green-soft) text-(--green)">
                    <span className="font-display text-[1.15rem] leading-none font-extrabold">
                      {infraction.excuseVotes.length}
                    </span>
                    <span className="text-[.6rem] font-bold">excuse</span>
                  </span>
                  <span className="grid size-14 place-items-center rounded-full bg-(--pink-soft) text-[#ff7fae]">
                    <span className="font-display text-[1.15rem] leading-none font-extrabold">
                      {infraction.upholdVotes.length}
                    </span>
                    <span className="text-[.6rem] font-bold">uphold</span>
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 text-right text-[.73rem] text-(--text-3)">
                    <Scale size={14} />
                    Review closes
                    <br />
                    {formatDateTime(infraction.disputeDeadline)}
                  </span>
                </div>
                {infraction.memberId === currentMemberId && infraction.status === 'pending' && (
                  <Button variant="secondary" onClick={() => setDisputeId(infraction.id)}>
                    Open a dispute
                  </Button>
                )}
                {infraction.memberId !== currentMemberId &&
                  infraction.status === 'disputed' &&
                  !hasVoted && (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        variant="secondary"
                        onClick={() => voteInfraction(infraction.id, 'excuse')}
                      >
                        Excuse
                      </Button>
                      <Button
                        className="flex-1"
                        variant="pink"
                        onClick={() => voteInfraction(infraction.id, 'uphold')}
                      >
                        Uphold
                      </Button>
                    </div>
                  )}
              </Inner>
            )
          })}
          {!data.infractions.length && (
            <EmptyState
              icon={Scale}
              title="No infractions"
              description="Nothing is up for peer review right now."
            />
          )}
        </Card>
      </div>

      <Modal
        open={taskModal}
        onClose={() => setTaskModal(false)}
        title="Create a chore"
        description="Set the routine once. The server handles every turn."
      >
        <form className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1" onSubmit={submitTask}>
          <label className="col-span-full max-[640px]:col-[1]">Chore name
            <input {...register('title')} placeholder="Clean the bathroom" />
            {errors.title && <span className="mt-1.5 text-[.75rem] text-[#ff8080]">{errors.title.message}</span>}
          </label>
          <label>Area
            <input {...register('area')} placeholder="e.g. Bathroom" />
            {errors.area && <span className="mt-1.5 text-[.75rem] text-[#ff8080]">{errors.area.message}</span>}
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
            <p className="hh-inner self-end p-3 text-[.76rem] leading-relaxed text-(--text-3)">
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
            <fieldset className="col-span-full grid gap-1 border-0 py-2 max-[640px]:col-[1]">
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
                        'min-h-10 rounded-full border border-(--line-2) bg-(--inner) font-[inherit] font-bold text-(--text-3) transition-[background-color,color,border-color] duration-150 hover:border-[rgba(255,255,255,.24)] hover:text-(--text)',
                        weekdays.includes(day) && 'border-transparent! bg-(--text)! text-(--bg)!',
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
            <label className="col-span-full max-[640px]:col-[1]">Assigned roommate
              <select value={fixedMemberId} onChange={(event) => setFixedMemberId(event.target.value)}>
                {data.members.filter((member) => member.active).map((member) => (
                  <option key={member.id} value={member.id}>{member.displayName}</option>
                ))}
              </select>
            </label>
          )}
          {assignmentMode === 'rotation' && (
            <fieldset className="col-span-full grid gap-1 border-0 py-2 max-[640px]:col-[1]">
              <legend>Rotation order and eligibility</legend>
              <div className="mt-1 grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
                {data.members.filter((member) => member.active).map((member) => (
                  <label className="hh-inner flex cursor-pointer items-center gap-2.5 p-2.5 text-[.82rem] font-bold" key={member.id}>
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
          <fieldset className="col-span-full grid gap-1 border-0 py-2 max-[640px]:col-[1]">
            <legend>Task reminders</legend>
            <div className="mt-1 grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
              {[
                ['09:00', 'Morning'],
                ['18:00', '6:00 PM'],
                ['22:00', '10:00 PM'],
                ['23:30', '11:30 PM'],
              ].map(([time, label]) => (
                <label className="hh-inner flex cursor-pointer items-center gap-2.5 p-2.5 text-[.82rem] font-bold" key={time}>
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
          <label className="col-span-full flex items-center gap-2.5 py-2.5 text-[.84rem] font-semibold max-[640px]:col-[1]">
            <input type="checkbox" {...register('penaltyEnabled')} />
            Apply the household penalty when missed
          </label>
          <div className="col-span-full mt-1.5 flex justify-end gap-2 max-[640px]:col-[1]">
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
          <div className="mt-4 flex justify-end gap-2">
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
          className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"
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
          <div className="col-span-full mt-1.5 flex justify-end gap-2 max-[640px]:col-[1]">
            <Button type="button" variant="ghost" onClick={() => setAssignTaskId('')}>Cancel</Button>
            <Button type="submit">Assign chore</Button>
          </div>
        </form>
      </Modal>
    </>
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
