import { useEffect, useMemo, useState, type SubmitEvent } from 'react'
import {
  Beaker,
  BookOpen,
  CalendarClock,
  Check,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Users,
} from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { cn } from '../lib/cn'
import { groupSharedCourseMeetings } from '../lib/sharedCourses'
import type {
  SharedCourse,
  SharedCourseAssessment,
  SharedCourseAssessmentKind,
  SharedCourseMeetingKind,
} from '../types'
import { Avatar, Badge, Button, Card, CardHead, EmptyState, Inner, Modal, Pill } from './ui'

const weekdays = [
  { value: 1 as const, short: 'Mon', label: 'Monday' },
  { value: 2 as const, short: 'Tue', label: 'Tuesday' },
  { value: 3 as const, short: 'Wed', label: 'Wednesday' },
  { value: 4 as const, short: 'Thu', label: 'Thursday' },
  { value: 5 as const, short: 'Fri', label: 'Friday' },
]

type Weekday = (typeof weekdays)[number]['value']
type MeetingDraft = {
  kind: SharedCourseMeetingKind
  weekday: Weekday
  startTime: string
  durationMinutes: number
  location: string
}
type AssessmentDraft = {
  key: string
  kind: SharedCourseAssessmentKind
  title: string
  startsAt: string
  durationMinutes: number
  location: string
}

export function SharedCourseSchedule() {
  const { data, busy, saveSharedCourse } = useAppData()
  const currentMemberId = data.household.currentMemberId
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    () => new Set(data.members.map((member) => member.id)),
  )
  const [selectedDay, setSelectedDay] = useState<Weekday>(() => {
    const day = new Date().getDay()
    return day >= 1 && day <= 5 ? day as Weekday : 1
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [courseId, setCourseId] = useState<string>()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState('#568742')
  const [meetings, setMeetings] = useState<MeetingDraft[]>([])
  const [assessments, setAssessments] = useState<AssessmentDraft[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setSelectedMembers((current) => {
      const activeIds = new Set(data.members.map((member) => member.id))
      const retained = new Set([...current].filter((id) => activeIds.has(id)))
      return retained.size ? retained : activeIds
    })
  }, [data.members])

  const openNew = () => {
    setCourseId(undefined)
    setCode('')
    setName('')
    setColor('#568742')
    setMeetings([])
    setAssessments([])
    setError('')
    setModalOpen(true)
  }

  const openCourse = (course: SharedCourse) => {
    const alreadyEnrolled = course.enrollmentMemberIds.includes(currentMemberId)
    const sourceMemberId = alreadyEnrolled
      ? currentMemberId
      : course.enrollmentMemberIds[0]
    setCourseId(course.id)
    setCode(course.code)
    setName(course.name)
    setColor(course.color)
    setMeetings(course.meetings
      .filter((meeting) => meeting.memberId === sourceMemberId)
      .map((meeting) => ({
        kind: meeting.kind,
        weekday: meeting.weekday,
        startTime: meeting.startTime,
        durationMinutes: meeting.durationMinutes,
        location: meeting.location ?? '',
      })))
    setAssessments(course.assessments
      .filter((assessment) => assessment.memberId === sourceMemberId)
      .map((assessment) => ({
        key: assessment.id,
        kind: assessment.kind,
        title: assessment.title,
        startsAt: toLocalDateTimeInput(assessment.startsAt),
        durationMinutes: assessment.durationMinutes,
        location: assessment.location ?? '',
      })))
    setError('')
    setModalOpen(true)
  }

  const toggleMeetingDay = (kind: SharedCourseMeetingKind, weekday: Weekday) => {
    setMeetings((current) => {
      const exists = current.some((meeting) => meeting.kind === kind && meeting.weekday === weekday)
      if (exists) return current.filter((meeting) => !(meeting.kind === kind && meeting.weekday === weekday))
      return [...current, { kind, weekday, startTime: '09:00', durationMinutes: 60, location: '' }]
    })
  }

  const updateMeeting = (
    kind: SharedCourseMeetingKind,
    weekday: Weekday,
    updates: Partial<MeetingDraft>,
  ) => setMeetings((current) => current.map((meeting) =>
    meeting.kind === kind && meeting.weekday === weekday
      ? { ...meeting, ...updates }
      : meeting,
  ))

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!meetings.length) {
      setError('Choose at least one lecture or lab day.')
      return
    }
    try {
      await saveSharedCourse({
        courseId,
        code: code.trim(),
        name: name.trim(),
        color,
        meetings: meetings.map((meeting) => ({ ...meeting, location: meeting.location || undefined })),
        assessments: assessments.map((assessment) => ({
          kind: assessment.kind,
          title: assessment.title.trim(),
          startsAt: new Date(assessment.startsAt).toISOString() as SharedCourseAssessment['startsAt'],
          durationMinutes: assessment.durationMinutes,
          location: assessment.location || undefined,
        })),
      })
      setModalOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this class.')
    }
  }

  const groupedMeetings = useMemo(() => {
    return groupSharedCourseMeetings(data.sharedCourses, selectedMembers)
  }, [data.sharedCourses, selectedMembers])

  const upcomingAssessments = useMemo(() => {
    const groups = new Map<string, {
      course: SharedCourse
      assessment: SharedCourseAssessment
      memberIds: string[]
    }>()
    for (const course of data.sharedCourses) {
      for (const assessment of course.assessments) {
        if (!selectedMembers.has(assessment.memberId)) continue
        const key = [course.id, assessment.kind, assessment.title, assessment.startsAt,
          assessment.durationMinutes, assessment.location ?? ''].join('|')
        const existing = groups.get(key)
        if (existing) existing.memberIds.push(assessment.memberId)
        else groups.set(key, { course, assessment, memberIds: [assessment.memberId] })
      }
    }
    return [...groups.values()]
      .filter(({ assessment }) => new Date(assessment.startsAt).getTime() >= Date.now() - 86_400_000)
      .sort((left, right) => left.assessment.startsAt.localeCompare(right.assessment.startsAt))
  }, [data.sharedCourses, selectedMembers])

  const selectedDayMeetings = groupedMeetings.filter((meeting) => meeting.weekday === selectedDay)
  const selectedDayLabel = weekdays.find((day) => day.value === selectedDay)!.label

  return (
    <>
      <Card className="pb-4">
        <CardHead
          title="Build your class list"
          description="Add your weekly lectures and labs, or join a class a roommate already entered."
          action={<Button size="sm" variant="secondary" onClick={openNew}><Plus size={15} /> Add class</Button>}
        />
        <div className="grid gap-2.5 px-5 max-[640px]:px-3">
          {data.sharedCourses.map((course) => {
            const enrolled = course.enrollmentMemberIds.includes(currentMemberId)
            return (
              <Inner className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5" key={course.id}>
                <span className="h-10 w-1 rounded-full" style={{ backgroundColor: course.color }} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[.92rem]">{course.code}</strong>
                    <Badge tone={enrolled ? 'green' : 'neutral'}>{enrolled ? 'Your class' : `${course.enrollmentMemberIds.length} enrolled`}</Badge>
                  </div>
                  <p className="mt-1 text-[.78rem] text-(--text-3)">{course.name}</p>
                  <div className="mt-2 flex items-center">
                    {course.enrollmentMemberIds.map((memberId) => {
                      const member = data.members.find((item) => item.id === memberId)
                      return member ? <Avatar className="-ml-1 first:ml-0" key={member.id} initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" /> : null
                    })}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => openCourse(course)}>
                  {enrolled ? <Pencil size={15} /> : <Plus size={15} />}
                  {enrolled ? 'Edit mine' : "I'm in this class"}
                </Button>
              </Inner>
            )
          })}
          {!data.sharedCourses.length && (
            <EmptyState
              icon={Users}
              title="No classes yet"
              description="Add your weekly lectures and labs so the house can see your week."
              action={<Button size="sm" onClick={openNew}><Plus size={15} /> Add the first class</Button>}
            />
          )}
        </div>
      </Card>

      <Card className="pb-5">
        <CardHead
          title="Everyone’s classes"
          description="Filter roommates, then pick a weekday for the combined agenda."
        />
        <div className="flex flex-wrap gap-x-5 gap-y-3 px-5 pb-4 max-[640px]:px-3" aria-label="Filter schedule by roommate">
          {data.members.map((member) => {
            const checked = selectedMembers.has(member.id)
            return (
              <label className="flex cursor-pointer items-center gap-2.25" key={member.id}>
                <input
                  className="peer sr-only"
                  type="checkbox"
                  checked={checked}
                  onChange={() => setSelectedMembers((current) => {
                    const next = new Set(current)
                    if (next.has(member.id)) next.delete(member.id)
                    else next.add(member.id)
                    return next
                  })}
                />
                <span className={cn('grid size-4.5 place-items-center rounded-md border border-(--line-2) bg-(--inner) text-transparent transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgba(59,107,255,.6)]', checked && 'border-(--text)! bg-(--text)! text-(--bg)!')}><Check size={12} strokeWidth={3} /></span>
                <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                <span className="text-[.78rem] font-bold">{member.displayName}</span>
              </label>
            )
          })}
        </div>

        <div className="overflow-x-auto border-y border-(--line)">
          <div className="grid min-w-225 grid-cols-5">
            {weekdays.map((day) => {
              const dayMeetings = groupedMeetings.filter((meeting) => meeting.weekday === day.value)
              return (
                <button
                  className={cn('min-h-52 border-0 border-l border-(--line) bg-transparent p-3 text-left transition-colors first:border-l-0 hover:bg-[rgba(255,255,255,.03)]', selectedDay === day.value && 'bg-[rgba(255,255,255,.04)]')}
                  type="button"
                  key={day.value}
                  onClick={() => setSelectedDay(day.value)}
                >
                  <span className="mb-3 block text-[.68rem] font-bold tracking-[.08em] text-(--text-3) uppercase">{day.label}</span>
                  <span className="grid gap-2">
                    {dayMeetings.map((meeting) => (
                      <span className="grid gap-1 rounded-xl border border-(--line) bg-(--card) p-2.5" style={{ boxShadow: `inset 3px 0 0 ${meeting.course.color}` }} key={`${meeting.course.id}-${meeting.kind}-${meeting.startTime}-${meeting.location}`}>
                        <strong className="pl-1.5 text-[.75rem]">{formatTime(meeting.startTime)} · {meeting.course.code}</strong>
                        <span className="pl-1.5 text-[.68rem] text-(--text-3) capitalize">{meeting.kind} · {meeting.durationMinutes} min</span>
                        <span className="flex items-center">
                          {meeting.memberIds.map((memberId) => {
                            const member = data.members.find((item) => item.id === memberId)
                            return member ? <Avatar className="-ml-1 first:ml-0" key={member.id} initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" /> : null
                          })}
                        </span>
                      </span>
                    ))}
                    {!dayMeetings.length && <span className="py-8 text-center text-[.72rem] text-(--text-3)">No classes</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-5 pt-5 max-[640px]:px-3">
          <div className="mb-2 flex items-end justify-between gap-3 pb-2">
            <div className="grid gap-0.5">
              <p className="text-[.7rem] font-bold tracking-[.06em] text-(--text-3) uppercase">Day view</p>
              <h3 className="text-[1.35rem] font-extrabold tracking-[-.02em]">{selectedDayLabel}</h3>
            </div>
            <Pill>{selectedDayMeetings.length} session{selectedDayMeetings.length === 1 ? '' : 's'}</Pill>
          </div>
          <div className="grid">
            {selectedDayMeetings.map((meeting) => (
              <div className="grid min-h-18 grid-cols-[84px_1fr_auto] items-center gap-4 border-t border-(--line) py-3 first:border-t-0" key={`day-${meeting.course.id}-${meeting.kind}-${meeting.startTime}-${meeting.location}`}>
                <strong className="font-sans text-[.84rem] tabular-nums">{formatTime(meeting.startTime)}</strong>
                <div>
                  <div className="flex items-center gap-2"><strong className="text-[.88rem]">{meeting.course.code}</strong><Badge tone={meeting.kind === 'lab' ? 'violet' : 'green'}>{meeting.kind}</Badge></div>
                  <p className="mt-1 flex flex-wrap gap-3 text-[.74rem] text-(--text-3)"><span className="inline-flex items-center gap-1"><Clock3 size={13} /> {meeting.durationMinutes} minutes</span>{meeting.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {meeting.location}</span>}</p>
                </div>
                <div className="flex">
                  {meeting.memberIds.map((memberId) => {
                    const member = data.members.find((item) => item.id === memberId)
                    return member ? <Avatar className="-ml-1 first:ml-0" key={member.id} initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" /> : null
                  })}
                </div>
              </div>
            ))}
            {!selectedDayMeetings.length && <EmptyState title="No classes this day" description="No selected roommates have classes on this weekday." />}
          </div>
        </div>

        {upcomingAssessments.length > 0 && (
          <div className="px-5 pt-6 max-[640px]:px-3">
            <div className="mb-2 grid gap-0.5 pb-2">
              <p className="text-[.7rem] font-bold tracking-[.06em] text-(--text-3) uppercase">Upcoming</p>
              <h3 className="text-[1.35rem] font-extrabold tracking-[-.02em]">Midterms &amp; exams</h3>
            </div>
            <div className="grid">
              {upcomingAssessments.map(({ course, assessment, memberIds }) => (
                <div className="grid min-h-22 grid-cols-[120px_1fr_auto] items-center gap-4 border-b border-(--line) py-3 max-[560px]:grid-cols-[1fr_auto]" key={`${course.id}-${assessment.kind}-${assessment.startsAt}-${assessment.title}`}>
                  <strong className="font-sans text-[.8rem] tabular-nums max-[560px]:col-span-2">{formatAssessmentDate(assessment.startsAt)}</strong>
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><strong className="text-[.88rem]">{course.code} · {assessment.title}</strong><Badge tone={assessment.kind === 'exam' ? 'red' : 'violet'}>{assessment.kind}</Badge></div>
                    <p className="mt-1 flex flex-wrap gap-3 text-[.74rem] text-(--text-3)"><span className="inline-flex items-center gap-1"><Clock3 size={13} /> {assessment.durationMinutes} minutes</span>{assessment.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {assessment.location}</span>}</p>
                  </div>
                  <div className="flex">
                    {memberIds.map((memberId) => {
                      const member = data.members.find((item) => item.id === memberId)
                      return member ? <Avatar className="-ml-1 first:ml-0" key={member.id} initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" /> : null
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={courseId ? 'Your class schedule' : 'Add a class'} description="Lectures and labs can occur on the same day. Add a time and duration for every selected day.">
        <form className="grid gap-6" onSubmit={submit}>
          <div className="grid grid-cols-[.55fr_1.45fr_auto] gap-3 max-[640px]:grid-cols-1">
            <label>Course code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="CSC 209" required readOnly={Boolean(courseId)} /></label>
            <label>Class name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Software Tools & Systems" required readOnly={Boolean(courseId && data.sharedCourses.find((course) => course.id === courseId)?.createdByMemberId !== currentMemberId)} /></label>
            <label>Color<input className="min-h-11 w-full min-w-20 p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
          </div>

          {(['lecture', 'lab'] as const).map((kind) => (
            <fieldset className="border-0 border-t border-(--line) p-0 pt-5" key={kind}>
              <legend className="flex items-center gap-2 text-[.9rem] font-extrabold capitalize">{kind === 'lecture' ? <BookOpen size={17} /> : <Beaker size={17} />}{kind}s</legend>
              <p className="mt-1 text-[.74rem] text-(--text-3)">Choose every weekday this {kind} meets.</p>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {weekdays.map((day) => {
                  const active = meetings.some((meeting) => meeting.kind === kind && meeting.weekday === day.value)
                  return <button aria-pressed={active} className={cn('min-h-10 rounded-[7px] border border-(--line) bg-transparent text-[.76rem] font-bold text-(--text-3)', active && 'border-(--forest)! bg-(--forest)! text-white!')} type="button" key={day.value} onClick={() => toggleMeetingDay(kind, day.value)}>{day.short}</button>
                })}
              </div>
              <div className="mt-3 grid gap-3">
                {meetings.filter((meeting) => meeting.kind === kind).sort((a, b) => a.weekday - b.weekday).map((meeting) => (
                  <div className="grid grid-cols-[90px_1fr_110px_1fr] items-end gap-3 border-b border-(--line) pb-3 max-[640px]:grid-cols-2" key={`${kind}-${meeting.weekday}`}>
                    <strong className="self-center text-[.78rem]">{weekdays.find((day) => day.value === meeting.weekday)!.label}</strong>
                    <label>Starts<input type="time" value={meeting.startTime} onChange={(event) => updateMeeting(kind, meeting.weekday, { startTime: event.target.value })} required /></label>
                    <label>Minutes<input type="number" min="5" max="720" step="5" value={meeting.durationMinutes} onChange={(event) => updateMeeting(kind, meeting.weekday, { durationMinutes: Number(event.target.value) })} required /></label>
                    <label>Location <span className="text-(--text-3)">Optional</span><input value={meeting.location} onChange={(event) => updateMeeting(kind, meeting.weekday, { location: event.target.value })} placeholder="Room" /></label>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset className="border-0 border-t border-(--line) p-0 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div><legend className="flex items-center gap-2 text-[.9rem] font-extrabold"><CalendarClock size={17} /> Midterms & exams</legend><p className="mt-1 text-[.74rem] text-(--text-3)">Optional now; add or edit these whenever dates are announced.</p></div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setAssessments((current) => [...current, { key: crypto.randomUUID(), kind: 'midterm', title: 'Midterm', startsAt: '', durationMinutes: 120, location: '' }])}><Plus size={15} /> Add</Button>
            </div>
            <div className="mt-3 grid gap-3">
              {assessments.map((assessment) => (
                <div className="grid grid-cols-[110px_1fr_1.1fr_100px_1fr] gap-2 border-b border-(--line) pb-3 max-[760px]:grid-cols-2" key={assessment.key}>
                  <label>Type<select value={assessment.kind} onChange={(event) => setAssessments((current) => current.map((item) => item.key === assessment.key ? { ...item, kind: event.target.value as SharedCourseAssessmentKind } : item))}><option value="midterm">Midterm</option><option value="exam">Exam</option></select></label>
                  <label>Title<input value={assessment.title} onChange={(event) => setAssessments((current) => current.map((item) => item.key === assessment.key ? { ...item, title: event.target.value } : item))} required /></label>
                  <label>Date & time<input type="datetime-local" value={assessment.startsAt} onChange={(event) => setAssessments((current) => current.map((item) => item.key === assessment.key ? { ...item, startsAt: event.target.value } : item))} required /></label>
                  <label>Minutes<input type="number" min="5" max="720" step="5" value={assessment.durationMinutes} onChange={(event) => setAssessments((current) => current.map((item) => item.key === assessment.key ? { ...item, durationMinutes: Number(event.target.value) } : item))} required /></label>
                  <label>Location<input value={assessment.location} onChange={(event) => setAssessments((current) => current.map((item) => item.key === assessment.key ? { ...item, location: event.target.value } : item))} /></label>
                </div>
              ))}
            </div>
          </fieldset>

          {error && <p className="text-[.76rem] font-bold text-[#ff8080]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy?.startsWith('shared-course:save')}><Users size={17} /> Save my schedule</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function formatTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(2000, 0, 1, hour, minute))
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatAssessmentDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
