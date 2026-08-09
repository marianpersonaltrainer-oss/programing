const DAY_MS = 24 * 60 * 60 * 1000

export const MI_CAMINO_ALERTS = Object.freeze({
  PLAN_B_UNRESOLVED_48H: 'plan_b_unresolved_48h',
  NO_ATTENDANCE_7D: 'no_attendance_7d',
  TWO_PLAN_B_WEEKS: 'two_plan_b_weeks',
  NO_ATTENDANCE_14D: 'no_attendance_14d',
  SENSITIVE_CHECKIN: 'sensitive_checkin',
})

export function daysBetween(earlier, later = new Date()) {
  if (!earlier) return null
  const a = new Date(earlier).getTime()
  const b = new Date(later).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.max(0, Math.floor((b - a) / DAY_MS))
}

export function confirmedAttendanceCount(attendanceRows = []) {
  return attendanceRows.filter((row) => row?.confirmed === true).length
}

/** Attendance milestones never count reservations or Plan B completions. */
export function attendanceMilestonesEarned(attendanceRows = [], definitions = []) {
  const count = confirmedAttendanceCount(attendanceRows)
  return definitions
    .filter((def) => def?.active !== false && def?.trigger_type === 'attendance_count')
    .filter((def) => {
      const target = Number(def?.trigger_config?.count)
      return Number.isFinite(target) && target > 0 && count >= target
    })
    .map((def) => ({ definition: def, evidence: { attendance_count: count, target: Number(def.trigger_config.count) } }))
}

export function projectedFrequencyAtRisk({
  agreedWeeklyFrequency,
  confirmedThisWeek = 0,
  futureReservationsThisWeek = 0,
}) {
  const target = Number(agreedWeeklyFrequency)
  if (!Number.isFinite(target) || target <= 0) return false
  return Number(confirmedThisWeek || 0) + Number(futureReservationsThisWeek || 0) < target
}

/**
 * Approved automatic Plan B trigger:
 * cancellation/no-show + projected weekly frequency at risk + 24h without a replacement reservation.
 */
export function shouldOfferAutomaticPlanB({
  disruptionType,
  agreedWeeklyFrequency,
  confirmedThisWeek,
  futureReservationsThisWeek,
  hoursSinceDisruption,
  replacementReservationExists,
  safetyBlocked,
}) {
  if (safetyBlocked) return false
  if (!['cancelled', 'no_show'].includes(disruptionType)) return false
  if (replacementReservationExists) return false
  if (Number(hoursSinceDisruption || 0) < 24) return false
  return projectedFrequencyAtRisk({ agreedWeeklyFrequency, confirmedThisWeek, futureReservationsThisWeek })
}

export function selectPlanBFamily({
  trainingLevel = 1,
  journeyDay = 1,
  disruptionReason = 'schedule',
  canTrain = true,
  safetyBlocked = false,
}) {
  if (safetyBlocked || !canTrain) return null

  const level = Number(trainingLevel || 1)
  const day = Number(journeyDay || 1)

  // Early stage / low autonomy prioritises continuity without overwhelming the person.
  if (level <= 1 || day <= 30) return 'B1'

  // A stable person missing for logistics normally needs a meaningful session replacement.
  if (['schedule', 'travel', 'class_full', 'time'].includes(disruptionReason) && (level >= 2 || day > 30)) {
    return day > 90 || level >= 3 ? 'B3' : 'B2'
  }

  return day > 90 || level >= 3 ? 'B3' : 'B2'
}

export function deriveContinuityAlerts({
  now = new Date(),
  lastAttendedAt,
  activePlanB,
  planBOpenedOrBooked = false,
  consecutivePlanBWeeks = 0,
  sensitiveCheckin = false,
}) {
  const alerts = []
  const noAttendanceDays = daysBetween(lastAttendedAt, now)

  if (sensitiveCheckin) alerts.push(MI_CAMINO_ALERTS.SENSITIVE_CHECKIN)

  if (activePlanB?.offered_at && !planBOpenedOrBooked) {
    const hours = (new Date(now).getTime() - new Date(activePlanB.offered_at).getTime()) / (60 * 60 * 1000)
    if (Number.isFinite(hours) && hours >= 48) alerts.push(MI_CAMINO_ALERTS.PLAN_B_UNRESOLVED_48H)
  }

  if (noAttendanceDays != null && noAttendanceDays >= 14) {
    alerts.push(MI_CAMINO_ALERTS.NO_ATTENDANCE_14D)
  } else if (noAttendanceDays != null && noAttendanceDays >= 7) {
    alerts.push(MI_CAMINO_ALERTS.NO_ATTENDANCE_7D)
  }

  if (Number(consecutivePlanBWeeks || 0) >= 2) alerts.push(MI_CAMINO_ALERTS.TWO_PLAN_B_WEEKS)

  return alerts
}

export function needsHumanCoachTask(alerts = []) {
  return alerts.some((alert) => [
    MI_CAMINO_ALERTS.PLAN_B_UNRESOLVED_48H,
    MI_CAMINO_ALERTS.NO_ATTENDANCE_7D,
    MI_CAMINO_ALERTS.NO_ATTENDANCE_14D,
    MI_CAMINO_ALERTS.TWO_PLAN_B_WEEKS,
    MI_CAMINO_ALERTS.SENSITIVE_CHECKIN,
  ].includes(alert))
}

export function recognitionQueue(awards = [], maxPublicPerClass = 2) {
  const eligible = awards
    .filter((award) => award?.public_recognition !== false)
    .filter((award) => ['earned', 'validated', 'deferred'].includes(award?.status))
    .sort((a, b) => Number(b?.priority || 0) - Number(a?.priority || 0) || new Date(a?.earned_at || 0) - new Date(b?.earned_at || 0))

  return {
    publicNow: eligible.slice(0, maxPublicPerClass),
    defer: eligible.slice(maxPublicPerClass),
  }
}
