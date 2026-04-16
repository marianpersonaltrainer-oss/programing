/**
 * Extrae la primera línea sustancial del bloque B) de una sesión (vista alumno / WodBuster).
 * Usado en feedback coach, aprendizaje desde edición y revisión de semana en el generador Excel.
 */
export function extractMainExerciseFromBlockB(sessionText) {
  const src = String(sessionText || '')
  if (!src.trim()) return ''
  const lines = src.split('\n').map((l) => l.trim())
  let bStart = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (/^B\)\s*/i.test(lines[i])) {
      bStart = i
      break
    }
  }
  if (bStart < 0) return ''
  let bEnd = lines.length
  for (let i = bStart + 1; i < lines.length; i += 1) {
    if (/^(C\)\s*|CIERRE\b)/i.test(lines[i])) {
      bEnd = i
      break
    }
  }
  for (let i = bStart + 1; i < bEnd; i += 1) {
    const line = lines[i]
    if (!line) continue
    if (/^[A-ZÁÉÍÓÚÜÑ0-9\s/+().-]{4,}$/.test(line)) continue
    if (/:$/.test(line)) continue
    if (/^(ESCALADOS?|TÉCNICA|TECNICA|APROXIMACIÓN|APROXIMACION|BIENVENIDA|WOD PREP)\b/i.test(line)) continue
    return line.replace(/^[-•]\s*/, '')
  }
  return ''
}
