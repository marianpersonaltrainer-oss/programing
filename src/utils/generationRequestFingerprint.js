function canonicalize(value) {
  if (value == null || typeof value !== 'object') {
    if (typeof value === 'string') return value.trim()
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value instanceof Set) return [...value].map(canonicalize).sort()
  const out = {}
  for (const key of Object.keys(value).sort()) {
    const normalized = canonicalize(value[key])
    if (normalized !== undefined) out[key] = normalized
  }
  return out
}

function normalizeDays(days) {
  return [...new Set(
    (days instanceof Set ? [...days] : Array.isArray(days) ? days : [])
      .map((day) => String(day || '').trim().toUpperCase())
      .filter(Boolean),
  )]
}

/**
 * Huella completa del objetivo de una llamada. Incluye contexto y plan, no solo
 * mesociclo/semana, para descartar respuestas que terminaron después de cambiar
 * oferta, días, histórico o arquitectura.
 */
export function buildGenerationRequestFingerprint(input = {}) {
  return JSON.stringify(
    canonicalize({
      mesocycle: String(input.mesocycle ?? input.mesociclo ?? '').trim().toLowerCase(),
      week: Number(input.week ?? input.semana) || null,
      phase: String(input.phase || '').trim().toLowerCase(),
      targetWeekStartDate: String(input.targetWeekStartDate || '').trim(),
      generationDays: normalizeDays(input.generationDays),
      weeklyOffer: input.weeklyOffer || null,
      instructions: String(input.instructions ?? input.addendum ?? '').trim(),
      selectedContextWeekIds: [...new Set(
        (input.selectedContextWeekIds || []).map((id) => String(id || '').trim()).filter(Boolean),
      )].sort(),
      contextRevision: String(input.contextRevision || '').trim(),
      weeklyArchitecture: input.weeklyArchitecture || null,
      completedDays: input.completedDays || null,
    }),
  )
}

export class StaleGenerationResponseError extends Error {
  constructor(message = 'La respuesta pertenece a otra semana, oferta o versión del contexto.') {
    super(message)
    this.name = 'StaleGenerationResponseError'
    this.code = 'stale_generation_response'
  }
}

export function assertGenerationRequestStillCurrent(capturedFingerprint, currentInput) {
  const currentFingerprint =
    typeof currentInput === 'string'
      ? currentInput
      : buildGenerationRequestFingerprint(currentInput)
  if (!capturedFingerprint || capturedFingerprint !== currentFingerprint) {
    throw new StaleGenerationResponseError()
  }
  return true
}
