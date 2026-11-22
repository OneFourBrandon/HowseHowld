import { type CSSProperties, useMemo, useState } from 'react'
import { CalendarPlus, CarFront, Check, ChevronLeft, ChevronRight, FileUp, Pencil, Plus } from 'lucide-react'
import { SharedCourseSchedule } from '../components/SharedCourseSchedule'
import { Button, Modal } from '../components/ui'
import { addDateKeyDays, graceMinutesOf } from '../lib/chores'
import { cn } from '../lib/cn'
import {
  type AgendaEntry,
  type AgendaKind,
  blockFor,
  buildAgenda,
  dateFromKey,
  daysBetween,
  shiftMonth,
} from '../lib/insights'
import { formatShortTime, taskCompletionAvailability, toIso } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import type { Course } from '../types'
import { AgendaRow } from './AgendaRow'
import { kindLabel, kindTone } from './kinds'
import { toneClass } from './tone'
import { Empty, Face, Panel } from './ui'
import { useHouse } from './useHouse'

const monthTitle = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const longDay = new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const weekdayName = new Intl.DateTimeFormat('en-CA', { weekday: 'long', timeZone: 'UTC' })
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_MARKS = 4

/** What can be shown on the calendar, grouped the way people think about it. */
type Layer = 'event' | 'class' | 'chore' | 'bill' | 'exit'
const layerOf: Record<AgendaKind, Layer> = {
  event: 'event', class: 'class', exam: 'class', chore: 'chore', bill: 'bill', exit: 'exit',
}
const layerLabel: Record<Layer, string> = {
  event: 'Events', class: 'Classes', chore: 'Chores', bill: 'Bills', exit: 'Driveway',
}

function dayTitle(dateKey: string, today: string) {
  const offset = daysBetween(today, dateKey)
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'
  if (offset === -1) return 'Yesterday'
  return weekdayName.format(dateFromKey(dateKey))
}

/** The slate layout for Calendar: every kind of day in one month, by layer. */
export function CalendarView({ onAddEvent, onImport }: { onAddEvent: () => void; onImport: () => void }) {
  const { data, busy, completeOccurrence, updateScheduleItemKind, addDeparture, updateCourse } = useAppData()
  const { now, today, me } = useHouse()
  const features = data.household.enabledFeatures
  const available = useMemo(() => ([
    features.includes('calendar') && 'event',
    features.includes('courses') && 'class',
    features.includes('chores') && 'chore',
    features.includes('money') && 'bill',
    features.includes('driveway') && 'exit',
  ].filter(Boolean) as Layer[]), [features])
  const [hidden, setHidden] = useState<Set<Layer>>(() => new Set())
  const [selected, setSelected] = useState(today)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [editing, setEditing] = useState<Course | null>(null)
  const graceMinutes = graceMinutesOf(data.household)
  const memberById = (id?: string) => data.members.find(member => member.id === id)
  const myVehicle = data.vehicles.find(vehicle => vehicle.ownerMemberId === me.id)

  const agenda = useMemo(
    () => buildAgenda(data, now).filter(entry => available.includes(layerOf[entry.kind]) && !hidden.has(layerOf[entry.kind])),
    [available, data, hidden, now],
  )
  const byDay = useMemo(() => {
    const map = new Map<string, AgendaEntry[]>()
    for (const entry of agenda) {
      const list = map.get(entry.dateKey)
      if (list) list.push(entry)
      else map.set(entry.dateKey, [entry])
    }
    return map
  }, [agenda])

  const cells = useMemo(() => {
    const first = `${month}-01`
    const offset = (dateFromKey(first).getUTCDay() + 6) % 7
    return Array.from({ length: 42 }, (_, index) => addDateKeyDays(first, index - offset))
  }, [month])
  // Drop a trailing week that belongs entirely to the next month.
  const visibleCells = cells[35].slice(0, 7) === month ? cells : cells.slice(0, 35)

  const choose = (dateKey: string) => {
    setSelected(dateKey)
    setMonth(dateKey.slice(0, 7))
  }
  const dayEntries = byDay.get(selected) ?? []

  return (
    <>
      {editing && (
        <CourseDialog
          course={editing}
          onClose={() => setEditing(null)}
          onSave={(name, color) => updateCourse(editing.id, name, color)}
        />
      )}

      <div className="sl-toolbar">
        <div className="sl-toolbar-group">
          <div className="sl-seg" role="group" aria-label="Month">
            <button type="button" className="px-1.5!" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <span className="grid min-w-34 place-items-center px-2 text-(length:--sl-fs-meta) font-[560] text-(--sl-ink)" aria-live="polite">
              {monthTitle.format(dateFromKey(`${month}-01`))}
            </span>
            <button type="button" className="px-1.5!" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          {(selected !== today || month !== today.slice(0, 7)) && (
            <button type="button" className="sl-btn sl-btn-sm" onClick={() => choose(today)}>Back to today</button>
          )}
        </div>
        <div className="sl-toolbar-group">
          {features.includes('courses') && (
            <button type="button" className="sl-btn sl-btn-secondary" onClick={onImport}>
              <FileUp size={15} /> Import .ics
            </button>
          )}
          {features.includes('calendar') && (
            <button type="button" className="sl-btn sl-btn-primary" onClick={onAddEvent}>
              <Plus size={16} strokeWidth={2.2} /> Add event
            </button>
          )}
        </div>
      </div>

      <div className="sl-grid">
        <Panel
          className="col-span-12 lg:col-span-7"
          flush
          title={monthTitle.format(dateFromKey(`${month}-01`))}
          note="A bar for each thing on a day. Hatched bars are still ahead."
        >
          <div className="flex flex-wrap gap-1.5 px-(--sl-pad) pb-3.5" role="group" aria-label="Show on the calendar">
            {available.map(layer => {
              const shown = !hidden.has(layer)
              const tone = kindTone[layer === 'class' ? 'class' : layer]
              return (
                <button
                  type="button"
                  key={layer}
                  className={cn('sl-layer', toneClass(tone))}
                  aria-pressed={shown}
                  onClick={() => setHidden(current => {
                    const next = new Set(current)
                    if (shown) next.add(layer)
                    else next.delete(layer)
                    return next
                  })}
                >
                  <i className="sl-dot" aria-hidden="true" />
                  {layerLabel[layer]}
                </button>
              )
            })}
          </div>
          <div className="sl-month-head" aria-hidden="true">
            {WEEKDAYS.map(day => <span key={day}>{day}</span>)}
          </div>
          <div className="sl-month" role="group" aria-label={monthTitle.format(dateFromKey(`${month}-01`))}>
            {visibleCells.map(dateKey => {
              const entries = byDay.get(dateKey) ?? []
              const date = dateFromKey(dateKey)
              const summary = entries.length
                ? [...new Set(entries.map(entry => entry.kind))]
                    .map(kind => {
                      const count = entries.filter(entry => entry.kind === kind).length
                      return `${count} ${kindLabel[kind][count === 1 ? 0 : 1]}`
                    }).join(', ')
                : 'nothing scheduled'
              return (
                <button
                  type="button"
                  key={dateKey}
                  className="sl-month-day"
                  data-outside={dateKey.slice(0, 7) !== month || undefined}
                  data-today={dateKey === today || undefined}
                  aria-pressed={selected === dateKey}
                  aria-label={`${longDay.format(date)}, ${summary}`}
                  onClick={() => choose(dateKey)}
                >
                  <span className="sl-month-date">{date.getUTCDate()}</span>
                  <span className="grid gap-0.75">
                    {entries.slice(0, MAX_MARKS).map(entry => {
                      const block = blockFor(entry)
                      return (
                        <i
                          key={entry.id}
                          className={cn('sl-month-mark', toneClass(block.fill === 'missed' ? 'brick' : kindTone[entry.kind]))}
                          data-fill={block.fill}
                        />
                      )
                    })}
                  </span>
                  {entries.length > MAX_MARKS && <span className="sl-micro sl-num">+{entries.length - MAX_MARKS}</span>}
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel
          className="col-span-12 lg:col-span-5"
          flush
          title={dayTitle(selected, today)}
          note={longDay.format(dateFromKey(selected))}
          tools={(
            <>
              <button type="button" className="sl-icon-btn" aria-label="Previous day" onClick={() => choose(addDateKeyDays(selected, -1))}>
                <ChevronLeft size={17} />
              </button>
              <button type="button" className="sl-icon-btn" aria-label="Next day" onClick={() => choose(addDateKeyDays(selected, 1))}>
                <ChevronRight size={17} />
              </button>
            </>
          )}
        >
          <div className="sl-rows mt-3 border-t border-(--sl-line)">
            {dayEntries.map(entry => {
              const event = entry.event
              const occurrence = entry.occurrence
              const mineToClassify = event?.imported && event.scheduleItemId && event.creatorId === me.id
              const canComplete = occurrence && entry.mine && occurrence.status === 'assigned'
              const availableNow = canComplete && taskCompletionAvailability(
                occurrence.scheduledDate, occurrence.dueAt, data.household.timezone, new Date(now), graceMinutes,
              ) === 'available'
              return (
                <AgendaRow
                  key={entry.id}
                  entry={entry}
                  person={memberById(entry.memberId)}
                  timeNote={event && !event.allDay ? `to ${formatShortTime(event.endAt)}` : undefined}
                  action={canComplete ? (
                    <button
                      type="button"
                      className="sl-btn sl-btn-secondary sl-btn-sm"
                      disabled={!availableNow || busy === `complete:${occurrence.id}`}
                      aria-label={`Mark done: ${entry.title}`}
                      onClick={() => void completeOccurrence(occurrence.id).catch(() => {})}
                    >
                      <Check size={14} /> Done
                    </button>
                  ) : undefined}
                >
                  {mineToClassify && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        className="mt-0! h-8 w-auto! py-0! pr-7! text-(length:--sl-fs-meta)!"
                        value={event.kind}
                        aria-label={`Classify ${event.title}`}
                        onChange={change => void updateScheduleItemKind(event.scheduleItemId!, change.target.value as 'class' | 'exam' | 'other')}
                      >
                        <option value="class">Class</option>
                        <option value="exam">Exam</option>
                        <option value="other">Other</option>
                      </select>
                      {myVehicle && (
                        <button
                          type="button"
                          className="sl-btn sl-btn-sm"
                          onClick={() => {
                            const leaveAt = new Date(event.startAt)
                            leaveAt.setMinutes(leaveAt.getMinutes() - 30)
                            void addDeparture(myVehicle.id, toIso(leaveAt), event.courseCode ?? event.title, 60, undefined, event.scheduleItemId)
                          }}
                        >
                          <CarFront size={14} /> Leave 30 min before
                        </button>
                      )}
                    </div>
                  )}
                </AgendaRow>
              )
            })}
          </div>
          {!dayEntries.length && (
            <Empty icon={<CalendarPlus size={16} />} title="This day is open">
              {features.includes('calendar') ? (
                <button type="button" className="sl-btn sl-btn-secondary sl-btn-sm mt-2" onClick={onAddEvent}>
                  <Plus size={14} /> Add event
                </button>
              ) : 'Nothing is scheduled.'}
            </Empty>
          )}
        </Panel>

        {features.includes('courses') && (
          <>
            <Panel className="sl-embed sl-embed-courses col-span-12">
              <SharedCourseSchedule />
            </Panel>

            <Panel
              className="col-span-12"
              flush
              title="Imported calendars"
              note="Everyone in this house can see imported course details."
              tools={<button type="button" className="sl-btn sl-btn-secondary sl-btn-sm" onClick={onImport}><FileUp size={14} /> Import .ics</button>}
            >
              <div className="mt-3">
                <table className="sl-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th className="max-sm:hidden">Meets</th>
                      <th className="max-md:hidden">Where</th>
                      <th>Whose</th>
                      <th><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.courses.map(course => {
                      const owner = memberById(course.ownerMemberId)
                      return (
                        <tr key={course.id}>
                          <td>
                            <span className="flex items-center gap-3">
                              <i className="h-8 w-1 shrink-0 rounded-full" style={{ background: course.color } as CSSProperties} aria-hidden="true" />
                              <span className="min-w-0">
                                <span className="sl-cell-main">{course.code}</span>
                                <span className="sl-cell-sub">{course.name}</span>
                              </span>
                            </span>
                          </td>
                          <td className="max-sm:hidden">{course.meetingLabel}</td>
                          <td className="max-md:hidden">{course.location ?? <span className="sl-meta">Not set</span>}</td>
                          <td>
                            {owner && (
                              <span className="flex items-center gap-2">
                                <Face member={owner} size={24} />
                                <span className="max-sm:hidden">{owner.id === me.id ? 'You' : owner.displayName}</span>
                              </span>
                            )}
                          </td>
                          <td className="w-px">
                            {course.ownerMemberId === me.id && (
                              <button type="button" className="sl-icon-btn" aria-label={`Edit ${course.code}`} onClick={() => setEditing(course)}>
                                <Pencil size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!data.courses.length && (
                <Empty title="No calendars imported">
                  Import an .ics file or link from your school to add your timetable.
                </Empty>
              )}
            </Panel>
          </>
        )}
      </div>
    </>
  )
}

function CourseDialog({
  course,
  onSave,
  onClose,
}: {
  course: Course
  onSave: (name: string, color: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(course.name)
  const [color, setColor] = useState(course.color)
  return (
    <Modal open onClose={onClose} title={`Edit ${course.code}`} className="w-[min(440px,100%)]">
      <form
        className="grid gap-4"
        onSubmit={async event => {
          event.preventDefault()
          if (!name.trim()) return
          try {
            await onSave(name.trim(), color)
            onClose()
          } catch {
            // The shared handler reports the failure.
          }
        }}
      >
        <label>Course name<input value={name} onChange={event => setName(event.target.value)} required /></label>
        <label>Colour<input className="h-10 p-1!" type="color" value={color} onChange={event => setColor(event.target.value)} /></label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save course</Button>
        </div>
      </form>
    </Modal>
  )
}
