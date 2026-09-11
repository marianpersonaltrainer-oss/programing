import { expect, it } from 'vitest'
import { auditWodBusterScheduleJoin as audit } from './wodBusterScheduleJoinAudit.js'
const booking = { date: '2026-09-11', time: '18:00', className: 'Basics', privateName: 'Never return this' }
const session = { ...booking, coachReference: 'fictional-coach' }
it('counts exact date/time/class candidates without returning people or assignments', () => {
  const result = audit({ sessions: [session], bookings: [booking] })
  expect(result.uniqueCandidates).toBe(1)
  expect(JSON.stringify(result)).not.toContain('fictional-coach')
  expect(JSON.stringify(result)).not.toContain('Never return this')
})
it('blocks duplicate sessions even if the coach is the same', () => {
  const result = audit({ sessions: [session, session], bookings: [booking] })
  expect(result.ambiguous).toBe(1)
  expect(result.uniqueCandidates).toBe(0)
})
it('does not match another day, time or class by approximation', () => {
  const result = audit({ sessions: [session], bookings: [{ ...booking, date: '2026-09-12' }, { ...booking, time: '19:00' }, { ...booking, className: 'basic' }] })
  expect(result.unmatched).toBe(3)
})
it('blocks a missing coach instead of reusing an earlier assignment', () => {
  expect(audit({ sessions: [{ ...session, coachReference: '' }], bookings: [booking] }).missingCoach).toBe(1)
})
it('rejects unverified raw date/time formats and impossible dates', () => {
  const result = audit({ sessions: [session], bookings: [{ ...booking, date: '11/09/2026' }, { ...booking, date: '2026-02-30' }, { ...booking, time: '25:00' }] })
  expect(result.invalidBookings).toBe(3)
  expect(result.uniqueCandidates).toBe(0)
})
it('does not silently interpret an invalid response as an empty schedule', () => {
  expect(() => audit({ sessions: {}, bookings: [] })).toThrow('normalized_arrays_required')
})
