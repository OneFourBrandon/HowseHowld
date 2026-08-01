import type { SharedCourse, SharedCourseMeetingKind, UUID } from '../types'

export interface GroupedCourseMeeting {
  course: SharedCourse
  kind: SharedCourseMeetingKind
  weekday: 1 | 2 | 3 | 4 | 5
  startTime: string
  durationMinutes: number
  location?: string
  memberIds: UUID[]
}

export function groupSharedCourseMeetings(
  courses: SharedCourse[],
  selectedMemberIds: ReadonlySet<UUID>,
): GroupedCourseMeeting[] {
  const groups = new Map<string, GroupedCourseMeeting>()

  for (const course of courses) {
    for (const meeting of course.meetings) {
      if (!selectedMemberIds.has(meeting.memberId)) continue
      const key = [course.id, meeting.kind, meeting.weekday, meeting.startTime,
        meeting.durationMinutes, meeting.location ?? ''].join('|')
      const existing = groups.get(key)
      if (existing) {
        if (!existing.memberIds.includes(meeting.memberId)) existing.memberIds.push(meeting.memberId)
      } else {
        groups.set(key, {
          course,
          kind: meeting.kind,
          weekday: meeting.weekday,
          startTime: meeting.startTime,
          durationMinutes: meeting.durationMinutes,
          location: meeting.location,
          memberIds: [meeting.memberId],
        })
      }
    }
  }

  return [...groups.values()].sort((left, right) => {
    const dayOrder = left.weekday - right.weekday
    return dayOrder || left.startTime.localeCompare(right.startTime)
  })
}
