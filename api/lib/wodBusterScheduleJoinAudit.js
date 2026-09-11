// Local-only audit for an explicitly normalized adapter contract.
// Not wired to any route, database, UI, notification or authorization decision.
// Raw API date/time and cancellation formats still require verification.
function key(row) {
  if (!row || typeof row !== 'object') return null
  const { date, time, className } = row
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T12:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  if (typeof className !== 'string' || !className.trim()) return null
  return JSON.stringify([date, time, className.normalize('NFC').trim()])
}

export function auditWodBusterScheduleJoin({ sessions, bookings }) {
  if (!Array.isArray(sessions) || !Array.isArray(bookings)) throw new TypeError('normalized_arrays_required')
  const report = { sessions: sessions.length, bookings: bookings.length, invalidSessions: 0, invalidBookings: 0, missingCoach: 0, ambiguous: 0, unmatched: 0, uniqueCandidates: 0 }
  const grouped = new Map()
  for (const session of sessions) {
    const sessionKey = key(session)
    if (!sessionKey) { report.invalidSessions++; continue }
    const matches = grouped.get(sessionKey) || []
    matches.push(session)
    grouped.set(sessionKey, matches)
  }
  for (const booking of bookings) {
    const bookingKey = key(booking)
    if (!bookingKey) { report.invalidBookings++; continue }
    const matches = grouped.get(bookingKey) || []
    if (!matches.length) { report.unmatched++; continue }
    // Even identical duplicate rows are unresolved without a stable class ID.
    if (matches.length !== 1) { report.ambiguous++; continue }
    const coach = matches[0].coachReference
    if (typeof coach !== 'string' || !coach.trim()) { report.missingCoach++; continue }
    report.uniqueCandidates++
  }
  // Counts only. A unique candidate is NOT permission to disclose a client.
  return report
}
