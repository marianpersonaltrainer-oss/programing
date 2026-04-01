/**
 * Contenido para «Modo pantalla»: cabeceras de bloque principal + sección WOD.
 */

export function extractProjectorContent(sessionText) {
  const text = String(sessionText || '')
  const lines = text.split('\n')
  const headers = []
  const wodLines = []
  let inWod = false

  for (const line of lines) {
    const t = line.trim()
    if (/^CIERRE\b/i.test(t) && inWod) break
    if (/^CIERRE\b/i.test(t) && !inWod) {
      headers.push(t)
      continue
    }

    if (/^WOD\b/i.test(t) || /^WOD\s+[—–-]/i.test(t) || /\bWOD\s+[—–-]/i.test(t)) {
      inWod = true
      wodLines.push(line)
      continue
    }

    if (inWod) {
      if (/^FEEDBACK\b/i.test(t)) break
      wodLines.push(line)
      continue
    }

    if (
      /^BIENVENIDA\b/i.test(t) ||
      /^[A-C]\)\s/i.test(t) ||
      /^CALENTAMIENTO\b/i.test(t) ||
      /^TÉCNICA\b/i.test(t) ||
      /^TECNIKA\b/i.test(t) ||
      /^FUERZA\b/i.test(t) ||
      /^PARTE\b/i.test(t) ||
      /^BLOQUE\b/i.test(t) ||
      /^ACCESORIOS\b/i.test(t) ||
      /^WOD PREP\b/i.test(t)
    ) {
      if (headers.length < 12) headers.push(line.trimEnd())
    }
  }

  const wod = wodLines.join('\n').trim()
  if (!wod && headers.length === 0) {
    return {
      headers: [],
      wod: text.split('\n').slice(0, 35).join('\n').trim(),
      fallback: true,
    }
  }

  return { headers, wod, fallback: !wod }
}
