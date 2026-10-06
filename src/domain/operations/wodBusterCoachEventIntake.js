/*
 * Contrato de entrada WodBuster -> Panel de entrenadores.
 *
 * No abre red ni contiene credenciales. Convierte únicamente eventos ya
 * autorizados en el relevo mínimo que necesita un entrenador. Así, cuando se
 * verifique un RestHook o API de WodBuster, el adaptador externo no podrá
 * volcar fichas, pagos o conversaciones completas en Programming EVO.
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

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function safeText(value, field) {
  const result = text(value)
  if (!result) return ''
  if (result.length > 500) throw new WodBusterCoachEventError(`${field}_too_long`)
  return result
}

function assertNoForbiddenFields(value, path = 'event') {
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      throw new WodBusterCoachEventError(`${path}.${key}_forbidden`)
    }
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
  constructor(code) {
    super(code)
    this.code = code
  }
}

/**
 * Valida y minimiza un evento antes de que el panel lo persista o proyecte.
 * El adaptador que lo llame debe haber comprobado previamente autenticidad y
 * autorización de la fuente. Esta función nunca acepta la respuesta bruta de
 * una ficha WodBuster.
 */
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

export function wodbusterCoachIntakeStatus(environment = {}) {
  return {
    readyForVerifiedSource: true,
    liveSourceEnabled: String(environment.WODBUSTER_COACH_EVENTS_ENABLED || '').toLowerCase() === 'true',
    requires: ['verificacion_del_destino', 'autenticacion_del_origen', 'autorizacion_explicita_de_lectura_individual'],
    writesToWodBuster: false,
    acceptsPayments: false,
  }
}
