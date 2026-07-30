import { useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarPlus,
  Clock3,
  FileUp,
  GraduationCap,
  MapPin,
  Plus,
  Users,
} from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { importIcs } from '../lib/api'
import { Avatar, Badge, Button, Card, Modal, SectionHeader } from '../components/ui'
import { formatShortTime, toIso } from '../lib/utils'

export function CalendarPage() {
  const { data, busy, addEvent } = useAppData()
  const [eventModal, setEventModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [location, setLocation] = useState('')
  const [icsUrl, setIcsUrl] = useState('')
  const [icsFile, setIcsFile] = useState<File | undefined>()
  const [importStatus, setImportStatus] = useState('')

  const days = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const groups = new Map<string, typeof data.events>()
    data.events.forEach((event) => {
      const key = new Date(event.startAt).toDateString()
      const current = groups.get(key) ?? []
      current.push(event)
      groups.set(key, current)
    })
    return [...groups.entries()].map(([key, events]) => ({
      key,
      label: formatter.format(new Date(key)),
      events,
    }))
  }, [data.events])

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">THE WHOLE HOUSE, IN SYNC</p>
          <h1>Calendar</h1>
          <p>Visits, exams and class schedules—shared with the right people.</p>
        </div>
        <div className="button-row">
          <Button variant="secondary" onClick={() => setImportModal(true)}>
            <FileUp size={18} /> Import .ics
          </Button>
          <Button onClick={() => setEventModal(true)}>
            <Plus size={18} /> Add event
          </Button>
        </div>
      </header>

      <div className="calendar-layout">
        <section>
          <SectionHeader eyebrow="AGENDA" title="Coming up" />
          <Card className="agenda-card">
            {days.map((day) => (
              <div className="agenda-day" key={day.key}>
                <div className="agenda-date">{day.label}</div>
                <div className="agenda-events">
                  {day.events.map((event) => {
                    const creator = data.members.find((member) => member.id === event.creatorId)!
                    return (
                      <div className={`agenda-event event-${event.kind}`} key={event.id}>
                        <div className="event-time">
                          <strong>{formatShortTime(event.startAt)}</strong>
                          <span>{formatShortTime(event.endAt)}</span>
                        </div>
                        <div className="event-marker" />
                        <div className="event-detail">
                          <div>
                            <strong>{event.title}</strong>
                            <Badge tone={event.kind === 'exam' ? 'red' : event.kind === 'class' ? 'blue' : 'green'}>
                              {event.kind}
                            </Badge>
                          </div>
                          <span>
                            {event.location && <><MapPin size={13} /> {event.location}</>}
                            <Users size={13} /> {event.audience}
                          </span>
                        </div>
                        <Avatar initials={creator.initials} color={creator.color} size="sm" />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </Card>
        </section>

        <aside>
          <SectionHeader eyebrow="COURSES" title="Roommate schedules" />
          <div className="course-list">
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
        </aside>
      </div>

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
              allDay: false,
              location: location.trim() || undefined,
              audience: 'everyone',
              audienceMemberIds: [],
              kind: 'household',
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
          <label>Starts
            <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required />
          </label>
          <label>Ends
            <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required />
          </label>
          <label className="field-span-2">Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Home" />
          </label>
          <div className="audience-preview field-span-2">
            <Users size={18} />
            Visible to everyone in {data.household.name}
          </div>
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
