import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Plus,
  RotateCw,
  Scale,
} from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { Avatar, Badge, Button, Card, Modal, SectionHeader } from '../components/ui'
import { formatDateTime, formatMoney } from '../lib/utils'

const taskSchema = z.object({
  title: z.string().trim().min(2, 'Give the chore a name.'),
  area: z.string().trim().min(2, 'Choose an area.'),
  recurrenceLabel: z.string().trim().min(2, 'Describe when it repeats.'),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/),
  assignmentMode: z.enum(['rotation', 'fixed', 'manual', 'one_off']),
  penaltyEnabled: z.boolean(),
})
type TaskForm = z.infer<typeof taskSchema>

export function ChoresPage() {
  const {
    data,
    busy,
    completeOccurrence,
    addTask,
    disputeInfraction,
    voteInfraction,
  } = useAppData()
  const [taskModal, setTaskModal] = useState(false)
  const [disputeId, setDisputeId] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const currentMemberId = data.household.currentMemberId
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      area: 'Kitchen',
      recurrenceLabel: 'Every week',
      dueTime: '23:59',
      assignmentMode: 'rotation',
      penaltyEnabled: true,
    },
  })

  const upcoming = useMemo(
    () =>
      [...data.occurrences].sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
      ),
    [data.occurrences],
  )

  const submitTask = handleSubmit(async (values) => {
    await addTask({
      ...values,
      description: '',
      rotationMemberIds: data.members.filter((member) => member.active).map((member) => member.id),
    })
    reset()
    setTaskModal(false)
  })

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">FAIR TURNS, CLEAR EXPECTATIONS</p>
          <h1>Chores</h1>
          <p>Everyone knows what’s next—and what happens if it’s missed.</p>
        </div>
        <Button onClick={() => setTaskModal(true)}>
          <Plus size={18} /> New chore
        </Button>
      </header>

      <div className="stats-row">
        <Card className="stat-card">
          <CheckCircle2 />
          <div><strong>12</strong><span>Completed this month</span></div>
        </Card>
        <Card className="stat-card">
          <RotateCw />
          <div><strong>{data.tasks.filter((task) => task.active).length}</strong><span>Active rotations</span></div>
        </Card>
        <Card className="stat-card">
          <AlertTriangle />
          <div><strong>{data.infractions.filter((item) => item.status !== 'excused' && item.status !== 'paid').length}</strong><span>Open infractions</span></div>
        </Card>
      </div>

      <section>
        <SectionHeader
          eyebrow="ASSIGNMENTS"
          title="Coming up"
          description="Server-confirmed deadlines in Toronto time."
        />
        <div className="occurrence-list">
          {upcoming.map((occurrence) => {
            const member = data.members.find((item) => item.id === occurrence.assigneeId)!
            const isMine = member.id === currentMemberId
            return (
              <Card key={occurrence.id} className="occurrence-card">
                <div className={`status-check status-${occurrence.status}`}>
                  {occurrence.status === 'completed' ? <Check size={18} /> : <Clock3 size={18} />}
                </div>
                <div className="occurrence-detail">
                  <div>
                    <Badge>{occurrence.area}</Badge>
                    {isMine && occurrence.status === 'assigned' && <Badge tone="amber">Your turn</Badge>}
                  </div>
                  <h3>{occurrence.taskTitle}</h3>
                  <span>{formatDateTime(occurrence.dueAt)} · {occurrence.reminderLabel}</span>
                </div>
                <div className="occurrence-person">
                  <Avatar initials={member.initials} color={member.color} size="sm" />
                  <span>{member.displayName}</span>
                </div>
                {isMine && occurrence.status === 'assigned' && (
                  <Button
                    variant="secondary"
                    disabled={busy === `complete:${occurrence.id}`}
                    onClick={() => completeOccurrence(occurrence.id)}
                  >
                    <Check size={17} /> Done
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      </section>

      <div className="content-grid-two">
        <section>
          <SectionHeader eyebrow="ROTATIONS" title="House routines" />
          <Card className="routine-list">
            {data.tasks.map((task) => {
              const next = data.members.find((member) => member.id === task.nextMemberId)
              return (
                <div className="routine-row" key={task.id}>
                  <div className="routine-icon"><RotateCw size={18} /></div>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{task.recurrenceLabel} · due {task.dueTime}</span>
                  </div>
                  <div className="routine-next">
                    {next && <Avatar initials={next.initials} color={next.color} size="sm" />}
                    <span>Next: {next?.displayName ?? 'Manual'}</span>
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
              <Card className="infraction-card" key={infraction.id}>
                <div className="infraction-heading">
                  <Avatar initials={member.initials} color={member.color} size="sm" />
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
                <div className="vote-meter">
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
                    <div className="button-row">
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
                <div className="deadline-note">
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
        <form className="form-grid" onSubmit={submitTask}>
          <label className="field-span-2">Chore name
            <input {...register('title')} placeholder="Clean the bathroom" />
            {errors.title && <span className="form-error">{errors.title.message}</span>}
          </label>
          <label>Area
            <input {...register('area')} placeholder="Bathroom" />
          </label>
          <label>Assignment
            <select {...register('assignmentMode')}>
              <option value="rotation">Fair rotation</option>
              <option value="fixed">Fixed roommate</option>
              <option value="manual">Assign manually</option>
              <option value="one_off">One-time task</option>
            </select>
          </label>
          <label>Repeats
            <input {...register('recurrenceLabel')} placeholder="Every Tuesday" />
          </label>
          <label>Due time
            <input type="time" {...register('dueTime')} />
          </label>
          <label className="checkbox-field field-span-2">
            <input type="checkbox" {...register('penaltyEnabled')} />
            Apply the household penalty when missed
          </label>
          <div className="modal-actions field-span-2">
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
          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={() => setDisputeId(null)}>Cancel</Button>
            <Button type="submit" disabled={disputeReason.trim().length < 5}>Open dispute</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
