import { auditWodBusterScheduleJoin } from './wodBusterScheduleJoinAudit.js'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function date(value) {
  const raw = text(value)
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/)
  const european = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s.*)?$/)
  const candidate = iso?.[1] || (european ? `${european[3]}-${european[2]}-${european[1]}` : '')
  if (!candidate) return ''
  const parsed = new Date(`${candidate}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate ? candidate : ''
}

function time(value) {
  const raw = text(value)
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/)
  return match ? `${match[1]}:${match[2]}` : ''
}

function className(value) {
  return text(value).normalize('NFC')
}

function present(value) {
  if (value === true || value === 1) return true
  const raw = text(String(value ?? '')).toLowerCase()
  return Boolean(raw && !['0', 'false', 'no', 'null', 'undefined'].includes(raw))
}

function invited(value) {
  if (value === true || value === 1) return true
  const raw = text(String(value ?? '')).toLowerCase()
  return ['1', 'true', 'si', 'sí', 'invitado'].includes(raw)
}

function booking(row) {
  return {
    date: date(row?.Fecha),
    time: time(row?.HoraComienzo),
    className: className(row?.NombreEntrenamiento),
  }
}

function session(row) {
  return {
    date: date(row?.Fecha),
    time: time(row?.Hora),
    className: className(row?.Entrenamiento),
    coachReference: text(row?.Coach),
  }
}

// Counts only. This layer deliberately drops every athlete identifier,
// contact field and reservation detail before returning to an API route.
export function summarizeWodBusterTrialShadow({ bookings, sessions }) {
  if (!Array.isArray(bookings) || !Array.isArray(sessions)) throw new TypeError('raw_arrays_required')
  let invitedBookings = 0
  let excludedCancelled = 0
  const candidates = []

  for (const row of bookings) {
    if (!invited(row?.Invitado)) continue
    invitedBookings++
    if (present(row?.FechaBorrado) || present(row?.BorradoFueraHora)) {
      excludedCancelled++
      continue
    }
    candidates.push(booking(row))
  }

  const result = auditWodBusterScheduleJoin({ bookings: candidates, sessions: sessions.map(session) })
  return Object.freeze({
    mode: 'shadow',
    bookingRows: bookings.length,
    scheduleRows: sessions.length,
    invitedBookings,
    excludedCancelled,
    candidateBookings: candidates.length,
    invalidCandidateBookings: result.invalidBookings,
    invalidScheduleRows: result.invalidSessions,
    unmatched: result.unmatched,
    ambiguous: result.ambiguous,
    missingCoach: result.missingCoach,
    uniquelyMatched: result.uniqueCandidates,
  })
}
