export const SHIFT_RECORD_TYPES = Object.freeze(['apertura', 'revision', 'cierre'])
export const SHIFT_RESULTS = Object.freeze(['completado', 'incidencia'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requiredChoice(value, allowed, message) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!allowed.includes(normalized)) throw new Error(message)
  return normalized
}

export function buildShiftProtocolLogInput(input = {}) {
  const shiftId = String(input.shiftId || '').trim()
  if (!UUID_PATTERN.test(shiftId)) throw new Error('No se ha podido identificar este turno.')
  const recordType = requiredChoice(
    input.recordType,
    SHIFT_RECORD_TYPES,
    'Elige un paso válido del turno.',
  )
  const result = requiredChoice(
    input.result,
    SHIFT_RESULTS,
    'Elige completado o incidencia.',
  )
  const comment = String(input.comment || '').trim()
  const allStepsConfirmed = input.allStepsConfirmed === true
  const protocolVersion = String(input.protocolVersion || '').trim()
  const firstClassExpected = input.firstClassExpected === true

  if (!protocolVersion) throw new Error('No se ha podido identificar la versión del protocolo.')
  if (result === 'incidencia' && !comment) {
    throw new Error('Describe qué paso no has podido completar.')
  }
  if (comment.length > 600) {
    throw new Error('La incidencia no puede superar 600 caracteres.')
  }
  if (result === 'completado' && !allStepsConfirmed) {
    throw new Error('Confirma que has realizado todos los pasos antes de guardar.')
  }
  if (recordType === 'revision' && result !== 'completado') {
    throw new Error('La revisión del turno debe guardarse como completada.')
  }

  return {
    shift_id: shiftId,
    record_type: recordType,
    result,
    comment: result === 'incidencia' ? comment : null,
    all_steps_confirmed: result === 'completado' ? true : false,
    first_class_expected: recordType === 'revision' ? firstClassExpected : false,
    protocol_version: protocolVersion,
  }
}
