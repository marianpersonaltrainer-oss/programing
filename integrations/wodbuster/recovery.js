import { evaluateFreshness } from './freshness.js'

/**
 * Produces neutral follow-up candidates from missed/cancelled reservations.
 * Product-specific actions (Plan B, message, coach task) live outside this shared layer.
 */
export function findRecoveryCandidates(
  reservations,
  attendance,
  syncState,
  { now = new Date(), waitHours = 24, staleAfterMinutes = 90 } = {},
) {
  const freshness = evaluateFreshness(syncState, { now, staleAfterMinutes })
  if (freshness.suppressNegativeActions) return { candidates: [], freshness }

  const confirmedUsers = new Set(
    attendance.filter((item) => item.confirmed).map((item) => item.wodbuster_user_id),
  )

  const output = []
  const seen = new Set()

  for (const missed of reservations) {
    if (!['cancelled', 'late_cancelled', 'no_show'].includes(missed.status)) continue
    const trigger = new Date(missed.cancelled_at || missed.starts_at)
    if (Number.isNaN(trigger.valueOf())) continue

    const eligibleAt = new Date(trigger.getTime() + waitHours * 3600000)
    if (eligibleAt > now) continue

    // At the 24h checkpoint we only need to know whether the person has already
    // recovered continuity by holding a later valid booking/attendance. The
    // replacement class itself may be several days later; limiting its start to
    // the first 24h would create false follow-up tasks for people who rebooked
    // promptly into the next class that actually fits their schedule.
    const relocated = reservations.some((other) => {
      if (other.wodbuster_user_id !== missed.wodbuster_user_id) return false
      if (other.external_reservation_id === missed.external_reservation_id) return false
      if (!['reserved', 'attended'].includes(other.status)) return false
      const nextStart = new Date(other.starts_at)
      return !Number.isNaN(nextStart.valueOf()) && nextStart > trigger
    })

    if (!relocated && !seen.has(missed.external_reservation_id)) {
      seen.add(missed.external_reservation_id)
      output.push({
        externalReservationId: missed.external_reservation_id,
        wodbusterUserId: missed.wodbuster_user_id,
        reason: missed.status,
        eligibleAt: eligibleAt.toISOString(),
        hasConfirmedHistory: confirmedUsers.has(missed.wodbuster_user_id),
      })
    }
  }

  return { candidates: output, freshness }
}
