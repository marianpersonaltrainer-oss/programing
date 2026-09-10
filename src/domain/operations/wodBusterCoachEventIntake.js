/*
 * Contrato de entrada WodBuster -> Panel de entrenadores.
 *
 * Solo acepta el relevo mínimo que necesita un entrenador. No admite fichas,
 * pagos, conversaciones ni diagnósticos procedentes de WodBuster.
 */

const EVENT_TYPES = new Set([
  'trial.confirmed',
  'trial.completed',
  'onboarding.started',
  'coach.note.created',
])

const PERSON_FIELDS = new Set([
  'reference',
  'phase',
  'sessionAt',
  'objective',
  'experience',
  'context',
  'precaution',
  'observe',
  'close',
])

const FORBIDDEN_FIELDS = new Set([
  'name', 'fullName', 'email', 'phone', 'mobile', 'address', 'price',
  'tariff', 'payment', 'iban', 'card', 'diagnosis', 'medicalReport',
  'whatsapp', 'conversation', 'message',
])

function text(value) { return typeof value === 'string' ? value.trim() : '' }

function safeText(value, field) {
  const result = text(value)
  if (!result) return ''
  if (result.length > 500) throw new WodBusterCoachEventError(`${field}_too_long`)
  return result
}

function assertNoForbiddenFields(value, path = 'event') {
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key)) throw new WodBusterCoachEventError(`${path}.${key}_forbidden`)
    if (nested && typeof nested === 'object') assertNoForbiddenFields(nested, `${path}.${key}`)
  }
}

function minimalPerson(raw = {}) {
  const person = {}
  for (const field of PERSON_FIELDS) {
    const value = safeText(raw[field], `person.${field}`)
    if (value) person[field] = value
  }
  if (!person.reference) throw new WodBusterCoachEventError('person_reference_required')
  return person
}

export class WodBusterCoachEventError extends Error {
  constructor(code) { super(code); this.code = code }
}

export function normalizeWodBusterCoachEvent(input = {}) {
  assertNoForbiddenFields(input)
  const type = safeText(input.type, 'type')
  if (!EVENT_TYPES.has(type)) throw new WodBusterCoachEventError('event_type_not_allowed')

  const id = safeText(input.id, 'id')
  const coachId = safeText(input.coachId, 'coachId')
  const occurredAt = safeText(input.occurredAt, 'occurredAt')
  if (!id || !coachId || !occurredAt || Number.isNaN(new Date(occurredAt).getTime())) {
    throw new WodBusterCoachEventError('event_identity_invalid')
  }

  const event = {
    id,
    type,
    source: 'wodbuster',
    coachId,
    occurredAt: new Date(occurredAt).toISOString(),
    person: minimalPerson(input.person),
  }
  for (const field of ['coachName', 'observation', 'adaptation', 'note']) {
    const value = safeText(input[field], field)
    if (value) event[field] = value
  }
  return Object.freeze(event)
}
