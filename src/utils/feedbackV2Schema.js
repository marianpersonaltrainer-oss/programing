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

/**
 * Parsea briefing aunque falten campos (texto publicado desde admin / Excel).
 * @returns {{ type: 'v2', objetivo, sensaciones, anticipacion } | { type: 'partial', fields: {label, text}[] } | { type: 'plain', text: string }}
 */
export function parseBriefingForDisplay(text) {
  const raw = String(text || '').trim()
  if (!raw) return { type: 'empty' }
  const v2 = feedbackV2FromText(raw)
  if (v2) return { type: 'v2', ...v2 }
  const fields = []
  const objM = raw.match(/OBJETIVO:\s*([\s\S]+?)(?=\n\s*SENSACIONES:|\n\s*ANTICIPACIÓN:|\n\s*ANTICIPACION:|$)/i)
  const senM = raw.match(/SENSACIONES:\s*([\s\S]+?)(?=\n\s*ANTICIPACIÓN:|\n\s*ANTICIPACION:|$)/i)
  const antM = raw.match(/ANTICIPACIÓN:\s*([\s\S]+)/i) || raw.match(/ANTICIPACION:\s*([\s\S]+)/i)
  if (objM) fields.push({ label: 'Objetivo', text: objM[1].trim() })
  if (senM) fields.push({ label: 'Sensaciones', text: senM[1].trim() })
  if (antM) fields.push({ label: 'Anticipación', text: antM[1].trim() })
  if (fields.length) return { type: 'partial', fields }
  return { type: 'plain', text: raw }
}
