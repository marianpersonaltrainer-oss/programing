const WEEK_FORMAT_MARKER = '\nFORMATO JSON — SOLO JSON'
const SECURITY_MARKER = '\n\nSEGURIDAD'

const DAY_FORMAT_CONTRACT = `
FORMATO ESTRUCTURADO — UN SOLO DÍA
La salida está restringida por Structured Outputs. Devuelve únicamente un objeto raíz con la clave "dia".
"dia" debe incluir "nombre", todas las sesiones y feedbacks EVO y "wodbuster", siempre como strings.
No incluyas titulo, semana, mesociclo, resumen, array dias ni otros campos raíz.
`

/**
 * Sustituye únicamente el antiguo ejemplo semanal del system base.
 *
 * Conserva SEGURIDAD y todos los bloques dinámicos que la app añade después
 * (Método EVO, mesociclo, biblioteca). Cortar el system en el marcador de
 * formato eliminaría precisamente ese contexto.
 */
export function buildDayGenerationSystemPrompt(systemPrompt) {
  const source = String(systemPrompt || '')
  const start = source.indexOf(WEEK_FORMAT_MARKER)
  if (start < 0) return `${source.trimEnd()}\n\n${DAY_FORMAT_CONTRACT.trim()}`.trim()
  const end = source.indexOf(SECURITY_MARKER, start)
  if (end < 0) {
    return `${source.slice(0, start).trimEnd()}\n\n${DAY_FORMAT_CONTRACT.trim()}`.trim()
  }
  return [
    source.slice(0, start).trimEnd(),
    DAY_FORMAT_CONTRACT.trim(),
    source.slice(end).trimStart(),
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim()
}
