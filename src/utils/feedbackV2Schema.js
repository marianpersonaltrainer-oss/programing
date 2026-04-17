/**
 * Schema del feedback estructurado v2.
 * Cada campo es texto corto (1-3 frases).
 */
export const FEEDBACK_V2_EMPTY = {
  objetivo: '',
  sensaciones: '',
  anticipacion: '',
}

export function feedbackV2IsComplete(fb) {
  if (!fb || typeof fb !== 'object') return false
  return (
    typeof fb.objetivo === 'string' && fb.objetivo.trim().length > 0 &&
    typeof fb.sensaciones === 'string' && fb.sensaciones.trim().length > 0 &&
    typeof fb.anticipacion === 'string' && fb.anticipacion.trim().length > 0
  )
}

export function feedbackV2ToText(fb) {
  if (!feedbackV2IsComplete(fb)) return ''
  return `OBJETIVO: ${fb.objetivo}\nSENSACIONES: ${fb.sensaciones}\nANTICIPACIÓN: ${fb.anticipacion}`
}

export function feedbackV2FromText(text) {
  if (!text || typeof text !== 'string') return null
  const obj = { ...FEEDBACK_V2_EMPTY }
  const objMatch = text.match(/OBJETIVO:\s*(.+?)(?=\nSENSACIONES:|$)/s)
  const senMatch = text.match(/SENSACIONES:\s*(.+?)(?=\nANTICIPACIÓN:|$)/s)
  const antMatch = text.match(/ANTICIPACIÓN:\s*(.+?)$/s)
  if (objMatch) obj.objetivo = objMatch[1].trim()
  if (senMatch) obj.sensaciones = senMatch[1].trim()
  if (antMatch) obj.anticipacion = antMatch[1].trim()
  return feedbackV2IsComplete(obj) ? obj : null
}
