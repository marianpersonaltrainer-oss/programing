export const SHIFT_RECORD_TYPES = Object.freeze(['apertura', 'cierre'])
export const SHIFT_RESULTS = Object.freeze(['completado', 'incidencia'])

function requiredChoice(value, allowed, message) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!allowed.includes(normalized)) throw new Error(message)
  return normalized
}

export function buildShiftProtocolLogInput(input = {}) {
  const recordType = requiredChoice(
    input.recordType,
    SHIFT_RECORD_TYPES,
    'Elige apertura o cierre.',
  )
  const result = requiredChoice(
    input.result,
    SHIFT_RESULTS,
    'Elige completado o incidencia.',
  )
  const comment = String(input.comment || '').trim()
  const allStepsConfirmed = input.allStepsConfirmed === true
  const protocolVersion = String(input.protocolVersion || '').trim()

  if (!protocolVersion) throw new Error('No se ha podido identificar la versión del protocolo.')
  if (result === 'incidencia' && !comment) {
    throw new Error('Describe qué paso no has podido completar.')
  }
  if (result === 'completado' && !allStepsConfirmed) {
    throw new Error('Confirma que has realizado todos los pasos antes de guardar.')
  }

  return {
    record_type: recordType,
    result,
    comment: comment || null,
    all_steps_confirmed: result === 'completado' ? true : false,
    protocol_version: protocolVersion,
  }
}
