import { useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileUp,
  GraduationCap,
  MapPin,
  Pencil,
  Plus,
  Users,
} from 'lucide-react'
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { useAppData } from '../state/AppDataContext'
import { importIcs } from '../lib/api'
import { Avatar, Badge, Button, Card, Modal, SectionHeader } from '../components/ui'
import { formatShortTime, toIso } from '../lib/utils'

export function CalendarPage() {
  const {
    data,
    busy,
    addEvent,
    addDeparture,
    refresh,
    updateScheduleItemKind,
    updateCourse,
  } = useAppData()
  const [eventModal, setEventModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [location, setLocation] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [audience, setAudience] = useState<'everyone' | 'selected' | 'self'>('everyone')
  const [audienceIds, setAudienceIds] = useState<string[]>([])
  const [repeat, setRepeat] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once')
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([1440, 60])
  const [icsUrl, setIcsUrl] = useState('')
  const [icsFile, setIcsFile] = useState<File | undefined>()
  const [importStatus, setImportStatus] = useState('')

  const [selectedDate, setSelectedDate] = useState(
    () => new Date(data.events[0]?.startAt ?? new Date()),
  )
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date(data.events[0]?.startAt ?? new Date())),
  )

  const calendarDays = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 })
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  }, [visibleMonth])

  const eventDateKeys = useMemo(
    () => new Set(data.events.map((event) => format(new Date(event.startAt), 'yyyy-MM-dd'))),
    [data.events],
  )

  const selectedEvents = useMemo(
    () =>
      data.events
        .filter((event) => isSameDay(new Date(event.startAt), selectedDate))
        .sort(
          (left, right) =>
            new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
        ),
    [data.events, selectedDate],
  )

  const selectedWeek = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  }, [selectedDate])

  const chooseDate = (date: Date) => {
    setSelectedDate(date)
    setVisibleMonth(startOfMonth(date))
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">THE WHOLE HOUSE, IN SYNC</p>
          <h1>Calendar</h1>
          <p>Visits, exams and class schedules—shared with the right people.</p>
        </div>
        <div className="button-row">
          {data.household.enabledFeatures.includes('courses') && <Button variant="secondary" onClick={() => setImportModal(true)}>
            <FileUp size={18} /> Import .ics
          </Button>}
          {data.household.enabledFeatures.includes('calendar') && <Button onClick={() => setEventModal(true)}>
            <Plus size={18} /> Add event
          </Button>}
        </div>
      </header>

      {data.household.enabledFeatures.includes('calendar') && (
        <div className="calendar-workspace">
          <section className="month-browser" aria-label="Month calendar">
            <div className="month-browser-header">
              <div>
                <span>{format(visibleMonth, 'yyyy')}</span>
                <h2>{format(visibleMonth, 'MMMM')}</h2>
              </div>
              <div className="month-controls">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
            <div className="month-weekdays" aria-hidden="true">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="month-grid">
              {calendarDays.map((date) => {
                const dateKey = format(date, 'yyyy-MM-dd')
                const selected = isSameDay(date, selectedDate)
                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={[
                      'month-day',
                      !isSameMonth(date, visibleMonth) ? 'is-outside' : '',
                      selected ? 'is-selected' : '',
                      isSameDay(date, new Date()) ? 'is-today' : '',
                      eventDateKeys.has(dateKey) ? 'has-events' : '',
                    ].filter(Boolean).join(' ')}
                    aria-label={format(date, 'EEEE, MMMM d, yyyy')}
                    aria-pressed={selected}
                    onClick={() => chooseDate(date)}
                  >
                    <span>{format(date, 'd')}</span>
                  </button>
                )
              })}
            </div>
            <button
              className="calendar-today-button"
              type="button"
              onClick={() => chooseDate(new Date())}
            >
              <CalendarDays size={16} /> Jump to today
            </button>
          </section>

          <section className="selected-agenda" aria-label="Selected day agenda">
            <div className="calendar-day-strip">
              {selectedWeek.map((date) => {
                const selected = isSameDay(date, selectedDate)
                const dateKey = format(date, 'yyyy-MM-dd')
                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={selected ? 'is-selected' : ''}
                    onClick={() => chooseDate(date)}
                    aria-pressed={selected}
                  >
                    <span>{format(date, 'EEE')}</span>
                    <strong>{format(date, 'd')}</strong>
                    {eventDateKeys.has(dateKey) && <i />}
                  </button>
                )
              })}
            </div>

            <div className="selected-day-heading">
              <p>{format(selectedDate, 'MMMM d, yyyy')}</p>
              <h2>{format(selectedDate, 'EEEE')}</h2>
              <span>
                {selectedEvents.length
                  ? `${selectedEvents.length} ${selectedEvents.length === 1 ? 'event' : 'events'}`
                  : 'No plans yet'}
              </span>
            </div>

            {selectedEvents.length ? (
              <div className="calendar-timeline">
                {selectedEvents.map((event) => {
                  const creator = data.members.find(
                    (member) => member.id === event.creatorId,
                  )
                  return (
                    <article
                      className={`calendar-timeline-item event-${event.kind}`}
                      key={event.id}
                    >
                      <div className="calendar-timeline-rail">
                        <span />
                      </div>
                      <div className="calendar-event-block">
                        <div className="calendar-event-time">
                          <strong>
                            {event.allDay ? 'All day' : formatShortTime(event.startAt)}
                          </strong>
                          {!event.allDay && <span>to {formatShortTime(event.endAt)}</span>}
                        </div>
                        <div className="calendar-event-copy">
                          <div>
                            <h3>{event.title}</h3>
                            <Badge
                              tone={
                                event.kind === 'exam'
                                  ? 'red'
                                  : event.kind === 'class'
                                    ? 'blue'
                                    : 'green'
                              }
                            >
                              {event.kind}
                            </Badge>
                          </div>
                          <p>
                            {event.location && (
                              <span><MapPin size={14} /> {event.location}</span>
                            )}
                            <span><Users size={14} /> {event.audience}</span>
                          </p>
                          {event.imported
                            && event.scheduleItemId
                            && event.creatorId === data.household.currentMemberId && (
                              <select
                                className="event-kind-select"
                                value={event.kind}
                                onChange={(change) =>
                                  updateScheduleItemKind(
                                    event.scheduleItemId!,
                                    change.target.value as 'class' | 'exam' | 'other',
                                  )
                                }
                                aria-label={`Classify ${event.title}`}
                              >
                                <option value="class">Class</option>
                                <option value="exam">Exam</option>
                                <option value="other">Other</option>
                              </select>
                            )}
                          {event.imported
                            && event.scheduleItemId
                            && event.creatorId === data.household.currentMemberId
                            && data.vehicles.some((vehicle) => vehicle.ownerMemberId === data.household.currentMemberId) && (
                              <button
                                type="button"
                                className="inline-link"
                                onClick={() => {
                                  const vehicle = data.vehicles.find(
                                    (item) => item.ownerMemberId === data.household.currentMemberId,
                                  )!
                                  const requiredAt = new Date(event.startAt)
                                  requiredAt.setMinutes(requiredAt.getMinutes() - 30)
                                  void addDeparture(
                                    vehicle.id,
                                    toIso(requiredAt),
                                    event.courseCode ?? event.title,
                                    60,
                                    undefined,
                                    event.scheduleItemId,
                                  )
                                }}
                              >
                                <CarFront size={14} /> Leave 30 min before
                              </button>
                            )}
                        </div>
                        {creator && (
                          <Avatar
                            initials={creator.initials}
                            color={creator.color}
                            size="sm"
                          />
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="calendar-empty-day">
                <CalendarPlus />
                <strong>This day is open.</strong>
                <span>Add a house event or import a class schedule.</span>
                <Button size="sm" onClick={() => setEventModal(true)}>
                  <Plus size={16} /> Add event
                </Button>
              </div>
            )}
          </section>
        </div>
      )}

      {data.household.enabledFeatures.includes('courses') && (
        <section className="calendar-courses-section">
          <SectionHeader eyebrow="COURSES" title="Roommate schedules" />
          <div className="course-list calendar-course-grid">
            {data.courses.map((course) => {
              const owner = data.members.find((member) => member.id === course.ownerMemberId)!
              return (
                <Card className="course-card" key={course.id}>
                  <div className="course-stripe" style={{ background: course.color }} />
                  <div className="course-heading">
                    <span className="course-code">{course.code}</span>
                    <Avatar initials={owner.initials} color={owner.color} size="sm" />
                  </div>
                  <strong>{course.name}</strong>
                  <span><Clock3 size={14} /> {course.meetingLabel}</span>
                  {course.location && <span><MapPin size={14} /> {course.location}</span>}
                  {course.ownerMemberId === data.household.currentMemberId && (
                    <button
                      type="button"
                      className="inline-link"
                      onClick={() => {
                        const name = window.prompt('Course name', course.name)
                        if (!name?.trim()) return
                        const color = window.prompt('Course color (hex)', course.color)
                        if (color?.match(/^#[0-9a-f]{6}$/i)) {
                          void updateCourse(course.id, name.trim(), color)
                        }
                      }}
                    >
                      <Pencil size={14} /> Edit course
                    </button>
                  )}
                </Card>
              )
            })}
          </div>
          <Card className="privacy-note">
            <GraduationCap />
            <div>
              <strong>Full schedules are shared</strong>
              <span>Everyone in this house can see imported course details.</span>
            </div>
          </Card>
        </section>
      )}

      <Modal
        open={eventModal}
        onClose={() => setEventModal(false)}
        title="Add a household event"
        description="Everyone will see it unless you choose a smaller audience."
      >
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!title.trim() || !start || !end) return
            await addEvent({
              title: title.trim(),
              startAt: toIso(new Date(start)),
              endAt: toIso(new Date(end)),
              allDay,
              location: location.trim() || undefined,
              audience,
              audienceMemberIds: audience === 'selected' ? audienceIds : [],
              kind: 'household',
              recurrence: repeat === 'once' ? undefined : { frequency: repeat, interval: 1 },
              reminderOffsets,
            })
            setEventModal(false)
            setTitle('')
            setStart('')
            setEnd('')
            setLocation('')
          }}
        >
          <label className="field-span-2">Event name
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Parents visiting" required />
          </label>
          <label className="checkbox-field field-span-2">
            <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
            All-day event
          </label>
          <label>Starts
            <input type={allDay ? 'date' : 'datetime-local'} value={start} onChange={(event) => setStart(event.target.value)} required />
          </label>
          <label>Ends
            <input type={allDay ? 'date' : 'datetime-local'} value={end} onChange={(event) => setEnd(event.target.value)} required />
          </label>
          <label className="field-span-2">Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Home" />
          </label>
          <label>Audience
            <select value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}>
              <option value="everyone">Everyone</option>
              <option value="selected">Selected roommates</option>
              <option value="self">Only me</option>
            </select>
          </label>
          <label>Repeat
            <select value={repeat} onChange={(event) => setRepeat(event.target.value as typeof repeat)}>
              <option value="once">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          {audience === 'selected' && (
            <fieldset className="field-span-2 compact-options">
              <legend>Visible to</legend>
              <div className="member-check-grid">
                {data.members.map((member) => (
                  <label className="member-check" key={member.id}>
                    <input
                      type="checkbox"
                      checked={audienceIds.includes(member.id)}
                      onChange={(event) => setAudienceIds((current) =>
                        event.target.checked
                          ? [...current, member.id]
                          : current.filter((id) => id !== member.id),
                      )}
                    />
                    <Avatar initials={member.initials} color={member.color} size="sm" />
                    {member.displayName}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className="field-span-2 compact-options">
            <legend>Reminders</legend>
            <div className="member-check-grid">
              {[
                [10080, '1 week'],
                [1440, '1 day'],
                [60, '1 hour'],
                [15, '15 minutes'],
              ].map(([offset, label]) => (
                <label className="member-check" key={offset}>
                  <input
                    type="checkbox"
                    checked={reminderOffsets.includes(offset as number)}
                    onChange={(event) => setReminderOffsets((current) =>
                      event.target.checked
                        ? [...current, offset as number]
                        : current.filter((item) => item !== offset),
                    )}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="modal-actions field-span-2">
            <Button type="button" variant="ghost" onClick={() => setEventModal(false)}>Cancel</Button>
            <Button type="submit" disabled={busy === 'event:new'}><CalendarPlus size={17} /> Add event</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={importModal}
        onClose={() => setImportModal(false)}
        title="Import a class schedule"
        description="Use an .ics file or paste a calendar URL. URLs are fetched once and never stored."
      >
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault()
            setImportStatus('Importing and checking recurring events…')
            try {
              const result = await importIcs(icsFile, icsUrl || undefined)
              setImportStatus(`Imported ${result?.imported ?? 0} schedule items.`)
              await refresh()
            } catch (error) {
              setImportStatus(error instanceof Error ? error.message : 'Import failed.')
            }
          }}
        >
          <label className="field-span-2">Calendar file
            <input type="file" accept=".ics,text/calendar" onChange={(event) => setIcsFile(event.target.files?.[0])} />
          </label>
          <div className="form-divider"><span>or</span></div>
          <label className="field-span-2">Calendar URL
            <input type="url" value={icsUrl} onChange={(event) => setIcsUrl(event.target.value)} placeholder="https://university.example/schedule.ics" />
          </label>
          {importStatus && <div className="import-status field-span-2"><BookOpen size={17} /> {importStatus}</div>}
          <div className="modal-actions field-span-2">
            <Button type="button" variant="ghost" onClick={() => setImportModal(false)}>Close</Button>
            <Button type="submit" disabled={!icsFile && !icsUrl}>Import schedule</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
