import { describe, expect, it } from 'vitest'
import {
  MI_CAMINO_ALERTS,
  attendanceMilestonesEarned,
  confirmedAttendanceCount,
  deriveContinuityAlerts,
  needsHumanCoachTask,
  recognitionQueue,
  selectPlanBFamily,
  shouldOfferAutomaticPlanB,
} from './rules.js'

describe('Mi Camino deterministic rules', () => {
  it('counts only confirmed attendance for milestones', () => {
    const rows = [
      { confirmed: true },
      { confirmed: false },
      { confirmed: true },
      { status: 'reserved' },
    ]
    expect(confirmedAttendanceCount(rows)).toBe(2)
    const earned = attendanceMilestonesEarned(rows, [
      { active: true, trigger_type: 'attendance_count', trigger_config: { count: 2 }, name: 'En marcha' },
      { active: true, trigger_type: 'attendance_count', trigger_config: { count: 10 }, name: 'Ritmo EVO' },
    ])
    expect(earned).toHaveLength(1)
    expect(earned[0].definition.name).toBe('En marcha')
  })

  it('requires disruption + frequency risk + 24h + no replacement for automatic Plan B', () => {
    const base = {
      disruptionType: 'cancelled',
      agreedWeeklyFrequency: 2,
      confirmedThisWeek: 0,
      futureReservationsThisWeek: 1,
      hoursSinceDisruption: 25,
      replacementReservationExists: false,
      safetyBlocked: false,
    }
    expect(shouldOfferAutomaticPlanB(base)).toBe(true)
    expect(shouldOfferAutomaticPlanB({ ...base, hoursSinceDisruption: 10 })).toBe(false)
    expect(shouldOfferAutomaticPlanB({ ...base, replacementReservationExists: true })).toBe(false)
    expect(shouldOfferAutomaticPlanB({ ...base, safetyBlocked: true })).toBe(false)
  })

  it('does not give a walk-style B1 by default to a stable advanced customer missing for schedule', () => {
    expect(selectPlanBFamily({ trainingLevel: 2, journeyDay: 55, disruptionReason: 'schedule' })).toBe('B2')
    expect(selectPlanBFamily({ trainingLevel: 3, journeyDay: 130, disruptionReason: 'schedule' })).toBe('B3')
    expect(selectPlanBFamily({ trainingLevel: 1, journeyDay: 15, disruptionReason: 'schedule' })).toBe('B1')
  })

  it('blocks automated training Plan B when safety is blocked', () => {
    expect(selectPlanBFamily({ trainingLevel: 3, journeyDay: 120, safetyBlocked: true })).toBe(null)
  })

  it('raises approved continuity alerts and routes them to a human task', () => {
    const now = new Date('2026-08-07T12:00:00Z')
    const alerts = deriveContinuityAlerts({
      now,
      lastAttendedAt: '2026-07-30T10:00:00Z',
      activePlanB: { offered_at: '2026-08-04T10:00:00Z' },
      planBOpenedOrBooked: false,
      consecutivePlanBWeeks: 2,
    })
    expect(alerts).toContain(MI_CAMINO_ALERTS.PLAN_B_UNRESOLVED_48H)
    expect(alerts).toContain(MI_CAMINO_ALERTS.NO_ATTENDANCE_7D)
    expect(alerts).toContain(MI_CAMINO_ALERTS.TWO_PLAN_B_WEEKS)
    expect(needsHumanCoachTask(alerts)).toBe(true)
  })

  it('limits public recognitions to two per class and defers the rest', () => {
    const queue = recognitionQueue([
      { id: 'a', status: 'earned', priority: 80, earned_at: '2026-08-01', public_recognition: true },
      { id: 'b', status: 'validated', priority: 90, earned_at: '2026-08-02', public_recognition: true },
      { id: 'c', status: 'deferred', priority: 70, earned_at: '2026-08-03', public_recognition: true },
    ])
    expect(queue.publicNow.map((x) => x.id)).toEqual(['b', 'a'])
    expect(queue.defer.map((x) => x.id)).toEqual(['c'])
  })
})
