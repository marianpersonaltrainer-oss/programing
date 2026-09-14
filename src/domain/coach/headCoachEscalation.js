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

/**
 * Traduce solo los campos categóricos del formulario de coaches en candidatos
 * de revisión. No acepta ni usa texto libre, nombres o detalles de cambios.
 * Una incidencia para Sara siempre deberá crearse de forma explícita después.
 */
export function deriveHeadCoachReviewCandidates({
  classContext,
  stimulus,
  timeExplain,
  timeCause,
  nextFocus,
} = {}) {
  const context = {
    dayName: String(classContext?.dayName || '').trim(),
    classLabel: String(classContext?.classLabel || '').trim(),
  }
  const candidates = []

  const stimulusLabel = {
    short: 'se quedó corto',
    hard: 'fue demasiado duro',
    blocked: 'frenó técnica o logística',
  }[stimulus]
  if (stimulusLabel) {
    candidates.push(createHeadCoachEscalation({
      classContext: context,
      destination: 'programmer_review',
      summary: `El estímulo reportado ${stimulusLabel}. Revisar el patrón junto a otros turnos antes de ajustar programación.`,
    }))
  }

  if (timeExplain === 'no' || timeExplain === 'justo') {
    const causeLabel = {
      explanation: 'explicación',
      technique: 'técnica',
      setup: 'montaje',
      loads: 'cargas',
      wod: 'estructura del WOD',
    }[timeCause] || 'ritmo de clase'
    candidates.push(createHeadCoachEscalation({
      classContext: context,
      destination: 'programmer_review',
      summary: `El tiempo de la clase fue ${timeExplain === 'no' ? 'insuficiente' : 'muy justo'} por ${causeLabel}. Revisar si se repite.`,
    }))
  }

  if (nextFocus) {
    const focusLabel = {
      load_scale: 'carga o escala',
      clock_volume: 'reloj o volumen',
      technique: 'técnica',
      setup_material: 'montaje o material',
      fatigue: 'fatiga general',
    }[nextFocus]
    if (focusLabel) {
      candidates.push(createHeadCoachEscalation({
        classContext: context,
        destination: 'head_coach_library',
        summary: `Queda como foco general para la próxima revisión: ${focusLabel}.`,
      }))
    }
  }

  return candidates
}
