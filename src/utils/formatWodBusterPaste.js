/**
 * Texto para pegar en WodBuster: bloques con nombre + contenido, sin timings (X' - Y'),
 * sin líneas de feedback. El modelo puede meter emojis o timings en wodbuster; esto limpia la vista/copia.
 */

/** Timing al final de línea: (0' - 5'), (12' - 24'), (56' - 60') */
const LINE_TIMING_SUFFIX = /\s*\(\s*\d+\s*['']?\s*-\s*\d+\s*['']?\s*\)\s*$/i

/** Otros paréntesis finales con minutos sueltos */
const LINE_PAREN_TIME = /\s*\([^)]*\d+\s*[''][^)]*\)\s*$/i

function stripTimingFromLine(line) {
  let s = line.replace(LINE_TIMING_SUFFIX, '').trimEnd()
  s = s.replace(LINE_PAREN_TIME, '').trimEnd()
  return s
}

/**
 * @param {string} raw — campo wodbuster o texto de sesión alumno
 * @returns {string}
 */
export function formatWodBusterPasteText(raw) {
  if (raw == null || String(raw).trim() === '' || String(raw).trim() === 'FESTIVO') return ''
  const lines = String(raw).split('\n')
  const out = []
  for (const line of lines) {
    const tr = line.trim()
    if (!tr) continue
    if (/^feedback\s/i.test(tr)) continue
    if (/^FEEDBACK\s/i.test(tr)) continue
    const cleaned = stripTimingFromLine(line)
    if (cleaned.trim()) out.push(cleaned)
  }
  let t = out.join('\n')
  t = t.replace(/\n{3,}/g, '\n\n').trim()
  return t
}

/**
 * Semana completa para copiar: día + bloques limpios.
 * @param {{ dias?: Array<{ nombre?: string, wodbuster?: string }> }} weekData
 */
export function buildWeekWodBusterPaste(weekData) {
  const dias = weekData?.dias || []
  const parts = []
  for (const d of dias) {
    const name = String(d?.nombre || '').trim()
    const block = formatWodBusterPasteText(d?.wodbuster || '')
    if (!block) continue
    parts.push(`${name}\n\n${block}`)
  }
  return parts.join('\n\n\n')
}
