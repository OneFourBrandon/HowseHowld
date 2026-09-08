import { cn } from '../lib/cn'
import './two-tone.css'
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
    <div className="calendar-page page-stack grid gap-8">
      <header className="page-header flex items-end justify-between gap-10 pb-7.5 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-5.5 max-[640px]:pb-4.5">
        <div className="grid gap-3.75">
          <h1 className="page-title">Calendar</h1>
          <p>Visits, exams and class schedules—shared with the right people.</p>
        </div>
        <div className="button-row flex flex-wrap items-center gap-2.25 max-[640px]:w-full">
          {data.household.enabledFeatures.includes('courses') && <Button className="max-[640px]:min-w-0 max-[640px]:flex-1 max-[640px]:px-2.5 max-[640px]:text-[.72rem]" variant="secondary" onClick={() => setImportModal(true)}>
            <FileUp size={18} /> Import .ics
          </Button>}
          {data.household.enabledFeatures.includes('calendar') && <Button className="max-[640px]:min-w-0 max-[640px]:flex-1 max-[640px]:px-2.5 max-[640px]:text-[.72rem]" onClick={() => setEventModal(true)}>
            <Plus size={18} /> Add event
          </Button>}
        </div>
      </header>

      {data.household.enabledFeatures.includes('calendar') && (
        <div className={"calendar-workspace grid grid-cols-[minmax(310px,.72fr)_minmax(460px,1.28fr)] gap-[clamp(42px,6vw,82px)] p-[36px_0_44px] border-t border-t-(--line) border-b border-b-(--line) max-[980px]:grid-cols-[minmax(260px,.75fr)_minmax(390px,1.25fr)] max-[980px]:gap-9 max-[760px]:grid-cols-1 max-[760px]:gap-9 max-[760px]:pt-6.25"}>
          <section className={"month-browser pr-[clamp(28px,4vw,52px)] border-r border-r-(--line) max-[980px]:pr-8 max-[760px]:p-[0_0_32px] max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:border-b-(--line)"} aria-label="Month calendar">
            <div className="month-browser-header mb-7 flex items-center justify-between">
              <div>
                <span className="text-[.78rem] font-[650] text-(--muted)">{format(visibleMonth, 'yyyy')}</span>
                <h2 className="mt-0.75 text-[2rem] text-(--forest) max-[420px]:text-[1.75rem]">{format(visibleMonth, 'MMMM')}</h2>
              </div>
              <div className="month-controls flex gap-1.25">
                <button
                  className="grid h-9.5 w-9.5 place-items-center rounded-full border border-(--line) bg-transparent text-(--forest) hover:border-(--forest-2) hover:bg-(--sage-2)"
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
                >
                  <ChevronLeft />
                </button>
                <button
                  className="grid h-9.5 w-9.5 place-items-center rounded-full border border-(--line) bg-transparent text-(--forest) hover:border-(--forest-2) hover:bg-(--sage-2)"
                  type="button"
                  aria-label="Next month"
                  onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
            <div className="month-weekdays mb-2 grid grid-cols-7" aria-hidden="true">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <span className="text-center text-[.68rem] font-[750] uppercase text-(--muted)" key={day}>{day}</span>
              ))}
            </div>
            <div className={"month-grid grid grid-cols-7 max-[760px]:max-w-107.5 max-[760px]:mx-auto"}>
              {calendarDays.map((date) => {
                const dateKey = format(date, 'yyyy-MM-dd')
                const selected = isSameDay(date, selectedDate)
                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={cn(
                      "month-day relative grid aspect-square min-w-0 place-items-center rounded-[10px] border-0 bg-transparent text-[.8rem] text-(--ink) tabular-nums hover:bg-(--sage-2) max-[420px]:rounded-lg max-[420px]:text-[.76rem]",
                      !isSameMonth(date, visibleMonth) && 'is-outside text-[#a8ada9]',
                      selected && 'is-selected border-(--forest)! bg-(--forest)! text-white! shadow-[0_7px_18px_rgba(43,75,31,.18)]',
                      isSameDay(date, new Date()) && 'is-today',
                      eventDateKeys.has(dateKey) && "has-events after:absolute after:bottom-1.25 after:h-1 after:w-1 after:rounded-full after:bg-(--gold) after:content-['']",
                      selected && eventDateKeys.has(dateKey) && 'after:bg-[#f5dda7]',
                    )}
                    aria-label={format(date, 'EEEE, MMMM d, yyyy')}
                    aria-pressed={selected}
                    onClick={() => chooseDate(date)}
                  >
                    <span className={cn(isSameDay(date, new Date()) && 'underline decoration-2 decoration-(--gold) underline-offset-4')}>{format(date, 'd')}</span>
                  </button>
                )
              })}
            </div>
            <button
              className={"calendar-today-button mt-6 p-[8px_0] inline-flex items-center gap-1.75 border-0 text-(--forest-2) bg-transparent text-[.76rem] font-[750]"}
              type="button"
              onClick={() => chooseDate(new Date())}
            >
              <CalendarDays size={16} /> Jump to today
            </button>
          </section>

          <section className={"selected-agenda"} aria-label="Selected day agenda">
            <div className="calendar-day-strip mb-9 grid grid-cols-7 gap-1.75 max-[760px]:-mx-1 max-[760px]:gap-0.75">
              {selectedWeek.map((date) => {
                const selected = isSameDay(date, selectedDate)
                const dateKey = format(date, 'yyyy-MM-dd')
                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={cn('relative grid min-h-17 min-w-0 content-center place-items-center gap-1 rounded-[11px] border bg-transparent px-0.75 py-2.25 text-(--muted) hover:border-(--line) hover:bg-(--sage-2) max-[760px]:min-h-15.25 max-[760px]:rounded-lg', selected && 'is-selected border-(--forest)! bg-(--forest)! text-white! shadow-[0_9px_22px_rgba(43,75,31,.18)]')}
                    onClick={() => chooseDate(date)}
                    aria-pressed={selected}
                  >
                    <span className="text-[.64rem] font-[750] uppercase max-[420px]:text-[.55rem]">{format(date, 'EEE')}</span>
                    <strong className={cn('text-[1rem] text-(--ink) tabular-nums max-[420px]:text-[.88rem]', selected && 'text-white')}>{format(date, 'd')}</strong>
                    {eventDateKeys.has(dateKey) && <i className="absolute bottom-1.25 h-1 w-1 rounded-full bg-(--gold)" />}
                  </button>
                )
              })}
            </div>

            <div className="selected-day-heading grid grid-cols-[1fr_auto] items-end border-b border-b-(--line) pb-4.75">
              <p className="col-span-full mb-1 text-[.76rem] text-(--muted)">{format(selectedDate, 'MMMM d, yyyy')}</p>
              <h2 className="text-[clamp(2rem,3vw,2.8rem)] max-[420px]:text-[2rem]">{format(selectedDate, 'EEEE')}</h2>
              <span className="pb-1 text-[.76rem] font-[650] text-(--muted)">
                {selectedEvents.length
                  ? `${selectedEvents.length} ${selectedEvents.length === 1 ? 'event' : 'events'}`
                  : 'No plans yet'}
              </span>
            </div>

            {selectedEvents.length ? (
              <div className={"calendar-timeline pt-4.25"}>
                {selectedEvents.map((event) => {
                  const creator = data.members.find(
                    (member) => member.id === event.creatorId,
                  )
                  return (
                    <article
                      className={cn(
                        'calendar-timeline-item grid grid-cols-[20px_minmax(0,1fr)] gap-3.25',
                        event.kind === 'class' && 'event-class',
                        event.kind === 'exam' && 'event-exam',
                      )}
                      key={event.id}
                    >
                      <div className="calendar-timeline-rail relative flex justify-center after:absolute after:top-6.25 after:-bottom-0.25 after:w-0.25 after:bg-[#a8cf9a] after:content-['']">
                        <span className={cn('relative z-1 mt-5.5 h-2.5 w-2.5 rounded-full border-2 border-(--surface) bg-(--green) shadow-[0_0_0_1px_var(--green)]', event.kind === 'class' && 'bg-(--blue)! shadow-[0_0_0_1px_var(--blue)]', event.kind === 'exam' && 'bg-(--coral)! shadow-[0_0_0_1px_var(--coral)]')} />
                      </div>
                      <div className={cn('calendar-event-block mb-2.5 grid min-h-23 grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-4.25 rounded-[5px] border-l-[3px] border-l-(--green) bg-[#eaf4e6] dark:bg-(--green-soft) p-[17px_18px] max-[760px]:grid-cols-[76px_minmax(0,1fr)] max-[760px]:gap-3 max-[420px]:grid-cols-1', event.kind === 'class' && 'border-(--blue) bg-(--blue-soft)!', event.kind === 'exam' && 'border-(--coral) bg-(--coral-soft)!')}>
                        <div className="calendar-event-time max-[420px]:flex max-[420px]:items-center max-[420px]:gap-1.5">
                          <strong className="block text-[.76rem] tabular-nums">
                            {event.allDay ? 'All day' : formatShortTime(event.startAt)}
                          </strong>
                          {!event.allDay && <span className="mt-1 block text-[.68rem] text-(--muted) tabular-nums max-[420px]:m-0">to {formatShortTime(event.endAt)}</span>}
                        </div>
                        <div className="calendar-event-copy min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="overflow-hidden text-[.9rem] text-ellipsis whitespace-nowrap">{event.title}</h3>
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
                          <p className="mt-2 flex flex-wrap gap-2.5 text-(--muted)">
                            {event.location && (
                              <span className="inline-flex items-center gap-1 text-[.72rem]"><MapPin size={14} /> {event.location}</span>
                            )}
                            <span className="inline-flex items-center gap-1 text-[.72rem]"><Users size={14} /> {event.audience}</span>
                          </p>
                          {event.imported
                            && event.scheduleItemId
                            && event.creatorId === data.household.currentMemberId && (
                              <select
                                className={"event-kind-select max-w-30 min-h-8.5 mt-2 py-1"}
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
                                className={"inline-link inline-flex items-center gap-1.5 border-0 p-[4px_0] bg-transparent text-(--forest) [font:inherit] text-[.82rem] font-bold cursor-pointer"}
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
              <div className="calendar-empty-day grid min-h-55 content-center place-items-center gap-2 text-center text-(--muted)">
                <CalendarPlus className="mb-1.5 text-(--forest-2)" />
                <strong className="text-[1rem] text-(--ink)">This day is open.</strong>
                <span className="text-[.78rem]">Add a house event or import a class schedule.</span>
                <Button className="mt-2.5" size="sm" onClick={() => setEventModal(true)}>
                  <Plus size={16} /> Add event
                </Button>
              </div>
            )}
          </section>
        </div>
      )}

      {data.household.enabledFeatures.includes('courses') && (
        <section className="calendar-courses-section pt-1.5">
          <SharedCourseSchedule />
          <div className="calendar-imports mt-6">
          <SectionHeader eyebrow="IMPORTED COURSES" title="Calendar imports" />
          <div className={"course-list grid gap-0 calendar-course-grid grid-cols-3 max-[980px]:grid-cols-2 max-[760px]:grid-cols-1"}>
            {data.courses.map((course) => {
              const owner = data.members.find((member) => member.id === course.ownerMemberId)!
              return (
                <Card className="course-card relative grid min-h-36.5 gap-2 overflow-hidden border-b border-b-(--line) p-[24px_4px_24px_22px] max-[640px]:min-h-33" key={course.id}>
                  <div className={"course-stripe absolute inset-[0_auto_0_0] w-0.75"} style={{ background: course.color }} />
                  <div className={"course-heading flex items-center justify-between"}>
                    <span className={"course-code text-(--blue) font-[850] text-[.76rem] tracking-[.035em]"}>{course.code}</span>
                    <Avatar initials={owner.initials} color={owner.color} imageUrl={owner.avatarUrl} size="sm" />
                  </div>
                  <strong className="text-[.9rem]">{course.name}</strong>
                  <span className="flex items-center gap-1.25 text-[.75rem] leading-[1.5] text-(--muted)"><Clock3 size={14} /> {course.meetingLabel}</span>
                  {course.location && <span className="flex items-center gap-1.25 text-[.75rem] leading-[1.5] text-(--muted)"><MapPin size={14} /> {course.location}</span>}
                  {course.ownerMemberId === data.household.currentMemberId && (
                    <button
                      type="button"
                      className={"inline-link inline-flex items-center gap-1.5 border-0 p-[4px_0] bg-transparent text-(--forest) [font:inherit] text-[.82rem] font-bold cursor-pointer"}
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
          <Card className="privacy-note mt-7 flex max-w-130 gap-2.5 border-0 border-l-[3px] border-l-(--blue) bg-transparent py-4.25 pl-3.75 text-[#465987] dark:text-(--blue)">
            <GraduationCap />
            <div>
              <strong className="block text-[.82rem]">Full schedules are shared</strong>
              <span className="mt-0.75 block text-[.75rem] leading-[1.5]">Everyone in this house can see imported course details.</span>
            </div>
          </Card>
          </div>
        </section>
      )}

      <Modal
        open={eventModal}
        onClose={() => setEventModal(false)}
        title="Add a household event"
        description="Everyone will see it unless you choose a smaller audience."
      >
        <form
          className={"form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"}
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
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Event name
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Parents visiting" required />
          </label>
          <label className={"checkbox-field flex items-center gap-2 p-[10px_0] field-span-2 col-span-full max-[640px]:col-[1]"}>
            <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
            All-day event
          </label>
          <label>Starts
            <input type={allDay ? 'date' : 'datetime-local'} value={start} onChange={(event) => setStart(event.target.value)} required />
          </label>
          <label>Ends
            <input type={allDay ? 'date' : 'datetime-local'} value={end} onChange={(event) => setEnd(event.target.value)} required />
          </label>
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Location
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
            <fieldset className={"field-span-2 col-span-full max-[640px]:col-[1] compact-options py-[8px_14px] border-0 border-b border-b-(--line)"}>
              <legend>Visible to</legend>
              <div className={"member-check-grid grid grid-cols-2 gap-2 max-[640px]:grid-cols-1"}>
                {data.members.map((member) => (
                  <label className="member-check flex items-center gap-1.75 rounded-[10px] border border-(--line) bg-(--surface-strong) p-2.25" key={member.id}>
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
          <fieldset className={"field-span-2 col-span-full max-[640px]:col-[1] compact-options py-[8px_14px] border-0 border-b border-b-(--line)"}>
            <legend>Reminders</legend>
            <div className={"member-check-grid grid grid-cols-2 gap-2 max-[640px]:grid-cols-1"}>
              {[
                [10080, '1 week'],
                [1440, '1 day'],
                [60, '1 hour'],
                [15, '15 minutes'],
              ].map(([offset, label]) => (
                <label className="member-check flex items-center gap-1.75 rounded-[10px] border border-(--line) bg-(--surface-strong) p-2.25" key={offset}>
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
          <div className={"modal-actions flex justify-end gap-2.25 mt-1.5 field-span-2 col-span-full max-[640px]:col-[1]"}>
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
          className={"form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"}
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
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Calendar file
            <input type="file" accept=".ics,text/calendar" onChange={(event) => setIcsFile(event.target.files?.[0])} />
          </label>
          <div className="form-divider relative col-span-full text-center text-[.75rem] text-(--muted) before:absolute before:top-1/2 before:right-0 before:left-0 before:h-0.25 before:bg-(--line) before:content-[''] max-[640px]:col-[1]"><span className="relative bg-(--surface) px-2.25">or</span></div>
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Calendar URL
            <input type="url" value={icsUrl} onChange={(event) => setIcsUrl(event.target.value)} placeholder="https://university.example/schedule.ics" />
          </label>
          {importStatus && <div className={"import-status p-[11px_13px] flex items-center rounded-[10px] text-[#5d6b64] bg-(--sage-2) justify-start gap-2 text-[.78rem] field-span-2 col-span-full max-[640px]:col-[1]"}><BookOpen size={17} /> {importStatus}</div>}
          <div className={"modal-actions flex justify-end gap-2.25 mt-1.5 field-span-2 col-span-full max-[640px]:col-[1]"}>
            <Button type="button" variant="ghost" onClick={() => setImportModal(false)}>Close</Button>
            <Button type="submit" disabled={!icsFile && !icsUrl}>Import schedule</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
