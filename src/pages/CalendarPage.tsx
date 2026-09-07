import { cn } from '../lib/cn'
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
import { Avatar, Badge, Button, Card, CardHead, EmptyState, Modal, PageHeader, Pill } from '../components/ui'
import { SharedCourseSchedule } from '../components/SharedCourseSchedule'
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
    <>
      <PageHeader
        title="Calendar"
        description="Visits, exams and class schedules, shared with the right people."
        actions={
          <>
            {data.household.enabledFeatures.includes('courses') && (
              <Button variant="secondary" onClick={() => setImportModal(true)}>
                <FileUp size={16} /> Import .ics
              </Button>
            )}
            {data.household.enabledFeatures.includes('calendar') && (
              <Button onClick={() => setEventModal(true)}>
                <Plus size={16} /> Add event
              </Button>
            )}
          </>
        }
      />

      {data.household.enabledFeatures.includes('calendar') && (
        <div className="grid grid-cols-[400px_minmax(0,1fr)] items-stretch gap-5 max-[980px]:grid-cols-[340px_minmax(0,1fr)] max-[860px]:grid-cols-1">
          <Card className="p-5" aria-label="Month calendar">
            <div className="mb-4 flex items-center justify-between">
              <div className="grid gap-0.5">
                <span className="text-[.72rem] font-bold text-(--text-3)">{format(visibleMonth, 'yyyy')}</span>
                <h2 className="text-[1.5rem]">{format(visibleMonth, 'MMMM')}</h2>
              </div>
              <div className="flex gap-1.5">
                <button
                  className="hh-btn hh-btn-icon size-8.5"
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="hh-btn hh-btn-icon size-8.5"
                  type="button"
                  aria-label="Next month"
                  onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="month-weekdays mb-2 grid grid-cols-7" aria-hidden="true">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                <span className="text-center text-[.66rem] font-bold tracking-[.06em] uppercase text-(--text-3)" key={day}>{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date) => {
                const dateKey = format(date, 'yyyy-MM-dd')
                const selected = isSameDay(date, selectedDate)
                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={cn(
                      "relative grid h-10 min-w-0 place-items-center rounded-full border-0 bg-transparent text-[.82rem] font-semibold text-(--text) tabular-nums transition-colors hover:bg-(--inner)",
                      !isSameMonth(date, visibleMonth) && 'text-(--text-4)',
                      isSameDay(date, new Date()) && !selected && 'bg-(--raise)',
                      selected && 'bg-(--text)! font-extrabold text-(--bg)!',
                      eventDateKeys.has(dateKey) && "after:absolute after:bottom-1.5 after:h-1 after:w-1 after:rounded-full after:bg-(--pink) after:content-['']",
                    )}
                    aria-label={format(date, 'EEEE, MMMM d, yyyy')}
                    aria-pressed={selected}
                    onClick={() => chooseDate(date)}
                  >
                    <span>{format(date, 'd')}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-(--line) pt-3.5">
              <button
                className="inline-flex items-center gap-2 border-0 bg-transparent p-0 text-[.8rem] font-bold text-(--text-2) hover:text-(--text)"
                type="button"
                onClick={() => chooseDate(new Date())}
              >
                <CalendarDays size={15} /> Jump to today
              </button>
              <span className="inline-flex items-center gap-2 text-[.72rem] text-(--text-3)">
                <i className="size-1.5 rounded-full bg-(--pink)" /> Has events
              </span>
            </div>
          </Card>

          <Card className="grid content-start gap-4.5 p-5" aria-label="Selected day agenda">
            <div className="grid grid-cols-7 gap-2">
              {selectedWeek.map((date) => {
                const selected = isSameDay(date, selectedDate)
                const dateKey = format(date, 'yyyy-MM-dd')
                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={cn('relative grid min-h-16 min-w-0 content-center place-items-center gap-0.5 rounded-2xl border border-(--line) bg-(--inner) px-1 py-2 text-(--text-3) transition-colors hover:border-(--line-2)', selected && 'border-transparent! bg-(--text)!')}
                    onClick={() => chooseDate(date)}
                    aria-pressed={selected}
                  >
                    <span className={cn('text-[.62rem] font-bold tracking-[.06em] uppercase', selected && 'text-(--text-4)')}>{format(date, 'EEE')}</span>
                    <strong className={cn('font-display text-[1.25rem] leading-none font-extrabold text-(--text) tabular-nums', selected && 'text-(--bg)')}>{format(date, 'd')}</strong>
                    {eventDateKeys.has(dateKey) && <i className="absolute bottom-1.75 h-1 w-1 rounded-full bg-(--pink)" />}
                  </button>
                )
              })}
            </div>

            <div className="flex items-end justify-between gap-3">
              <div className="grid gap-0.5">
                <p className="text-[.78rem] text-(--text-3)">{format(selectedDate, 'MMMM d, yyyy')}</p>
                <h2 className="text-[2rem]">{format(selectedDate, 'EEEE')}</h2>
              </div>
              <Pill>
                {selectedEvents.length
                  ? `${selectedEvents.length} ${selectedEvents.length === 1 ? 'event' : 'events'}`
                  : 'No plans yet'}
              </Pill>
            </div>

            {selectedEvents.length ? (
              <div className="grid gap-2.5">
                {selectedEvents.map((event) => {
                  const creator = data.members.find(
                    (member) => member.id === event.creatorId,
                  )
                  return (
                    <article key={event.id}>
                      <div
                        className="hh-inner grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 max-[760px]:grid-cols-[76px_minmax(0,1fr)] max-[760px]:gap-3 max-[420px]:grid-cols-1"
                        style={{
                          borderLeft: `3px solid ${event.kind === 'exam' ? 'var(--red)' : event.kind === 'class' ? 'var(--violet)' : 'var(--green)'}`,
                        }}
                      >
                        <div className="max-[420px]:flex max-[420px]:items-center max-[420px]:gap-1.5">
                          <strong className="block text-[.84rem] font-bold tabular-nums">
                            {event.allDay ? 'All day' : formatShortTime(event.startAt)}
                          </strong>
                          {!event.allDay && <span className="mt-0.5 block text-[.72rem] text-(--text-3) tabular-nums max-[420px]:m-0">to {formatShortTime(event.endAt)}</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="min-w-0 truncate text-[.92rem]">{event.title}</h3>
                            <Badge
                              tone={
                                event.kind === 'exam'
                                  ? 'red'
                                  : event.kind === 'class'
                                    ? 'violet'
                                    : 'green'
                              }
                            >
                              {event.kind}
                            </Badge>
                          </div>
                          <p className="mt-2 flex flex-wrap gap-2.5 text-(--text-3)">
                            {event.location && (
                              <span className="inline-flex items-center gap-1 text-[.72rem]"><MapPin size={14} /> {event.location}</span>
                            )}
                            <span className="inline-flex items-center gap-1 text-[.72rem]"><Users size={14} /> {event.audience}</span>
                          </p>
                          {event.imported
                            && event.scheduleItemId
                            && event.creatorId === data.household.currentMemberId && (
                              <select
                                className="mt-2 h-9 max-w-32 py-0 text-[.78rem]"
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
                                className="mt-2 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 [font:inherit] text-[.8rem] font-bold text-(--text-2) hover:text-(--text)"
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
                            imageUrl={creator.avatarUrl}
                            size="sm"
                          />
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={CalendarPlus}
                title="This day is open."
                description="Add a house event or import a class schedule."
                action={
                  <Button size="sm" onClick={() => setEventModal(true)}>
                    <Plus size={15} /> Add event
                  </Button>
                }
              />
            )}
          </Card>
        </div>
      )}

      {data.household.enabledFeatures.includes('courses') && (
        <>
          <SharedCourseSchedule />
          <Card className="pb-5">
          <CardHead title="Calendar imports" description={`${data.courses.length} imported course${data.courses.length === 1 ? '' : 's'}`} />
          <div className="grid grid-cols-3 gap-3 px-5 max-[980px]:grid-cols-2 max-[760px]:grid-cols-1 max-[640px]:px-3">
            {data.courses.map((course) => {
              const owner = data.members.find((member) => member.id === course.ownerMemberId)!
              return (
                <div className="hh-inner relative grid content-start gap-2 overflow-hidden p-4 pl-5" key={course.id}>
                  <div className="absolute inset-y-0 left-0 w-1" style={{ background: course.color }} />
                  <div className="flex items-center justify-between">
                    <span className="text-[.78rem] font-extrabold tracking-[.04em] text-(--violet)">{course.code}</span>
                    <Avatar initials={owner.initials} color={owner.color} imageUrl={owner.avatarUrl} size="sm" />
                  </div>
                  <strong className="text-[.9rem]">{course.name}</strong>
                  <span className="flex items-center gap-1.5 text-[.76rem] text-(--text-3)"><Clock3 size={14} /> {course.meetingLabel}</span>
                  {course.location && <span className="flex items-center gap-1.5 text-[.76rem] text-(--text-3)"><MapPin size={14} /> {course.location}</span>}
                  {course.ownerMemberId === data.household.currentMemberId && (
                    <button
                      type="button"
                      className="mt-1 inline-flex cursor-pointer items-center gap-1.5 justify-self-start border-0 bg-transparent p-0 [font:inherit] text-[.8rem] font-bold text-(--text-2) hover:text-(--text)"
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
                </div>
              )
            })}
            {!data.courses.length && (
              <EmptyState
                className="col-span-full"
                icon={GraduationCap}
                title="No imported courses"
                description="Import an .ics file and your classes land here."
              />
            )}
          </div>
          <div className="mx-5 mt-4 flex max-w-130 gap-2.5 rounded-2xl bg-(--violet-soft) px-4 py-3.5 text-(--violet) max-[640px]:mx-3">
            <GraduationCap size={18} className="shrink-0" />
            <div>
              <strong className="block text-[.82rem]">Full schedules are shared</strong>
              <span className="mt-0.5 block text-[.76rem] leading-relaxed opacity-85">Everyone in this house can see imported course details.</span>
            </div>
          </div>
          </Card>
        </>
      )}

      <Modal
        open={eventModal}
        onClose={() => setEventModal(false)}
        title="Add a household event"
        description="Everyone will see it unless you choose a smaller audience."
      >
        <form
          className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"
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
          <label className="col-span-full max-[640px]:col-[1]">Event name
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Parents visiting" required />
          </label>
          <label className="col-span-full flex items-center gap-2.5 py-2.5 text-[.84rem] font-semibold max-[640px]:col-[1]">
            <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
            All-day event
          </label>
          <label>Starts
            <input type={allDay ? 'date' : 'datetime-local'} value={start} onChange={(event) => setStart(event.target.value)} required />
          </label>
          <label>Ends
            <input type={allDay ? 'date' : 'datetime-local'} value={end} onChange={(event) => setEnd(event.target.value)} required />
          </label>
          <label className="col-span-full max-[640px]:col-[1]">Location
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
            <fieldset className="col-span-full grid gap-1 border-0 py-2 max-[640px]:col-[1]">
              <legend>Visible to</legend>
              <div className="mt-1 grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
                {data.members.map((member) => (
                  <label className="hh-inner flex cursor-pointer items-center gap-2.5 p-2.5 text-[.82rem] font-bold" key={member.id}>
                    <input
                      type="checkbox"
                      checked={audienceIds.includes(member.id)}
                      onChange={(event) => setAudienceIds((current) =>
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
            <legend>Reminders</legend>
            <div className="mt-1 grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
              {[
                [10080, '1 week'],
                [1440, '1 day'],
                [60, '1 hour'],
                [15, '15 minutes'],
              ].map(([offset, label]) => (
                <label className="hh-inner flex cursor-pointer items-center gap-2.5 p-2.5 text-[.82rem] font-bold" key={offset}>
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
          <div className="col-span-full mt-1.5 flex justify-end gap-2 max-[640px]:col-[1]">
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
          className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"
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
          <label className="col-span-full max-[640px]:col-[1]">Calendar file
            <input type="file" accept=".ics,text/calendar" onChange={(event) => setIcsFile(event.target.files?.[0])} />
          </label>
          <div className="form-divider relative col-span-full text-center text-[.75rem] text-(--text-3) before:absolute before:top-1/2 before:right-0 before:left-0 before:h-0.25 before:bg-(--line) before:content-[''] max-[640px]:col-[1]"><span className="relative bg-(--bg) px-2.25">or</span></div>
          <label className="col-span-full max-[640px]:col-[1]">Calendar URL
            <input type="url" value={icsUrl} onChange={(event) => setIcsUrl(event.target.value)} placeholder="https://university.example/schedule.ics" />
          </label>
          {importStatus && <div className="hh-inner col-span-full flex items-center justify-start gap-2 px-3.5 py-3 text-[.8rem] text-(--text-3) max-[640px]:col-[1]"><BookOpen size={17} /> {importStatus}</div>}
          <div className="col-span-full mt-1.5 flex justify-end gap-2 max-[640px]:col-[1]">
            <Button type="button" variant="ghost" onClick={() => setImportModal(false)}>Close</Button>
            <Button type="submit" disabled={!icsFile && !icsUrl}>Import schedule</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
