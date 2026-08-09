import { evaluateFreshness } from './freshness.js'

/** Produces Plan-B follow-up candidates without blaming customers when the mirror is stale. */
export function findRecoveryCandidates(reservations, attendance, syncState, { now = new Date(), waitHours = 24, staleAfterMinutes = 90 } = {}) {
  const freshness = evaluateFreshness(syncState, { now, staleAfterMinutes })
  if (freshness.suppressNegativeActions) return { candidates: [], freshness }
  const confirmed = attendance.filter((a) => a.confirmed).map((a) => a.wodbuster_user_id)
  const output = []
  const seen = new Set()
  for (const missed of reservations) {
    if (!['cancelled', 'late_cancelled', 'no_show'].includes(missed.status)) continue
    const trigger = new Date(missed.cancelled_at || missed.starts_at)
    const eligibleAt = new Date(trigger.getTime() + waitHours * 3600000)
    if (eligibleAt > now) continue
    const relocated = reservations.some((other) => other.wodbuster_user_id === missed.wodbuster_user_id && other.external_reservation_id !== missed.external_reservation_id && ['reserved', 'attended'].includes(other.status) && new Date(other.starts_at) > trigger && new Date(other.starts_at) <= eligibleAt)
    if (!relocated && !seen.has(missed.external_reservation_id)) {
      seen.add(missed.external_reservation_id)
      output.push({ externalReservationId: missed.external_reservation_id, wodbusterUserId: missed.wodbuster_user_id, reason: missed.status, eligibleAt: eligibleAt.toISOString(), hasConfirmedHistory: confirmed.includes(missed.wodbuster_user_id) })
    }
  }
  return { candidates: output, freshness }
}
