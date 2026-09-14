const MAX_SUMMARY_LENGTH = 500
const DESTINATIONS = new Set([
  'programmer_review',
  'sara_incident',
  'head_coach_library',
])
const PERSONAL_OR_HEALTH_RE = /\b(?:cliente|alumn[oa]|persona|paciente|lesi[oó]n|dolor|lumbar|rodilla|hombro|muñeca|cuello|historial)\b/iu

export class HeadCoachEscalationError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function safeText(value, field, maxLength) {
  const text = String(value || '').trim()
  if (!text || text.length > maxLength) throw new HeadCoachEscalationError(`${field}_invalid`)
  return text
}

/**
 * Clasifica una observación genérica de clase. Es un contrato local: no guarda,
 * no manda mensajes y no decide sobre personas o salud. La entrega futura debe
 * requerir una revisión humana antes de cualquier notificación.
 */
export function createHeadCoachEscalation(input = {}) {
  const destination = safeText(input.destination, 'destination', 40)
  if (!DESTINATIONS.has(destination)) throw new HeadCoachEscalationError('destination_not_allowed')

  const dayName = safeText(input.classContext?.dayName, 'class_context', 40)
  const classLabel = safeText(input.classContext?.classLabel, 'class_context', 80)
  const summary = safeText(input.summary, 'summary', MAX_SUMMARY_LENGTH)
  if (PERSONAL_OR_HEALTH_RE.test(summary)) {
    throw new HeadCoachEscalationError('personal_context_not_allowed')
  }

  const signal = {
    schemaVersion: 1,
    kind: 'head_coach_class_escalation',
    classContext: { dayName, classLabel },
    destination,
    summary,
    requiresHumanReview: true,
    delivery: 'not_configured',
  }

  if (destination === 'programmer_review') {
    signal.intent = 'revisar_patron_de_programacion'
    signal.notifyImmediately = false
  } else if (destination === 'sara_incident') {
    signal.intent = 'revisar_incidencia_operativa'
    signal.notifyImmediately = true
  } else {
    signal.intent = 'proponer_aprendizaje_de_metodo'
    signal.notifyImmediately = false
  }

  return Object.freeze(signal)
}

export function escalationDestinationLabel(destination) {
  const labels = {
    programmer_review: 'Agente programador',
    sara_incident: 'Sara',
    head_coach_library: 'Biblioteca Head Coach',
  }
  return labels[destination] || 'Pendiente de revisión'
}
