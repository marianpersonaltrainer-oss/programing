import { createHash } from 'node:crypto'
import { fromZonedTime } from 'date-fns-tz'

const first = (raw, names) => names.map((name) => raw?.[name]).find((value) => value !== undefined && value !== null && value !== '')
const text = (value) => value == null ? null : String(value).trim() || null
const bool = (value) => value === true || value === 1 || /^(1|true|sí|si|yes)$/i.test(String(value || ''))
const stableId = (prefix, parts) => `${prefix}:${createHash('sha256').update(parts.map((x) => x ?? '').join('|')).digest('hex').slice(0, 32)}`

function hasExplicitZone(value) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(value || '').trim())
}

export function toIso(value, { timezone = 'Europe/Madrid' } = {}) {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw
  const date = hasExplicitZone(normalized) ? new Date(normalized) : fromZonedTime(normalized, timezone)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function sessionDateTime(raw, options = {}) {
  const direct = first(raw, ['FechaHoraClase', 'FechaHora', 'dateTime', 'startsAt'])
  if (direct) return toIso(direct, options)
  const day = text(first(raw, ['FechaClase', 'Fecha', 'day', 'date']))
  const time = text(first(raw, ['HoraClase', 'Hora', 'start', 'time']))
  if (!day) return null
  return toIso(time ? `${day}T${time}` : day, options)
}

export function sessionKey(raw) {
  return text(first(raw, ['IdClase', 'ClaseId', 'IdSesion', 'SesionId', 'classId', 'scheduleEventId'])) || stableId('session', [
    first(raw, ['FechaClase', 'Fecha', 'day', 'date']),
    first(raw, ['HoraClase', 'Hora', 'start', 'time']),
    first(raw, ['Entrenamiento', 'TipoEntrenamiento', 'className', 'trainingName']),
  ])
}

export function normalizeAthlete(raw, options = {}) {
  const externalPersonId = text(first(raw, ['IdAtleta', 'AtletaId', 'IdPersona', 'PersonaId', 'userId', 'id']))
  if (!externalPersonId) return null
  return {
    externalPersonId,
    fullName: text(first(raw, ['NombreCompleto', 'Nombre', 'name', 'fullName'])) || 'Atleta WodBuster',
    email: text(first(raw, ['Email', 'email'])),
    joinedAt: toIso(first(raw, ['FechaAlta', 'Alta', 'joinedAt']), options),
    raw,
  }
}

export function normalizeCoachSession(raw, options = {}) {
  return {
    externalClassId: sessionKey(raw),
    className: text(first(raw, ['Entrenamiento', 'TipoEntrenamiento', 'className', 'trainingName'])),
    startsAt: sessionDateTime(raw, options),
    externalCoachId: text(first(raw, ['IdCoach', 'CoachId', 'IdEntrenador', 'EntrenadorId', 'coachId'])),
    coachName: text(first(raw, ['Coach', 'Entrenador', 'NombreCoach', 'coachName'])),
    raw,
  }
}

export function normalizeTraining(raw, { now = new Date(), coaches = new Map(), timezone = 'Europe/Madrid' } = {}) {
  const externalPersonId = text(first(raw, ['IdAtleta', 'AtletaId', 'IdPersona', 'PersonaId', 'userId']))
  if (!externalPersonId) return null

  const externalClassId = sessionKey(raw)
  const startsAt = sessionDateTime(raw, { timezone })
  const cancelledAt = toIso(first(raw, ['FechaCancelacion', 'FechaBorrado', 'CanceladoEn', 'cancelledAt']), { timezone })
  const attendedAt = toIso(first(raw, ['FechaLecturaTorno', 'attendanceAt', 'checkinAt']), { timezone })
  const lateCancellation = bool(first(raw, ['BorradoFueraHora', 'lateCancellation']))
  const ended = startsAt ? new Date(startsAt) < now : false
  const status = cancelledAt
    ? (lateCancellation ? 'late_cancelled' : 'cancelled')
    : attendedAt
      ? 'attended'
      : ended
        ? 'no_show'
        : 'reserved'

  const coachList = coaches.get(externalClassId) || []
  const externalReservationId = text(first(raw, ['IdReserva', 'ReservaId', 'reservationId', 'id'])) || stableId('reservation', [externalPersonId, externalClassId, startsAt])

  return {
    externalReservationId,
    externalPersonId,
    externalClassId,
    className: text(first(raw, ['Entrenamiento', 'TipoEntrenamiento', 'className', 'trainingName'])),
    startsAt,
    cancelledAt,
    attendedAt,
    lateCancellation,
    status,
    coaches: coachList,
    raw,
  }
}

export function rawEventId(kind, normalized) {
  return stableId(kind, [normalized.externalReservationId || normalized.externalPersonId, normalized.status || normalized.startsAt])
}
