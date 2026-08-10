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

function localDay(value) {
  const raw = text(value)
  if (!raw) return null
  return raw.includes('T') ? raw.split('T')[0] : raw.split(' ')[0]
}

function sessionDateTime(raw, options = {}) {
  const direct = first(raw, ['FechaHoraClase', 'FechaHora', 'dateTime', 'startsAt'])
  if (direct) return toIso(direct, options)
  const day = localDay(first(raw, ['FechaClase', 'Fecha', 'day', 'date']))
  const time = text(first(raw, ['HoraClase', 'HoraComienzo', 'Hora', 'start', 'time']))
  if (!day) return null
  return toIso(time ? `${day}T${time}` : day, options)
}

function normalizedEmail(raw) {
  return text(first(raw, ['Email', 'email']))?.toLowerCase() || null
}

function normalizedPhone(raw) {
  const phone = text(first(raw, ['Telefono', 'Teléfono', 'phone']))
  if (!phone) return null
  return phone.replace(/\D+/g, '') || null
}

function composedName(raw) {
  const explicit = text(first(raw, ['NombreCompleto', 'fullName', 'name']))
  if (explicit) return explicit
  const parts = [
    text(first(raw, ['Nombre'])),
    text(first(raw, ['Apellido1'])),
    text(first(raw, ['Apellido2'])),
  ].filter(Boolean)
  return parts.join(' ') || null
}

export function personKey(raw) {
  const native = text(first(raw, ['IdAtleta', 'AtletaId', 'IdPersona', 'PersonaId', 'userId', 'id']))
  if (native) return native

  // The live Data API export currently omits a native athlete id from both
  // Atletas and CuantoEntrenan. Derive the same privacy-safe cross-dataset key
  // from contact identity without persisting the contact value in the id.
  const email = normalizedEmail(raw)
  if (email) return stableId('person', ['email', email])
  const phone = normalizedPhone(raw)
  if (phone) return stableId('person', ['phone', phone])
  const name = composedName(raw)?.toLowerCase()
  return name ? stableId('person', ['name', name]) : null
}

export function sessionKey(raw) {
  return text(first(raw, ['IdClase', 'ClaseId', 'IdSesion', 'SesionId', 'classId', 'scheduleEventId'])) || stableId('session', [
    localDay(first(raw, ['FechaClase', 'Fecha', 'day', 'date'])),
    first(raw, ['HoraClase', 'HoraComienzo', 'Hora', 'start', 'time']),
    first(raw, ['Entrenamiento', 'NombreEntrenamiento', 'TipoEntrenamiento', 'className', 'trainingName']),
  ])
}

export function isWithinLocalDateWindow(startsAt, from, to, { timezone = 'Europe/Madrid' } = {}) {
  if (!startsAt || !from || !to) return false
  const value = new Date(startsAt)
  const start = fromZonedTime(`${from}T00:00:00`, timezone)
  const end = fromZonedTime(`${to}T23:59:59.999`, timezone)
  return !Number.isNaN(value.valueOf()) && value >= start && value <= end
}

export function normalizeAthlete(raw, options = {}) {
  const externalPersonId = personKey(raw)
  if (!externalPersonId) return null
  return {
    externalPersonId,
    fullName: composedName(raw) || 'Atleta WodBuster',
    email: normalizedEmail(raw),
    joinedAt: toIso(first(raw, ['FechaAlta', 'Alta', 'Creado', 'joinedAt']), options),
    raw,
  }
}

export function normalizeCoachSession(raw, options = {}) {
  const coachName = text(first(raw, ['Coach', 'Entrenador', 'NombreCoach', 'coachName']))
  const nativeCoachId = text(first(raw, ['IdCoach', 'CoachId', 'IdEntrenador', 'EntrenadorId', 'coachId']))
  return {
    externalClassId: sessionKey(raw),
    className: text(first(raw, ['Entrenamiento', 'NombreEntrenamiento', 'TipoEntrenamiento', 'className', 'trainingName'])),
    startsAt: sessionDateTime(raw, options),
    externalCoachId: nativeCoachId || (coachName ? stableId('coach', [coachName.toLowerCase()]) : null),
    coachName,
    raw,
  }
}

export function normalizeTraining(raw, { now = new Date(), coaches = new Map(), timezone = 'Europe/Madrid' } = {}) {
  const externalPersonId = personKey(raw)
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
  const externalReservationId = text(first(raw, ['IdReserva', 'ReservaId', 'reservationId', 'id'])) || stableId('reservation', [
    externalPersonId,
    externalClassId,
    startsAt,
    first(raw, ['TipoReserva', 'reservationType']),
  ])

  return {
    externalReservationId,
    externalPersonId,
    externalClassId,
    className: text(first(raw, ['NombreEntrenamiento', 'Entrenamiento', 'TipoEntrenamiento', 'className', 'trainingName'])),
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
