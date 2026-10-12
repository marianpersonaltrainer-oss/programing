/*
 * Contrato mínimo WodBuster -> Oficina EVO para seguimientos.
 *
 * El receptor es deliberadamente más estricto que la API genérica de
 * WodBuster: solo puede recibir el estado suficiente para crear una alerta
 * interna en modo sombra. No acepta textos libres ni datos de contacto.
 */

const EVENT_TYPES = new Set(['member.activity_snapshot'])
const MEMBER_STATES = new Set(['active', 'paused', 'cancelled'])
const EVENT_FIELDS = new Set(['id', 'type', 'observedAt', 'member'])
const MEMBER_FIELDS = new Set([
  'reference',
  'startedOn',
  'lastActivityOn',
  'membershipState',
  'previousMembershipState',
  'stateChangedOn',
])
const NATIVE_MEMBER_REFERENCE = 'Identificador de atleta'
const NATIVE_MEMBER_NAME = 'Nombre'
const NATIVE_INACTIVE_DAYS = 'Días desde el último entrenamiento (de tarifas)'
const NATIVE_NEXT_BOOKING_DAYS = 'Días hasta la próxima reserva (de tarifas)'

function text(value) { return typeof value === 'string' ? value.trim() : '' }

function safeText(value, field, max = 240) {
  const result = text(value)
  if (!result) throw new WodBusterFollowupEventError(`${field}_required`)
  if (result.length > max) throw new WodBusterFollowupEventError(`${field}_too_long`)
  return result
}

function dateOnly(value, field, { optional = false } = {}) {
  if (value == null && optional) return null
  const result = safeText(value, field, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(new Date(`${result}T00:00:00.000Z`).getTime())) {
    throw new WodBusterFollowupEventError(`${field}_invalid_date`)
  }
  return result
}

function assertOnlyFields(value, allowed, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WodBusterFollowupEventError(`${path}_invalid`)
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new WodBusterFollowupEventError(`${path}.${key}_not_allowed`)
  }
}

function state(value, field, { optional = false } = {}) {
  if (value == null && optional) return null
  const result = safeText(value, field, 16).toLowerCase()
  if (!MEMBER_STATES.has(result)) throw new WodBusterFollowupEventError(`${field}_not_allowed`)
  return result
}

function nonNegativeNumber(value, field, { optional = false } = {}) {
  if ((value == null || value === '') && optional) return null
  const result = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(result) || result < 0) {
    throw new WodBusterFollowupEventError(`${field}_invalid`)
  }
  return result
}

// La Oficina solo necesita una forma humana de reconocer a la persona. No
// conserva apellidos, contacto, tarifas ni el resto de la ficha de WodBuster.
function firstName(value) {
  const name = safeText(value, 'native.member_name', 120)
  const firstWord = name.split(/\s+/u)[0]
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(firstWord)) {
    throw new WodBusterFollowupEventError('native.member_name_invalid')
  }
  return firstWord.slice(0, 60)
}

function normalizeMember(raw) {
  assertOnlyFields(raw, MEMBER_FIELDS, 'member')
  return Object.freeze({
    reference: safeText(raw.reference, 'member.reference', 240),
    startedOn: dateOnly(raw.startedOn, 'member.startedOn'),
    lastActivityOn: dateOnly(raw.lastActivityOn, 'member.lastActivityOn', { optional: true }),
    membershipState: state(raw.membershipState, 'member.membershipState'),
    previousMembershipState: state(raw.previousMembershipState, 'member.previousMembershipState', { optional: true }),
    stateChangedOn: dateOnly(raw.stateChangedOn, 'member.stateChangedOn', { optional: true }),
  })
}

export class WodBusterFollowupEventError extends Error {
  constructor(code) { super(code); this.code = code }
}

export function normalizeWodBusterFollowupEvent(input = {}) {
  assertOnlyFields(input, EVENT_FIELDS, 'event')
  const type = safeText(input.type, 'type', 80)
  if (!EVENT_TYPES.has(type)) throw new WodBusterFollowupEventError('event_type_not_allowed')

  const id = safeText(input.id, 'id', 240)
  const observedAt = safeText(input.observedAt, 'observedAt', 80)
  if (Number.isNaN(new Date(observedAt).getTime())) {
    throw new WodBusterFollowupEventError('observedAt_invalid')
  }

  return Object.freeze({
    id,
    type,
    observedAt: new Date(observedAt).toISOString(),
    member: normalizeMember(input.member),
  })
}

/**
 * Reduce la carga nativa de WodBuster antes de que abandone el receptor.
 * WodBuster no permite mapear campos en su acción RestHook, por lo que manda
 * una ficha extensa. Esta función lee exclusivamente tres señales permitidas
 * y no conserva el objeto original ni ningún otro campo. El nombre de pila
 * se conserva porque Marian lo ha autorizado expresamente para identificar
 * los avisos en su Oficina privada.
 */
export function reduceNativeWodBusterInactivitySignal(input = {}, { observedAt = new Date() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WodBusterFollowupEventError('native_event_invalid')
  }

  const reference = safeText(input[NATIVE_MEMBER_REFERENCE], 'native.member_reference', 240)
  const memberFirstName = firstName(input[NATIVE_MEMBER_NAME])
  const inactiveDays = nonNegativeNumber(input[NATIVE_INACTIVE_DAYS], 'native.inactive_days')
  const nextBookingDays = nonNegativeNumber(input[NATIVE_NEXT_BOOKING_DAYS], 'native.next_booking_days', { optional: true })
  const timestamp = new Date(observedAt)
  if (Number.isNaN(timestamp.getTime())) {
    throw new WodBusterFollowupEventError('native_observed_at_invalid')
  }
  const observedAtIso = timestamp.toISOString()
  const signalDate = observedAtIso.slice(0, 10)

  return Object.freeze({
    id: `wodbuster-inactivity:${reference}:${signalDate}:${inactiveDays}`,
    type: 'member.followup_signal',
    observedAt: observedAtIso,
    payload: Object.freeze({
      member: Object.freeze({ reference, firstName: memberFirstName }),
      signal: Object.freeze({
        code: 'inactive_no_next_booking',
        inactiveDays,
        nextBookingDays,
      }),
    }),
  })
}
