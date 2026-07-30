import { describe, expect, it } from 'vitest'
import ICAL from 'ical.js'

describe('course calendar recurrence', () => {
  it('preserves UID, timezone, recurrence, and exceptions', () => {
    const parsed = ICAL.parse(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:course-101@example.test
DTSTART;TZID=America/Toronto:20260908T090000
DTEND;TZID=America/Toronto:20260908T100000
RRULE:FREQ=WEEKLY;BYDAY=TU,TH
EXDATE;TZID=America/Toronto:20261013T090000
SUMMARY:Course 101
END:VEVENT
END:VCALENDAR`)
    const event = new ICAL.Component(parsed).getFirstSubcomponent('vevent')
    if (!event) throw new Error('VEVENT was not parsed')
    const recurrence = event.getFirstPropertyValue('rrule') as ICAL.Recur

    expect(event.getFirstPropertyValue('uid')).toBe('course-101@example.test')
    expect(event.getFirstProperty('dtstart')?.getParameter('tzid')).toBe(
      'America/Toronto',
    )
    expect(recurrence.toString()).toContain('FREQ=WEEKLY')
    expect(event.getAllProperties('exdate')).toHaveLength(1)
  })
})
