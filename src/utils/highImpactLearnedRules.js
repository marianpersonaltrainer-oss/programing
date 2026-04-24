function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const HIGH_IMPACT_RE = [
  /\bregular\b/,
  /\bmal\b/,
  /\bfalto tiempo\b/,
  /\btiempo.*justo\b/,
  /\btiming\b/,
  /\bdescansos?\b/,
  /\bwod\b.*\blargo\b/,
  /\bwod\b.*\bcorto\b/,
  /\brepeti/,
  /\bno encaja\b/,
  /\bsustituir\b/,
  /\bcambiar\b/,
  /\bajustar\b/,
  /\bcarga\b.*\balta\b/,
  /\bcarga\b.*\bbaja\b/,
  /\bdolor\b/,
  /\blesion\b/,
  /\briesgo\b/,
  /\bseguridad\b/,
]

/**
 * Filtro para evitar ruido en auto-aprendizajes:
 * acepta solo líneas con señales de ajuste relevante de programación.
 */
export function isHighImpactLearnedLine(line) {
  const n = normalize(line)
  if (!n || n.length < 28) return false
  return HIGH_IMPACT_RE.some((re) => re.test(n))
}

export function filterHighImpactLearnedLines(lines) {
  const out = []
  for (const line of lines || []) {
    const t = String(line || '').trim()
    if (!t) continue
    if (!isHighImpactLearnedLine(t)) continue
    out.push(t)
  }
  return out
}

