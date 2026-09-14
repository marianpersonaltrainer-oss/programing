const MAX_QUESTION_LENGTH = 800
const MAX_SESSION_LENGTH = 12000
const PERSON_REFERENCE_RE = /\b(?:cliente|alumna|alumno|persona|paciente)\s*(?:[:#-]?\s*[A-ZÁÉÍÓÚÜÑ][\p{L}'-]+)?/iu
const HEALTH_REFERENCE_RE = /\b(?:lesi[oó]n|dolor|lumbar|rodilla|hombro|muñeca|cuello|historial\s+(?:m[eé]dico|de\s+salud))\b/iu
const MUTATION_RE = /\b(?:publica|sube|borra|elimina|env[ií]a|manda|cambia|modifica|edita|actualiza|reserva|cancela|registra)\b/i

export class HeadCoachQuestionError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function requiredText(value, maxLength, code) {
  const text = String(value || '').trim()
  if (!text || text.length > maxLength) throw new HeadCoachQuestionError(code)
  return text
}

/**
 * Contrato mínimo para el futuro gateway del Head Coach propio.
 * No transporta identidades, historiales ni capacidad de alterar programación.
 */
export function createHeadCoachQuestion({ question, context } = {}) {
  const cleanQuestion = requiredText(question, MAX_QUESTION_LENGTH, 'invalid_question')
  const dayName = requiredText(context?.dayName, 40, 'invalid_class_context')
  const classLabel = requiredText(context?.classLabel, 80, 'invalid_class_context')
  const sessionText = requiredText(context?.sessionText, MAX_SESSION_LENGTH, 'invalid_class_context')
  // El piloto no recibe feedback ni seguimientos: incluso si un cliente lo
  // adjunta, no llega a cola, BD ni al worker.
  const feedbackText = ''

  if (PERSON_REFERENCE_RE.test(cleanQuestion) || HEALTH_REFERENCE_RE.test(cleanQuestion)) {
    throw new HeadCoachQuestionError('personal_context_not_allowed')
  }
  if (MUTATION_RE.test(cleanQuestion)) throw new HeadCoachQuestionError('mutation_not_allowed')

  return {
    schemaVersion: 1,
    kind: 'head_coach_class_question',
    permissions: {
      responseOnly: true,
      sourceScope: ['metodo_evo', 'clase_publicada'],
      excludes: ['personas', 'historial_salud', 'wodbuster_write', 'programacion_write', 'whatsapp'],
    },
    question: cleanQuestion,
    classContext: {
      dayName,
      classLabel,
      sessionText,
      feedbackText,
    },
  }
}
