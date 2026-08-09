import { createHash } from 'node:crypto'

const first = (raw, names) => names.map((name) => raw?.[name]).find((value) => value !== undefined && value !== null && value !== '')
const text = (value) => value == null ? null : String(value).trim() || null
const bool = (value) => value === true || value === 1 || /^(1|true|sí|si|yes)$/i.test(String(value || ''))
const iso = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}
const id = (prefix, parts) => `${prefix}:${createHash('sha256').update(parts.map((x) => x || '').join('|')).digest('hex').slice(0, 32)}`

export function sessionKey(raw) {
  return text(first(raw, ['IdClase', 'ClaseId', 'IdSesion', 'SesionId', 'classId'])) || id('session', [
    first(raw, ['FechaClase', 'Fecha', 'day']), first(raw, ['HoraClase', 'Hora', 'start']),
    first(raw, ['Entrenamiento', 'TipoEntrenamiento', 'className']),
  ])
}

export function normalizeAthlete(raw) {
  const externalPersonId = text(first(raw, ['IdAtleta', 'AtletaId', 'IdPersona', 'PersonaId', 'id']))
  if (!externalPersonId) return null
  return { externalPersonId, fullName: text(first(raw, ['NombreCompleto', 'Nombre', 'name'])) || 'Atleta WodBuster', email: text(first(raw, ['Email', 'email'])), joinedAt: iso(first(raw, ['FechaAlta', 'Alta', 'joinedAt'])), raw }
}

export function normalizeCoachSession(raw) {
  const externalCoachId = text(first(raw, ['IdCoach', 'CoachId', 'IdEntrenador', 'EntrenadorId']))
  return { externalClassId: sessionKey(raw), className: text(first(raw, ['Entrenamiento', 'TipoEntrenamiento', 'className'])), startsAt: iso(first(raw, ['FechaHoraClase', 'FechaClase', 'Fecha'])), externalCoachId, coachName: text(first(raw, ['Coach', 'Entrenador', 'NombreCoach'])), raw }
}

export function normalizeTraining(raw, { now = new Date(), coaches = new Map() } = {}) {
  const externalPersonId = text(first(raw, ['IdAtleta', 'AtletaId', 'IdPersona', 'PersonaId']))
  if (!externalPersonId) return null
  const externalClassId = sessionKey(raw)
  const startsAt = iso(first(raw, ['FechaHoraClase', 'FechaClase', 'Fecha']))
  const cancelledAt = iso(first(raw, ['FechaCancelacion', 'FechaBorrado', 'CanceladoEn']))
  const attendedAt = iso(first(raw, ['FechaLecturaTorno']))
  const lateCancellation = bool(first(raw, ['BorradoFueraHora']))
  const ended = startsAt && new Date(startsAt) < now
  const status = cancelledAt ? (lateCancellation ? 'late_cancelled' : 'cancelled') : attendedAt ? 'attended' : ended ? 'no_show' : 'reserved'
  const coachList = coaches.get(externalClassId) || []
  const externalReservationId = text(first(raw, ['IdReserva', 'ReservaId', 'id'])) || id('reservation', [externalPersonId, externalClassId, startsAt])
  return { externalReservationId, externalPersonId, externalClassId, className: text(first(raw, ['Entrenamiento', 'TipoEntrenamiento'])), startsAt, cancelledAt, attendedAt, lateCancellation, status, coaches: coachList, raw }
}

export function rawEventId(kind, normalized) {
  return id(kind, [normalized.externalReservationId || normalized.externalPersonId, normalized.status || normalized.startsAt])
}
