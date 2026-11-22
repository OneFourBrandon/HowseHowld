import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Ellipsis, Pause, Pencil, Play, Plus, Trash2, UserPlus } from 'lucide-react'
import { InfractionsPanel } from '../components/InfractionsPanel'
import { UpForGrabs } from '../components/UpForGrabs'
import {
  addDateKeyDays,
  choresUpForGrabs,
  claimForInfraction,
  formatGracePeriod,
  graceEndsAt,
  graceMinutesOf,
  isInGracePeriod,
} from '../lib/chores'
import { cn } from '../lib/cn'
import { isInfractionReviewOpen } from '../lib/infractions'
import { choreCounts, completionGrid, onTimeRate, weekRange } from '../lib/insights'
import { formatDateTime, formatInlineDateTime, formatShortTime, taskCompletionAvailability } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { TaskOccurrence } from '../types'
import { AskDialog } from './AskDialog'
import { HeatGrid } from './charts'
import { Chip, Empty, Face, Panel, Popover, Segmented, Stat, Stats } from './ui'
import { useHouse } from './useHouse'

const PAGE_SIZE = 6

function dueTimeLabel(time: string) {
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

/** The slate layout for Chores. The dialogs and their state stay with ChoresPage. */
export function ChoresView({
  now,
  upcoming,
  onNewTask,
  onEditTask,
  onAssignTask,
  onDispute,
}: {
  now: number
  /** The next open occurrence of each chore, soonest first. */
  upcoming: TaskOccurrence[]
  onNewTask: () => void
  onEditTask: (taskId: string) => void
  onAssignTask: (taskId: string) => void
  onDispute: (infractionId: string) => void
}) {
  const { data, busy, completeOccurrence, updateTask, deleteTask } = useAppData()
  const { today, me, isOwner } = useHouse()
  const [scope, setScope] = useState<'house' | 'mine'>('house')
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const graceMinutes = graceMinutesOf(data.household)
  const memberById = (id?: string) => data.members.find(member => member.id === id)

  const rows = scope === 'mine' ? upcoming.filter(occurrence => occurrence.assigneeId === me.id) : upcoming
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const scopeMember = scope === 'mine' ? me.id : undefined
  const week = weekRange(today)
  const thisWeek = choreCounts(data, week.start, week.end, now, scopeMember)
  const monthStart = `${today.slice(0, 7)}-01`
  const thisMonth = choreCounts(data, monthStart, today, now, scopeMember)
  const rate = onTimeRate(choreCounts(data, addDateKeyDays(today, -29), today, now, scopeMember))
  const openReviews = data.infractions.filter(infraction =>
    isInfractionReviewOpen(infraction, now, claimForInfraction(data.choreClaims, infraction.id))).length
  const activeRoutines = data.tasks.filter(task => task.active).length
  const grid = useMemo(() => completionGrid(data, now, 20, 7), [data, now])
  const gridRows = scope === 'mine' ? grid.rows.filter(row => row.member.id === me.id) : grid.rows
  const grabs = choresUpForGrabs(data, now, me.id).length

  const deletingTask = data.tasks.find(task => task.id === deleting)

  return (
    <>
      {deletingTask && (
        <AskDialog
          title={`Delete ${deletingTask.title}?`}
          description="Upcoming turns and their reminders are removed. Finished chores and penalties stay in the history."
          confirmLabel="Delete chore"
          danger
          onConfirm={() => deleteTask(deletingTask.id)}
          onClose={() => setDeleting(null)}
        />
      )}

      <div className="sl-toolbar">
        <Segmented
          label="Whose chores to show"
          value={scope}
          onChange={value => { setScope(value); setPage(0) }}
          options={[{ value: 'house', label: 'Whole house' }, { value: 'mine', label: 'Just mine' }]}
        />
        <button type="button" className="sl-btn sl-btn-primary" onClick={onNewTask}>
          <Plus size={16} strokeWidth={2.2} /> New chore
        </button>
      </div>

      <div className="sl-grid">
        <Panel className="col-span-12" aria-label="Chores at a glance">
          <Stats cols={5} colsSm={3}>
            <Stat tone="moss" label="Done this month" value={thisMonth.done} />
            <Stat tone="steel" label="To do this week" value={thisWeek.open + thisWeek.grace} />
            <Stat tone={rate !== null && rate < .5 ? 'brick' : 'moss'} label="On time, 30 days" value={rate === null ? '–' : `${Math.round(rate * 100)}%`} />
            <Stat tone="ink" label="Active routines" value={activeRoutines} />
            <Stat tone={openReviews ? 'brass' : 'ink'} label="Open reviews" value={openReviews} />
          </Stats>
        </Panel>

        <Panel
          className="col-span-12"
          title="Who did what"
          note="Three weeks back and the week ahead, a square per day."
        >
          <HeatGrid
            days={grid.days}
            rows={gridRows}
            today={grid.today}
            renderLabel={member => (
              <>
                <Face member={member} size={22} />
                <span className="truncate">{member.id === me.id ? 'You' : member.displayName}</span>
              </>
            )}
          />
          <ul className="sl-micro mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
            <li className="flex items-center gap-2"><i className="sl-key sl-tone-moss" data-fill="solid" />Done</li>
            <li className="flex items-center gap-2"><i className="sl-key sl-tone-moss" data-fill="hatch" />To do</li>
            <li className="flex items-center gap-2"><i className="sl-key sl-tone-brick" data-fill="solid" />Missed</li>
          </ul>
        </Panel>

        {grabs > 0 && (
          <Panel className="sl-embed col-span-12">
            <UpForGrabs now={now} />
          </Panel>
        )}

        <div className="col-span-12 grid content-start gap-px lg:col-span-7 lg:grid-rows-[auto_1fr]">
        <Panel
          flush
          title="Coming up"
          note={graceMinutes > 0
            ? `Each chore has ${formatGracePeriod(graceMinutes)} of grace after its due time before it counts as missed.`
            : 'A chore counts as missed as soon as it is due.'}
        >
          <div className="mt-3 overflow-x-auto">
            <table className="sl-table">
              <thead>
                <tr>
                  <th>Chore</th>
                  <th>Who</th>
                  <th>Due</th>
                  <th className="max-sm:hidden">Status</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(occurrence => {
                  const member = memberById(occurrence.assigneeId)
                  const mine = occurrence.assigneeId === me.id
                  const availability = taskCompletionAvailability(
                    occurrence.scheduledDate, occurrence.dueAt, data.household.timezone, new Date(now), graceMinutes,
                  )
                  const inGrace = isInGracePeriod(occurrence, graceMinutes, now)
                  return (
                    <tr key={occurrence.id} className="occurrence-card">
                      <td>
                        <span className="sl-cell-main">{occurrence.taskTitle}</span>
                        <span className="sl-cell-sub">{occurrence.area}</span>
                      </td>
                      <td>
                        {member && (
                          <span className="flex items-center gap-2">
                            <Face member={member} size={24} />
                            <span className="max-sm:hidden">{mine ? 'You' : member.displayName}</span>
                          </span>
                        )}
                      </td>
                      <td>
                        {inGrace ? (
                          <>
                            <span className="sl-cell-main text-(--sl-brass)">By {formatInlineDateTime(graceEndsAt(occurrence.dueAt, graceMinutes).toISOString())}</span>
                            <span className="sl-cell-sub">Was due {formatShortTime(occurrence.dueAt)}</span>
                          </>
                        ) : (
                          <>
                            <span className="sl-cell-main font-[480]">{formatDateTime(occurrence.dueAt)}</span>
                            <span className="sl-cell-sub max-sm:hidden">{occurrence.reminderLabel}</span>
                          </>
                        )}
                      </td>
                      <td className="max-sm:hidden">
                        {inGrace ? <Chip tone="brass">Grace period</Chip>
                          : mine ? <Chip tone="brass">Your turn</Chip>
                            : <Chip tone="steel">Scheduled</Chip>}
                      </td>
                      <td className="w-px text-right">
                        {mine && (
                          <button
                            type="button"
                            className="sl-btn sl-btn-secondary sl-btn-sm"
                            disabled={busy === `complete:${occurrence.id}` || availability !== 'available'}
                            title={availability === 'early' ? `Available on ${occurrence.scheduledDate}`
                              : availability === 'expired' ? 'This chore has expired'
                                : inGrace ? 'Still counts if you finish before the grace period ends' : 'Mark this chore done'}
                            onClick={() => void completeOccurrence(occurrence.id).catch(() => {})}
                          >
                            {availability === 'available' && <Check size={14} />}
                            {availability === 'early' ? 'Not yet' : availability === 'expired' ? 'Expired' : 'Done'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <Empty title={scope === 'mine' ? 'Nothing is assigned to you' : 'No chores are scheduled'}>
              {data.tasks.length ? 'Upcoming turns appear here as they are assigned.' : 'Create a chore and the house takes turns from there.'}
            </Empty>
          )}
          {pageCount > 1 && (
            <nav className="flex items-center justify-between gap-3 border-t border-(--sl-line) px-(--sl-pad) py-2" aria-label="Coming up pages">
              <span className="sl-micro sl-num">
                {safePage * PAGE_SIZE + 1} to {Math.min(rows.length, (safePage + 1) * PAGE_SIZE)} of {rows.length}
              </span>
              <span className="flex gap-1">
                <button type="button" className="sl-icon-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous chores">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className="sl-icon-btn" disabled={safePage === pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="More chores">
                  <ChevronRight size={16} />
                </button>
              </span>
            </nav>
          )}
        </Panel>

        <Panel flush title="Routines" note="The chores this house repeats, and whose turn is next.">
          <div className="mt-3">
            <table className="sl-table">
              <thead>
                <tr>
                  <th>Routine</th>
                  <th className="max-sm:hidden">Repeats</th>
                  <th className="max-md:hidden">Due</th>
                  <th>Next up</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.tasks.map(task => {
                  const next = memberById(task.nextMemberId)
                  return (
                    <tr key={task.id} className={cn('routine-row', !task.active && 'opacity-60')}>
                      <td>
                        <span className="sl-cell-main">{task.title}</span>
                        <span className="sl-cell-sub">
                          {task.area}<span className="sm:hidden">, {task.recurrenceLabel}</span>
                        </span>
                      </td>
                      <td className="max-sm:hidden">
                        <span className="flex items-center gap-2">
                          {task.recurrenceLabel}
                          {!task.active && <Chip>Paused</Chip>}
                        </span>
                      </td>
                      <td className="sl-num max-md:hidden">{dueTimeLabel(task.dueTime)}</td>
                      <td>
                        {next ? (
                          <span className="flex items-center gap-2">
                            <Face member={next} size={24} />
                            <span className="max-sm:hidden">{next.id === me.id ? 'You' : next.displayName}</span>
                          </span>
                        ) : <span className="sl-meta">Assigned by hand</span>}
                      </td>
                      <td className="w-px">
                        <Popover
                          trigger={({ open, toggle }) => (
                            <button type="button" className="sl-icon-btn" aria-expanded={open} aria-haspopup="menu" aria-label={`Actions for ${task.title}`} onClick={toggle}>
                              <Ellipsis size={17} />
                            </button>
                          )}
                        >
                          {close => (
                            <div role="menu" aria-label={`Actions for ${task.title}`}>
                              {task.assignmentMode === 'manual' && (
                                <button type="button" role="menuitem" className="sl-pop-item" onClick={() => { close(); onAssignTask(task.id) }}>
                                  <UserPlus size={15} /> Assign
                                </button>
                              )}
                              {isOwner && (
                                <button type="button" role="menuitem" className="sl-pop-item" onClick={() => { close(); void updateTask(task.id, { active: !task.active }).catch(() => {}) }}>
                                  {task.active ? <Pause size={15} /> : <Play size={15} />} {task.active ? 'Pause' : 'Resume'}
                                </button>
                              )}
                              {isOwner && (
                                <button type="button" role="menuitem" className="sl-pop-item" onClick={() => { close(); onEditTask(task.id) }}>
                                  <Pencil size={15} /> Edit
                                </button>
                              )}
                              <button
                                type="button"
                                role="menuitem"
                                className="sl-pop-item text-(--sl-brick)"
                                disabled={busy === `task:delete:${task.id}`}
                                onClick={() => {
                                  close()
                                  setDeleting(task.id)
                                }}
                              >
                                <Trash2 size={15} /> Delete
                              </button>
                            </div>
                          )}
                        </Popover>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!data.tasks.length && (
            <Empty title="No routines yet">
              <button type="button" className="sl-btn sl-btn-secondary sl-btn-sm mt-2" onClick={onNewTask}><Plus size={14} /> New chore</button>
            </Empty>
          )}
        </Panel>

        </div>

        <Panel className="sl-embed col-span-12 lg:col-span-5">
          <InfractionsPanel now={now} onDispute={onDispute} />
        </Panel>
      </div>
    </>
  )
}
