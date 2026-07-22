const CLASS_DAY_TITLE_RE =
  /\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|funcional|basics|fit|hybrix|fuerza|gimnastica|gimnástica|todos)\b/i

const LEGACY_LABEL_RE =
  /^(?:[-*•]\s*)?(?:OBJETIVO|SENSACIONES|ANTICIPACI[ÓO]N|LOGÍSTICA|CALIDAD|FLUIDEZ|TÉCNICA|NOTA|RECORDATORIO)\s*:\s*/i

function isDiscardableTitle(line) {
  const raw = String(line || '').trim()
  const plain = raw.replace(/\*+/g, '').trim()
  if (!plain) return true
  const classDayTitle = plain.length < 120 && /\|/.test(plain) && CLASS_DAY_TITLE_RE.test(plain)
  const markdownTitle = /^\*+[^*\n]+\*+$/.test(raw)
  return classDayTitle || markdownTitle
}

/**
 * Convierte salidas antiguas con títulos, viñetas o campos rígidos en la nota
 * fluida que usa actualmente el Método EVO. No inventa ni reescribe contenido.
 */
export function sanitizeCoachFeedbackText(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const lines = raw
    .replace(/^```[\w-]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .split(/\r?\n/)
    .map((line) => line.trim())

  while (lines.length && isDiscardableTitle(lines[0])) lines.shift()

  return lines
    .map((line) => line.replace(LEGACY_LABEL_RE, '').replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
