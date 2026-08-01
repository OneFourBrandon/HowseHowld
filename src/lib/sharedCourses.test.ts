import { describe, expect, it } from 'vitest'
import type { SharedCourse } from '../types'
import { groupSharedCourseMeetings } from './sharedCourses'

const course: SharedCourse = {
  id: 'course-1',
  code: 'CSC 209',
  name: 'Software Tools & Systems',
  color: '#568742',
  createdByMemberId: 'member-a',
  enrollmentMemberIds: ['member-a', 'member-b'],
  meetings: [
    { id: 'meeting-1', memberId: 'member-a', kind: 'lecture', weekday: 2, startTime: '10:00', durationMinutes: 60 },
    { id: 'meeting-2', memberId: 'member-b', kind: 'lecture', weekday: 2, startTime: '10:00', durationMinutes: 60 },
    { id: 'meeting-3', memberId: 'member-a', kind: 'lab', weekday: 2, startTime: '10:00', durationMinutes: 60 },
  ],
  assessments: [],
}

describe('shared household class schedule', () => {
  it('combines identical roommate sessions without combining lectures and labs', () => {
    const groups = groupSharedCourseMeetings([course], new Set(['member-a', 'member-b']))
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ kind: 'lecture', memberIds: ['member-a', 'member-b'] })
    expect(groups[1]).toMatchObject({ kind: 'lab', memberIds: ['member-a'] })
  })

  it('honours the household member filters', () => {
    const groups = groupSharedCourseMeetings([course], new Set(['member-b']))
    expect(groups).toHaveLength(1)
    expect(groups[0].memberIds).toEqual(['member-b'])
  })
})
